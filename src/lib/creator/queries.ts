/**
 * 创作收益 tab 的读侧查询。
 *
 * 展示三块：
 *   - 累计返利余额（users.creator_earnings，独立于消费金币 gold_balance）
 *   - 生涯累计四项数据（总对话 / 总收藏 / 总点赞 / 总粉丝）+ 各自「新增 ▲」
 *   - 收益明细流水（creator_earning_records，角色 / 收益 / 时间）
 *
 * 「总对话数」用 characters.conversation_count 之和（已去标准化，口径 = 累计
 * user message 条数）。点赞/收藏/粉丝走各自表 count。这些是「展示数据」，跟返利
 * 结算的「金币消耗」口径无关——总览给创作者看规模，明细给看实际进账。
 *
 * 「新增」= 当前累计 − 上次早 8 点结算时的游标快照（clamp ≥0）。对齐同类平台的
 * 增量展示，让创作者直观看到「自上次结算以来涨了多少」。结算后归零、当天随互动
 * 增长。游标快照来自 creator_character_cursors（对话/点赞/收藏）+ creator_fans_cursors。
 */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  characterFavorites,
  characterLikes,
  characters,
  creatorCharacterCursors,
  creatorEarningRecords,
  creatorFansCursors,
  userFollows,
  users,
} from "@/lib/db/schema";

export interface CreatorEarningsOverview {
  /** 累计返利余额（金币，可含小数） */
  totalEarnings: number;
  /** 生涯累计总对话数（名下所有角色 conversation_count 之和） */
  totalConversations: number;
  /** 生涯累计总收藏数 */
  totalFavorites: number;
  /** 生涯累计总点赞数 */
  totalLikes: number;
  /** 生涯累计总粉丝数 */
  totalFans: number;
  /** 自上次结算以来的新增（clamp ≥0），对应上面四项 */
  deltaConversations: number;
  deltaFavorites: number;
  deltaLikes: number;
  deltaFans: number;
}

export interface CreatorEarningDetailRow {
  id: string;
  /** 关联角色名；粉丝返利为 null（UI 显示「新增粉丝」） */
  characterName: string | null;
  kind: "dialogue" | "like" | "favorite" | "fans";
  amount: number;
  createdAt: Date;
}

/**
 * 收益总览：余额大数字 + 四项生涯数据。
 * 一次并发查完，避免串行等待。
 */
export async function getCreatorEarningsOverview(
  userId: string,
): Promise<CreatorEarningsOverview> {
  const [earningsRow, charAgg, likesRow, favRow, fansRow, charCursor, fansCur] =
    await Promise.all([
      // 余额
      db
        .select({ earnings: users.creatorEarnings })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      // 角色数 + 总对话数
      db
        .select({
          conversations: sql<number>`COALESCE(SUM(${characters.conversationCount}), 0)::int`,
        })
        .from(characters)
        .where(eq(characters.ownerId, userId)),
      // 总点赞（名下所有角色被赞条数）
      db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(characterLikes)
        .innerJoin(characters, eq(characters.id, characterLikes.characterId))
        .where(eq(characters.ownerId, userId)),
      // 总收藏
      db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(characterFavorites)
        .innerJoin(
          characters,
          eq(characters.id, characterFavorites.characterId),
        )
        .where(eq(characters.ownerId, userId)),
      // 总粉丝
      db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(userFollows)
        .where(eq(userFollows.followingId, userId)),
      // 上次结算快照：名下所有角色游标之和（对话/点赞/收藏）
      db
        .select({
          conversations: sql<number>`COALESCE(SUM(${creatorCharacterCursors.conversationsSettled}), 0)::int`,
          likes: sql<number>`COALESCE(SUM(${creatorCharacterCursors.likesSettled}), 0)::int`,
          favorites: sql<number>`COALESCE(SUM(${creatorCharacterCursors.favoritesSettled}), 0)::int`,
        })
        .from(creatorCharacterCursors)
        .innerJoin(
          characters,
          eq(characters.id, creatorCharacterCursors.characterId),
        )
        .where(eq(characters.ownerId, userId)),
      // 上次结算快照：粉丝
      db
        .select({ fans: creatorFansCursors.fansSettled })
        .from(creatorFansCursors)
        .where(eq(creatorFansCursors.userId, userId))
        .limit(1),
    ]);

  const totalConversations = charAgg[0]?.conversations ?? 0;
  const totalFavorites = favRow[0]?.cnt ?? 0;
  const totalLikes = likesRow[0]?.cnt ?? 0;
  const totalFans = fansRow[0]?.cnt ?? 0;

  // 新增 = 当前累计 − 上次结算快照，clamp ≥0（快照缺失按 0 起算 = 全量算新增）
  const clampDelta = (total: number, settled: number) =>
    Math.max(0, total - settled);

  return {
    // numeric 以 string 返回，parseFloat 转数字
    totalEarnings: Number.parseFloat(earningsRow[0]?.earnings ?? "0"),
    totalConversations,
    totalFavorites,
    totalLikes,
    totalFans,
    deltaConversations: clampDelta(
      totalConversations,
      charCursor[0]?.conversations ?? 0,
    ),
    deltaFavorites: clampDelta(totalFavorites, charCursor[0]?.favorites ?? 0),
    deltaLikes: clampDelta(totalLikes, charCursor[0]?.likes ?? 0),
    deltaFans: clampDelta(totalFans, fansCur[0]?.fans ?? 0),
  };
}

/**
 * 收益明细：按时间倒序的返利流水。角色名 left join（粉丝行 character_id 为 null）。
 */
export async function getCreatorEarningDetails(
  userId: string,
  limit = 100,
): Promise<CreatorEarningDetailRow[]> {
  const rows = await db
    .select({
      id: creatorEarningRecords.id,
      characterName: characters.name,
      kind: creatorEarningRecords.kind,
      amount: creatorEarningRecords.amount,
      createdAt: creatorEarningRecords.createdAt,
    })
    .from(creatorEarningRecords)
    .leftJoin(characters, eq(characters.id, creatorEarningRecords.characterId))
    .where(eq(creatorEarningRecords.userId, userId))
    .orderBy(desc(creatorEarningRecords.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    characterName: r.characterName,
    kind: r.kind,
    amount: Number.parseFloat(r.amount),
    createdAt: r.createdAt,
  }));
}
