import { describe, expect, test } from "bun:test";
import {
  type CharacterAggregate,
  computeCharacterRebate,
  computeFansRebate,
  REBATE_RATES,
  round2,
} from "@/lib/creator/compute";

const agg = (over: Partial<CharacterAggregate> = {}): CharacterAggregate => ({
  characterId: "char-1",
  ownerId: "user-1",
  likes: 0,
  favorites: 0,
  goldConsumed: 0,
  conversations: 0,
  ...over,
});

describe("computeCharacterRebate — 对话金币", () => {
  test("首次结算：30 金币 → 10 档 → 6 金币", () => {
    const r = computeCharacterRebate(agg({ goldConsumed: 30 }), undefined);
    const d = r.items.find((i) => i.kind === "dialogue");
    expect(d?.amount).toBe(6);
    // 游标前进到已发档位 = 30（整除，无余数）
    expect(r.nextCursor.lastGoldConsumed).toBe(30);
  });

  test("余数结转：8 金币 → 2 档发 1.2，游标只前进 6，余 2 留存", () => {
    const r = computeCharacterRebate(agg({ goldConsumed: 8 }), undefined);
    const d = r.items.find((i) => i.kind === "dialogue");
    expect(d?.amount).toBe(1.2);
    expect(r.nextCursor.lastGoldConsumed).toBe(6);
  });

  test("余数跨次累积：先 8（余2），再到 13（新增5+余2=7）→ 2 档发 1.2", () => {
    const first = computeCharacterRebate(agg({ goldConsumed: 8 }), undefined);
    // 第二次：累计 goldConsumed=13，游标在 6 → delta=7 → 2 档
    const second = computeCharacterRebate(
      agg({ goldConsumed: 13 }),
      first.nextCursor,
    );
    const d = second.items.find((i) => i.kind === "dialogue");
    expect(d?.amount).toBe(1.2);
    expect(second.nextCursor.lastGoldConsumed).toBe(12);
  });

  test("不足一档：2 金币 → 不发，游标不动", () => {
    const r = computeCharacterRebate(agg({ goldConsumed: 2 }), undefined);
    expect(r.items.find((i) => i.kind === "dialogue")).toBeUndefined();
    expect(r.nextCursor.lastGoldConsumed).toBe(0);
  });

  test("无新增：goldConsumed 等于游标 → 不发", () => {
    const r = computeCharacterRebate(agg({ goldConsumed: 30 }), {
      lastGoldConsumed: 30,
      likesSettled: 0,
      favoritesSettled: 0,
      conversationsSettled: 0,
    });
    expect(r.items.find((i) => i.kind === "dialogue")).toBeUndefined();
  });
});

describe("computeCharacterRebate — 点赞 / 收藏（高水位防刷）", () => {
  test("首次 5 赞 → 返 5", () => {
    const r = computeCharacterRebate(agg({ likes: 5 }), undefined);
    expect(r.items.find((i) => i.kind === "like")?.amount).toBe(5);
    expect(r.nextCursor.likesSettled).toBe(5);
  });

  test("净增才返：从 5 涨到 8 → 只返 3", () => {
    const r = computeCharacterRebate(agg({ likes: 8 }), {
      lastGoldConsumed: 0,
      likesSettled: 5,
      favoritesSettled: 0,
      conversationsSettled: 0,
    });
    expect(r.items.find((i) => i.kind === "like")?.amount).toBe(3);
    expect(r.nextCursor.likesSettled).toBe(8);
  });

  test("取消刷分防护：赞数从 8 掉到 6 → 不返，游标保持高水位 8", () => {
    const r = computeCharacterRebate(agg({ likes: 6 }), {
      lastGoldConsumed: 0,
      likesSettled: 8,
      favoritesSettled: 0,
      conversationsSettled: 0,
    });
    expect(r.items.find((i) => i.kind === "like")).toBeUndefined();
    expect(r.nextCursor.likesSettled).toBe(8);
  });

  test("掉了又涨回来不重复发：8→6→8，第二段 delta=0", () => {
    // 高水位停在 8，再次到 8 → max(8,8)-8=0
    const r = computeCharacterRebate(agg({ likes: 8 }), {
      lastGoldConsumed: 0,
      likesSettled: 8,
      favoritesSettled: 0,
      conversationsSettled: 0,
    });
    expect(r.items.find((i) => i.kind === "like")).toBeUndefined();
  });

  test("收藏同理：首次 3 → 返 3", () => {
    const r = computeCharacterRebate(agg({ favorites: 3 }), undefined);
    expect(r.items.find((i) => i.kind === "favorite")?.amount).toBe(3);
    expect(r.nextCursor.favoritesSettled).toBe(3);
  });
});

describe("computeCharacterRebate — 组合 & 归属", () => {
  test("三维度同时产出，都归到 ownerId", () => {
    const r = computeCharacterRebate(
      agg({ goldConsumed: 9, likes: 2, favorites: 1, ownerId: "author-x" }),
      undefined,
    );
    expect(r.items).toHaveLength(3);
    expect(r.items.every((i) => i.userId === "author-x")).toBe(true);
    expect(r.items.every((i) => i.characterId === "char-1")).toBe(true);
  });

  test("零互动角色不产出 item，但游标仍归位（覆盖新角色）", () => {
    const r = computeCharacterRebate(agg(), undefined);
    expect(r.items).toHaveLength(0);
    expect(r.nextCursor).toEqual({
      lastGoldConsumed: 0,
      likesSettled: 0,
      favoritesSettled: 0,
      conversationsSettled: 0,
    });
  });
});

describe("computeCharacterRebate — 对话条数游标（增量展示基线，不发钱）", () => {
  test("对话数推进到当前，但不产生 dialogue 进账（对话返利靠金币）", () => {
    const r = computeCharacterRebate(agg({ conversations: 42 }), undefined);
    // 只有对话条数、没有金币消耗 → 不发钱
    expect(r.items).toHaveLength(0);
    // 游标对齐当前对话数，供总览「新增」下次归零
    expect(r.nextCursor.conversationsSettled).toBe(42);
  });

  test("对话数高水位：掉了不倒退", () => {
    const r = computeCharacterRebate(agg({ conversations: 30 }), {
      lastGoldConsumed: 0,
      likesSettled: 0,
      favoritesSettled: 0,
      conversationsSettled: 50,
    });
    expect(r.nextCursor.conversationsSettled).toBe(50);
  });
});

describe("computeFansRebate", () => {
  test("每粉丝返 3：首次 4 粉 → 12", () => {
    const { item, nextSettled } = computeFansRebate("u1", 4, 0);
    expect(item?.amount).toBe(12);
    expect(item?.characterId).toBeNull();
    expect(item?.kind).toBe("fans");
    expect(nextSettled).toBe(4);
  });

  test("净增：从 4 到 6 → 返 6（2×3）", () => {
    const { item, nextSettled } = computeFansRebate("u1", 6, 4);
    expect(item?.amount).toBe(6);
    expect(nextSettled).toBe(6);
  });

  test("掉粉不倒扣，游标保持高水位", () => {
    const { item, nextSettled } = computeFansRebate("u1", 3, 6);
    expect(item).toBeNull();
    expect(nextSettled).toBe(6);
  });
});

describe("费率常量 & round2", () => {
  test("费率符合需求文档口径", () => {
    expect(REBATE_RATES.dialogueGoldPerUnit).toBe(3);
    expect(REBATE_RATES.dialogueRebatePerUnit).toBe(0.6);
    expect(REBATE_RATES.likePerCount).toBe(1);
    expect(REBATE_RATES.favoritePerCount).toBe(1);
    expect(REBATE_RATES.fansPerCount).toBe(3);
  });

  test("round2 消除浮点尾差", () => {
    // 0.6 * 3 = 1.7999999999999998 → 1.8
    expect(round2(0.6 * 3)).toBe(1.8);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  test("多档累加不产生尾差：7 档 × 0.6 = 4.2", () => {
    const r = computeCharacterRebate(agg({ goldConsumed: 21 }), undefined);
    expect(r.items.find((i) => i.kind === "dialogue")?.amount).toBe(4.2);
  });
});
