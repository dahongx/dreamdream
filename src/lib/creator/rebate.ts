/**
 * 创作者返利结算 —— 每天早 8 点（Asia/Shanghai）跑一次。
 *
 * 规则（单一来源，见下方 RATES）：
 *   - 对话返利：用户跟角色对话每消耗 3 金币，返作者 0.6 金币（20%）。只算金币，
 *     银币消耗不返（产品决策）。按 3 金币一档，余数结转到下次结算。
 *   - 点赞返利：每 1 个点赞返 1 金币，看累计总数的净增量（防反复点赞取消刷）。
 *   - 收藏返利：每 1 个收藏返 1 金币，同上。
 *   - 粉丝返利：每 1 个粉丝返 3 金币，同上（账号级）。
 *
 * 防刷 / 幂等核心：游标（creator_character_cursors / creator_fans_cursors）。
 *   每次只对「当前累计 − 上次快照」的正增量返利，然后推进快照。点赞/收藏/粉丝
 *   用高水位棘轮（快照只增不减），取消再点不会重复发钱。对话金币按已发档位推进
 *   （发了 floor(delta/3) 档，游标前进 档*3，余数留到下次）。
 *
 * 结果：
 *   - creator_earning_records 每维度每角色（粉丝为账号）一条进账
 *   - users.creator_earnings 累加
 *   - 游标推进
 * 全部在一个事务里，天然幂等：同一时刻重复跑，第二次 delta=0，什么都不发。
 *
 * ⚠️ 首次上线必须先 seed（把游标设成当前累计值、不发钱），否则第一次结算会把
 * 全部历史点赞/收藏/金币消耗一次性补发。见 seedCursors / run-daily-rebate.ts --seed。
 */

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  characterFavorites,
  characterLikes,
  characters,
  chatSessions,
  creatorCharacterCursors,
  creatorEarningRecords,
  creatorFansCursors,
  currencyTransactions,
  userFollows,
  users,
} from "../db/schema";
import {
  type CharacterAggregate,
  type CharacterCursor,
  computeCharacterRebate,
  computeFansRebate,
  type RebateLineItem,
  round2,
} from "./compute";

export type { RebateLineItem } from "./compute";
export { REBATE_RATES } from "./compute";

export interface RebateRunResult {
  /** 是否只算不写 */
  dryRun: boolean;
  /** 结算涉及的角色数 */
  charactersScanned: number;
  /** 产生进账的作者数 */
  creatorsPaid: number;
  /** 总发放金额 */
  totalPaid: number;
  /** 逐条明细（dry-run 时给人看，真跑时也返回便于日志） */
  items: RebateLineItem[];
}

/**
 * 一次性查出所有角色的当前累计量。
 * - likes / favorites：各自表 count group by character
 * - goldConsumed：currency_transactions 金币扣费（amount<0）经 session → character
 *   聚合。取绝对值累加。model_usage 里也含美化包/图片扣费，但那些没有 sessionId，
 *   join 不到 character，自然被排除——只有真正的「跟这个角色对话」的扣费计入。
 */
async function aggregateCharacters(): Promise<Map<string, CharacterAggregate>> {
  const map = new Map<string, CharacterAggregate>();

  // 所有角色（含 0 互动的）作为底，保证游标能覆盖新角色。
  // conversationCount 已去标准化在 characters 表，直接取。
  const allChars = await db
    .select({
      id: characters.id,
      ownerId: characters.ownerId,
      conversations: characters.conversationCount,
    })
    .from(characters);
  for (const c of allChars) {
    map.set(c.id, {
      characterId: c.id,
      ownerId: c.ownerId,
      likes: 0,
      favorites: 0,
      goldConsumed: 0,
      conversations: c.conversations,
    });
  }

  // 点赞累计
  const likeRows = await db
    .select({
      characterId: characterLikes.characterId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(characterLikes)
    .groupBy(characterLikes.characterId);
  for (const r of likeRows) {
    const agg = map.get(r.characterId);
    if (agg) agg.likes = r.cnt;
  }

  // 收藏累计
  const favRows = await db
    .select({
      characterId: characterFavorites.characterId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(characterFavorites)
    .groupBy(characterFavorites.characterId);
  for (const r of favRows) {
    const agg = map.get(r.characterId);
    if (agg) agg.favorites = r.cnt;
  }

  // 金币「净消耗」累计（对话/续写）。关键：不能只 SUM 负数扣费——退款也走
  // model_usage 且带 sessionId（amount>0），必须抵扣，否则「扣了又退」仍被算进
  // 返利基数导致偏高。故对所有金币 model_usage 求 SUM(-amount)：扣费(负)→正累加，
  // 退款(正)→负抵扣，得到净消耗。美化包/图片扣费无 sessionId，join 不到角色被排除。
  // GREATEST(...,0) 兜底：极端下退款>扣费不至于出负数污染游标。
  const goldRows = await db
    .select({
      characterId: chatSessions.characterId,
      consumed: sql<number>`GREATEST(COALESCE(SUM(-${currencyTransactions.amount}), 0), 0)::int`,
    })
    .from(currencyTransactions)
    .innerJoin(
      chatSessions,
      eq(chatSessions.id, currencyTransactions.sessionId),
    )
    .where(
      and(
        eq(currencyTransactions.currencyType, "gold"),
        eq(currencyTransactions.transactionType, "model_usage"),
        isNotNull(currencyTransactions.sessionId),
      ),
    )
    .groupBy(chatSessions.characterId);
  for (const r of goldRows) {
    // characterId 为 null = 孤儿会话：角色卡随创作者注销一起被删（migration
    // 0042 把 chat_sessions.character_id 改成 SET NULL）。这里**有意**跳过 ——
    // 角色和作者都没了，这些消耗不该再产生任何返利，也没有 owner 可以入账。
    if (r.characterId === null) continue;
    const agg = map.get(r.characterId);
    if (agg) agg.goldConsumed = r.consumed;
  }

  return map;
}

/**
 * 结算一次。dryRun=true 只算不写（推荐先跑一次核对数字）。
 */
export async function runDailyRebate(
  opts: { dryRun?: boolean } = {},
): Promise<RebateRunResult> {
  const dryRun = opts.dryRun ?? false;
  const aggregates = await aggregateCharacters();

  // 载入现有角色游标
  const charIds = [...aggregates.keys()];
  const charCursors = new Map<string, CharacterCursor>();
  if (charIds.length > 0) {
    const rows = await db
      .select()
      .from(creatorCharacterCursors)
      .where(inArray(creatorCharacterCursors.characterId, charIds));
    for (const r of rows) {
      charCursors.set(r.characterId, {
        lastGoldConsumed: r.lastGoldConsumed,
        likesSettled: r.likesSettled,
        favoritesSettled: r.favoritesSettled,
        conversationsSettled: r.conversationsSettled,
      });
    }
  }

  // 粉丝累计（按作者）
  const fansRows = await db
    .select({
      userId: userFollows.followingId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(userFollows)
    .groupBy(userFollows.followingId);
  const fansNow = new Map<string, number>();
  for (const r of fansRows) fansNow.set(r.userId, r.cnt);

  const fansCursorRows = await db.select().from(creatorFansCursors);
  const fansCursor = new Map<string, number>();
  for (const r of fansCursorRows) fansCursor.set(r.userId, r.fansSettled);

  const items: RebateLineItem[] = [];
  // 每作者累计发放（用于一次性 UPDATE users.creator_earnings）
  const creatorTotals = new Map<string, number>();
  // 游标推进目标
  const nextCharCursor = new Map<string, CharacterCursor>();
  const nextFansCursor = new Map<string, number>();

  const addItem = (item: RebateLineItem) => {
    items.push(item);
    creatorTotals.set(
      item.userId,
      (creatorTotals.get(item.userId) ?? 0) + item.amount,
    );
  };

  // ── 逐角色结算对话 / 点赞 / 收藏（纯计算在 compute.ts） ──
  for (const agg of aggregates.values()) {
    const { items: charItems, nextCursor } = computeCharacterRebate(
      agg,
      charCursors.get(agg.characterId),
    );
    for (const it of charItems) addItem(it);
    nextCharCursor.set(agg.characterId, nextCursor);
  }

  // ── 逐作者结算粉丝 ──
  for (const [userId, count] of fansNow) {
    const { item, nextSettled } = computeFansRebate(
      userId,
      count,
      fansCursor.get(userId) ?? 0,
    );
    if (item) addItem(item);
    nextFansCursor.set(userId, nextSettled);
  }

  const totalPaid = round2(
    [...creatorTotals.values()].reduce((a, b) => a + b, 0),
  );

  const result: RebateRunResult = {
    dryRun,
    charactersScanned: aggregates.size,
    creatorsPaid: [...creatorTotals.keys()].filter(
      (u) => (creatorTotals.get(u) ?? 0) > 0,
    ).length,
    totalPaid,
    items,
  };

  // dry-run 只算不写。注意：真跑即使本轮无进账（items 为空）也要推进游标——
  // 对话数可能只增长不产生金币消耗（对话不直接发钱），游标不推进会让总览「新增」
  // 一直累积不归零。故不再用 items.length===0 短路整个写入。
  if (dryRun) {
    return result;
  }

  // ── 落库：一个事务里写记录 + 累加余额 + 推进游标 ──
  await db.transaction(async (tx) => {
    if (items.length > 0) {
      await tx.insert(creatorEarningRecords).values(
        items.map((it) => ({
          userId: it.userId,
          characterId: it.characterId,
          kind: it.kind,
          amount: it.amount.toFixed(2),
          detail: it.detail,
        })),
      );
    }

    for (const [userId, amount] of creatorTotals) {
      if (amount <= 0) continue;
      await tx
        .update(users)
        .set({
          creatorEarnings: sql`${users.creatorEarnings} + ${amount.toFixed(2)}`,
        })
        .where(eq(users.id, userId));
    }

    // upsert 角色游标
    for (const [characterId, c] of nextCharCursor) {
      await tx
        .insert(creatorCharacterCursors)
        .values({
          characterId,
          lastGoldConsumed: c.lastGoldConsumed,
          likesSettled: c.likesSettled,
          favoritesSettled: c.favoritesSettled,
          conversationsSettled: c.conversationsSettled,
        })
        .onConflictDoUpdate({
          target: creatorCharacterCursors.characterId,
          set: {
            lastGoldConsumed: c.lastGoldConsumed,
            likesSettled: c.likesSettled,
            favoritesSettled: c.favoritesSettled,
            conversationsSettled: c.conversationsSettled,
            updatedAt: new Date(),
          },
        });
    }

    // upsert 粉丝游标
    for (const [userId, fansSettled] of nextFansCursor) {
      await tx
        .insert(creatorFansCursors)
        .values({ userId, fansSettled })
        .onConflictDoUpdate({
          target: creatorFansCursors.userId,
          set: { fansSettled, updatedAt: new Date() },
        });
    }
  });

  return result;
}

/**
 * 首次上线播种游标 —— 把所有游标设成当前累计值，不发任何钱。
 * 之后第一次 runDailyRebate 只会对播种之后的新增量返利。
 */
export async function seedCursors(): Promise<{
  characters: number;
  creators: number;
}> {
  const aggregates = await aggregateCharacters();

  const fansRows = await db
    .select({
      userId: userFollows.followingId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(userFollows)
    .groupBy(userFollows.followingId);

  await db.transaction(async (tx) => {
    for (const agg of aggregates.values()) {
      await tx
        .insert(creatorCharacterCursors)
        .values({
          characterId: agg.characterId,
          lastGoldConsumed: agg.goldConsumed,
          likesSettled: agg.likes,
          favoritesSettled: agg.favorites,
          conversationsSettled: agg.conversations,
        })
        .onConflictDoUpdate({
          target: creatorCharacterCursors.characterId,
          set: {
            lastGoldConsumed: agg.goldConsumed,
            likesSettled: agg.likes,
            favoritesSettled: agg.favorites,
            conversationsSettled: agg.conversations,
            updatedAt: new Date(),
          },
        });
    }
    for (const r of fansRows) {
      await tx
        .insert(creatorFansCursors)
        .values({ userId: r.userId, fansSettled: r.cnt })
        .onConflictDoUpdate({
          target: creatorFansCursors.userId,
          set: { fansSettled: r.cnt, updatedAt: new Date() },
        });
    }
  });

  return { characters: aggregates.size, creators: fansRows.length };
}
