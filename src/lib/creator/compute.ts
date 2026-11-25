/**
 * 创作者返利的纯计算核心 —— 不碰 DB，输入累计量 + 游标，输出进账明细 + 新游标。
 *
 * 抽出来的目的：算钱逻辑是整个功能最不能错的地方，纯函数可以脱离数据库直接
 * 单元测试（见 __tests__/compute.test.ts）。rebate.ts 负责从库里查 aggregate
 * 和游标喂进来、把结果落库，两边职责分离。
 *
 * 规则见 REBATE_RATES。防刷靠高水位游标：只对「当前累计 − 上次快照」的正增量
 * 返利。对话金币按 3 一档，余数结转（游标只前进已发档位）；点赞/收藏/粉丝对齐
 * 当前高水位（快照只增不减）。
 */

/** 返利费率单一来源。改这里即改全站口径。 */
export const REBATE_RATES = {
  /** 对话：每消耗多少金币算一档 */
  dialogueGoldPerUnit: 3,
  /** 对话：每档返多少金币 */
  dialogueRebatePerUnit: 0.6,
  /** 点赞：每个净增点赞返多少金币 */
  likePerCount: 1,
  /** 收藏：每个净增收藏返多少金币 */
  favoritePerCount: 1,
  /** 粉丝：每个净增粉丝返多少金币 */
  fansPerCount: 3,
} as const;

export interface RebateLineItem {
  userId: string;
  characterId: string | null;
  kind: "dialogue" | "like" | "favorite" | "fans";
  amount: number;
  detail: Record<string, number>;
}

/** 每角色当前累计量。 */
export interface CharacterAggregate {
  characterId: string;
  ownerId: string;
  likes: number;
  favorites: number;
  goldConsumed: number;
  /** 对话条数（conversation_count）。只用于总览增量基线，不参与发钱。 */
  conversations: number;
}

/** 每角色游标（上次结算快照）。 */
export interface CharacterCursor {
  lastGoldConsumed: number;
  likesSettled: number;
  favoritesSettled: number;
  /** 对话条数快照。仅增量展示用，不参与发钱。 */
  conversationsSettled: number;
}

export interface ComputedCharacter {
  items: RebateLineItem[];
  nextCursor: CharacterCursor;
}

/** 保留两位小数，避开二进制浮点尾差（0.1+0.2 类）。 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 结算单个角色的对话 / 点赞 / 收藏三个维度。
 * cursor 为 undefined 表示该角色首次结算（从 0 起算）。
 */
export function computeCharacterRebate(
  agg: CharacterAggregate,
  cursor: CharacterCursor | undefined,
): ComputedCharacter {
  const cur: CharacterCursor = cursor ?? {
    lastGoldConsumed: 0,
    likesSettled: 0,
    favoritesSettled: 0,
    conversationsSettled: 0,
  };
  const items: RebateLineItem[] = [];

  // 对话：新增金币消耗 → 满 3 金币一档发 0.6，余数结转（游标只前进已发档位）
  const goldDelta = Math.max(0, agg.goldConsumed - cur.lastGoldConsumed);
  const units = Math.floor(goldDelta / REBATE_RATES.dialogueGoldPerUnit);
  const dialogueAmount = round2(units * REBATE_RATES.dialogueRebatePerUnit);
  const goldAdvance = units * REBATE_RATES.dialogueGoldPerUnit;
  if (dialogueAmount > 0) {
    items.push({
      userId: agg.ownerId,
      characterId: agg.characterId,
      kind: "dialogue",
      amount: dialogueAmount,
      detail: { goldConsumed: goldDelta, units, gold: goldAdvance },
    });
  }

  // 点赞：净增 × 1
  const likeDelta = Math.max(0, agg.likes - cur.likesSettled);
  const likeAmount = round2(likeDelta * REBATE_RATES.likePerCount);
  if (likeAmount > 0) {
    items.push({
      userId: agg.ownerId,
      characterId: agg.characterId,
      kind: "like",
      amount: likeAmount,
      detail: { likeDelta },
    });
  }

  // 收藏：净增 × 1
  const favDelta = Math.max(0, agg.favorites - cur.favoritesSettled);
  const favAmount = round2(favDelta * REBATE_RATES.favoritePerCount);
  if (favAmount > 0) {
    items.push({
      userId: agg.ownerId,
      characterId: agg.characterId,
      kind: "favorite",
      amount: favAmount,
      detail: { favDelta },
    });
  }

  return {
    items,
    nextCursor: {
      // 对话金币只前进已发档位（余数下次再攒），点赞/收藏对齐当前高水位
      lastGoldConsumed: cur.lastGoldConsumed + goldAdvance,
      likesSettled: Math.max(cur.likesSettled, agg.likes),
      favoritesSettled: Math.max(cur.favoritesSettled, agg.favorites),
      // 对话条数对齐当前（仅增量展示基线，掉了也用高水位防负）
      conversationsSettled: Math.max(
        cur.conversationsSettled,
        agg.conversations,
      ),
    },
  };
}

/**
 * 结算单个作者的粉丝维度。
 * settled 为上次快照（首次传 0）。返回进账（可能为 null）+ 新游标值。
 */
export function computeFansRebate(
  userId: string,
  fansNow: number,
  settled: number,
): { item: RebateLineItem | null; nextSettled: number } {
  const fanDelta = Math.max(0, fansNow - settled);
  const fanAmount = round2(fanDelta * REBATE_RATES.fansPerCount);
  const item: RebateLineItem | null =
    fanAmount > 0
      ? {
          userId,
          characterId: null,
          kind: "fans",
          amount: fanAmount,
          detail: { fanDelta },
        }
      : null;
  return { item, nextSettled: Math.max(settled, fansNow) };
}
