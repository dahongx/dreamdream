import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { truncateHistory } from "@/lib/ai/history-truncate";

// 每条 ~2000 char, 200 条 = 400K char, 超默认 300K 预算
function makeMessages(
  count: number,
  roleStart: "user" | "assistant" = "user",
): ModelMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === (roleStart === "user" ? 0 : 1) ? "user" : "assistant",
    content: "x".repeat(2000),
  })) as ModelMessage[];
}

describe("truncateHistory", () => {
  test("short history returns unchanged", () => {
    const msgs = makeMessages(10);
    const r = truncateHistory(msgs);
    expect(r.truncated).toBe(false);
    expect(r.messages.length).toBe(10);
    expect(r.original).toBe(10);
  });

  test("long history is cut to fit char budget", () => {
    const msgs = makeMessages(200); // ~400K char，超 300K 默认预算
    const r = truncateHistory(msgs);
    expect(r.truncated).toBe(true);
    expect(r.kept).toBeLessThan(200);
    expect(r.kept).toBeGreaterThanOrEqual(20); // MIN_KEEP_TAIL
    expect(r.charsKept).toBeLessThanOrEqual(310_000); // budget + one msg overflow
  });

  test("preserves opening (first assistant) when history is truncated", () => {
    const msgs: ModelMessage[] = [
      { role: "assistant", content: "OPENING" }, // 短开场白
      ...makeMessages(200, "user").slice(0, 200), // 200 条大消息
    ];
    const r = truncateHistory(msgs);
    expect(r.truncated).toBe(true);
    expect(r.messages[0].content).toBe("OPENING");
    expect(r.messages[0].role).toBe("assistant");
  });

  test("first non-opening message after truncation is user (never assistant/assistant)", () => {
    // 首条不是 assistant opening 的情况
    const msgs = makeMessages(200, "user");
    const r = truncateHistory(msgs);
    expect(r.messages[0].role).toBe("user");
  });

  test("first message after opening is user", () => {
    const msgs: ModelMessage[] = [
      { role: "assistant", content: "OPENING" },
      ...makeMessages(200, "user"),
    ];
    const r = truncateHistory(msgs);
    // 开场白后紧跟的应该是 user (要不然 opening/assistant 连续会被 provider 合并/拒绝)
    if (r.messages.length > 1) {
      expect(r.messages[1].role).toBe("user");
    }
  });

  test("respects MIN_KEEP even when messages exceed budget individually", () => {
    // 每条 400K char，单条就超 300K 预算
    const huge = Array.from({ length: 25 }, () => ({
      role: "user" as const,
      content: "y".repeat(400_000),
    })) as ModelMessage[];
    const r = truncateHistory(huge);
    // 应保底 20 条（就算总字符早已超预算）
    expect(r.kept).toBeGreaterThanOrEqual(20);
  });

  test("estimates array-content messages by summing text parts", () => {
    const msgs: ModelMessage[] = Array.from({ length: 200 }, () => ({
      role: "user" as const,
      content: [
        { type: "text" as const, text: "a".repeat(1000) },
        { type: "text" as const, text: "b".repeat(1000) },
      ],
    }));
    const r = truncateHistory(msgs);
    expect(r.truncated).toBe(true);
    expect(r.charsKept).toBeLessThanOrEqual(310_000);
  });

  test("returns 0 chars for unrecognized content shape without crashing", () => {
    const msgs = [
      { role: "user", content: { weird: true } as unknown as string },
    ] as ModelMessage[];
    const r = truncateHistory(msgs);
    expect(r.truncated).toBe(false);
    expect(r.charsKept).toBe(0);
  });

  // ── 量化滞回：窗口起点稳定性（prompt cache 命中的前提）──

  // 每条恰好 2000 char，内容带序号，便于断言窗口起点落在哪条
  function makeTagged(count: number): ModelMessage[] {
    return Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: String(i).padStart(4, "0") + "x".repeat(1996),
    })) as ModelMessage[];
  }

  test("cut point stays fixed while history grows within one step band", () => {
    // 210 条 = 420K，(total-300K)=120K → dropTarget 量化到 200K → 砍前 100 条
    const r1 = truncateHistory(makeTagged(210));
    // 追加 4 条（+8K，仍在同一档）→ dropTarget 不变 → 窗口起点不动
    const r2 = truncateHistory(makeTagged(214));
    expect((r1.messages[0].content as string).slice(0, 4)).toBe("0100");
    expect((r2.messages[0].content as string).slice(0, 4)).toBe("0100");
    // r2 是 r1 的严格前缀延长：旧消息逐条一致，只在尾部追加 → cache 可命中
    for (let i = 0; i < r1.messages.length; i++) {
      expect(r2.messages[i].content).toBe(r1.messages[i].content);
    }
  });

  test("cut point advances by one whole step when total crosses band boundary", () => {
    // 255 条 = 510K，(total-300K)=210K → dropTarget 量化到 300K → 砍前 150 条
    const r = truncateHistory(makeTagged(255));
    expect((r.messages[0].content as string).slice(0, 4)).toBe("0150");
    expect(r.messages[0].role).toBe("user");
  });

  test("kept chars never exceed budget in the quantized regime", () => {
    for (const n of [160, 200, 250, 300, 400]) {
      const r = truncateHistory(makeTagged(n));
      expect(r.charsKept).toBeLessThanOrEqual(300_000);
    }
  });
});
