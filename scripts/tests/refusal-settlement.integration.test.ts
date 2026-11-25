// Run in its own process: bun test scripts/tests/refusal-settlement.integration.test.ts
// Real route + AI SDK stream lifecycle; only database, auth, billing and provider are simulated.
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";
import { NextRequest } from "next/server";
import {
  characters,
  chatSessions,
  messages,
  users,
} from "../../src/lib/db/schema";

type Row = Record<string, unknown>;
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const characterId = "33333333-3333-4333-8333-333333333333";
const userMessageId = "44444444-4444-4444-8444-444444444444";
const oldId = "55555555-5555-4555-8555-555555555555";
const refusal = "我无法参与包含浪漫、亲密关系或虚构恋爱桥段的互动与文学创作。";
let rows: Row[] = [];
let answer = refusal;
let finish: "stop" | "content-filter" = "stop";
let providerError: Error | null = null;
let balance = 100;
const refunds: number[] = [];
const attempts: Row[] = [];
let settlements = 0;

function selection() {
  let table: unknown;
  const read = () =>
    table === chatSessions
      ? [{ id: sessionId, userId, characterId, title: "test" }]
      : table === characters
        ? [{ id: characterId, name: "测试角色" }]
        : table === users
          ? [{ name: "测试玩家" }]
          : rows.filter((r) => !r.supersededAt);
  const query = {
    from(value: unknown) {
      table = value;
      return query;
    },
    where(_condition: unknown) {
      return query;
    },
    orderBy(_order: unknown) {
      return query;
    },
    limit(_limit: number) {
      return Promise.resolve(read().slice(-1));
    },
    // biome-ignore lint/suspicious/noThenProperty: emulate Drizzle's awaitable query builder in this isolated test.
    then(
      resolve: (value: Row[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(read()).then(resolve, reject);
    },
  };
  return query;
}
const transactionDb = {
  select: selection,
  async execute() {
    return [{ got: true }];
  },
  insert(_table: unknown) {
    return {
      values(value: Row) {
        const row = {
          ...value,
          id: value.id ?? crypto.randomUUID(),
          createdAt: new Date(),
        };
        rows.push(row);
        return { returning: async () => [row] };
      },
    };
  },
  update(table: unknown) {
    return {
      set(value: Row) {
        return {
          where(_condition: unknown) {
            if (table === messages) Object.assign(rows.at(-1) ?? {}, value);
            return Object.assign(Promise.resolve(), {
              returning: async () => [{ id: rows.at(-1)?.id }],
            });
          },
        };
      },
    };
  },
};
const db = {
  ...transactionDb,
  async transaction<T>(
    fn: (tx: typeof transactionDb) => Promise<T>,
  ): Promise<T> {
    return fn(transactionDb);
  },
};
mock.module("@/lib/db/client", () => ({ db }));
mock.module("@/i18n/dictionaries", () => ({ getDictionary: async () => ({}) }));
mock.module("@/lib/auth/current-user", () => ({
  getCurrentUserId: async () => userId,
}));
mock.module("@/lib/auth/dev-allowlist", () => ({
  isDeveloperEmail: () => false,
}));
mock.module("@/lib/ai/health-check", () => ({
  getModelHealthStatus: async () => "healthy",
  isModelAvailable: () => true,
}));
mock.module("@/lib/ai/model-status", () => ({
  recordModelAttempt: async (value: Row) => {
    attempts.push(value);
  },
}));
mock.module("@/lib/ai/build-prompt", () => ({
  buildSystemPrompt: () => "Ordinary story.",
  resolveUserName: () => "玩家",
  interpolate: (text: string) => text,
}));
mock.module("@/lib/masks/queries", () => ({
  getSessionActiveMask: async () => null,
}));
mock.module("@/lib/regex/queries", () => ({
  loadRulesAndPrefs: async () => ({ rules: [], userPrefs: new Map() }),
}));
mock.module("@/lib/regex/prompt", () => ({ filterRulesForUser: () => [] }));
mock.module("@/lib/regex/apply", () => ({
  applyRegex: (text: string) => ({
    text,
    matchedRules: [],
    unmatchedRules: [],
  }),
}));
mock.module("@/lib/ai/pricing", () => ({
  calculateCostMillicents: async () => 10,
  calculateCnyMillicents: () => 70,
  extractUsageDetails: () => ({ inputTokens: 10, outputTokens: 10 }),
  formatCostUsd: () => "test",
  getModelPricing: async () => ({ usdCnyRate: 7 }),
}));
mock.module("@/lib/billing/currency", () => ({
  checkCurrencyBalance: async () => ({ allowed: true, price: 2, balance }),
  deductCurrency: async () => {
    balance -= 2;
    return { transactionId: "deduct-test" };
  },
  refundCurrency: async () => {
    refunds.push(2);
    balance += 2;
  },
  refundCurrencyAmount: async (
    _user: string,
    _currency: string,
    amount: number,
  ) => {
    refunds.push(amount);
    balance += amount;
  },
  linkTransactionToMessage: async () => {},
  settleTransactionCost: async () => {
    settlements++;
  },
}));
mock.module("@/lib/ai/provider", () => ({
  providerOptionsByModelId: () => undefined,
  modelById: () =>
    new MockLanguageModelV3({
      doStream: async () => {
        if (providerError) throw providerError;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ type: "text-start", id: "text-1" });
              controller.enqueue({
                type: "text-delta",
                id: "text-1",
                delta: answer,
              });
              controller.enqueue({ type: "text-end", id: "text-1" });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: finish, raw: finish },
                usage: {
                  inputTokens: {
                    total: 10,
                    noCache: 10,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  outputTokens: { total: 10, text: 10, reasoning: 0 },
                },
              });
              controller.close();
            },
          }),
        };
      },
    }),
}));
const { POST: chat } = await import("../../src/app/api/chat/route");
const { POST: continuation } = await import(
  "../../src/app/api/chat/continue/route"
);

function request(model: string, regenerate = false) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      model,
      currencyType: "silver",
      trigger: regenerate ? "regenerate-message" : "submit-message",
      messageId: regenerate ? oldId : undefined,
      messages: [
        {
          id: userMessageId,
          role: "user",
          parts: [{ type: "text", text: "你好" }],
        },
      ],
    }),
  });
}
beforeEach(() => {
  rows = [
    {
      id: oldId,
      role: "assistant",
      content: "原来的正常回复",
      createdAt: new Date(0),
      currencyAmount: 2,
    },
  ];
  answer = refusal;
  finish = "stop";
  balance = 100;
  providerError = null;
  refunds.length = 0;
  attempts.length = 0;
  settlements = 0;
});
describe("refusal settlement through actual streaming routes", () => {
  for (const model of ["gemini-3.8-flash-high", "claude-sonnet-4-6"]) {
    test(`${model}: stop-labelled refusal refunds once and is not a success`, async () => {
      const response = await chat(request(model));
      expect(response.status).toBe(200);
      const wire = await response.text();
      expect(wire).toContain('"safetyBlocked":true');
      expect(refunds).toEqual([2]);
      expect(balance).toBe(100);
      expect(attempts).toHaveLength(0);
      expect(settlements).toBe(0);
      expect(rows.at(-1)?.currencyAmount).toBe(0);
    });
    test(`${model}: regeneration refusal leaves old answer active`, async () => {
      rows.unshift({
        id: userMessageId,
        role: "user",
        content: "你好",
        createdAt: new Date(0),
      });
      const wire = await (await chat(request(model, true))).text();
      expect(wire).toContain("content_restricted");
      expect(rows.at(-1)?.content).toBe("原来的正常回复");
      expect(rows.at(-1)?.supersededAt).toBeUndefined();
      expect(refunds).toEqual([2]);
      expect(balance).toBe(100);
    });
  }
  test("normal character rejection stays paid and successful", async () => {
    answer = "我不能答应你，我还有自己的职责。";
    await (await chat(request("gemini-3.8-flash-high"))).text();
    expect(refunds).toHaveLength(0);
    expect(balance).toBe(98);
    expect(attempts[0]?.outcome).toBe("success");
    expect(settlements).toBe(1);
    expect(rows.at(-1)?.content).toBe(answer);
  });
  test.each(["gemini-3.8-flash-high", "claude-sonnet-4-6"])(
    "%s: policy error refunds without polluting model health",
    async (model) => {
      providerError = new Error(
        "The prompt contains sensitive words that violate Google's Generative AI Prohibited Use policy.",
      );
      await (await chat(request(model))).text();
      expect(refunds).toEqual([2]);
      expect(balance).toBe(100);
      expect(attempts).toHaveLength(0);
      expect(settlements).toBe(0);
    },
  );
  test("normal continuation appends and charges once", async () => {
    answer = "他推开窗，看见了晨光。";
    await (await continuation(request("gemini-3.8-flash-high"))).text();
    expect(balance).toBe(98);
    expect(refunds).toHaveLength(0);
    expect(rows.at(-1)?.content).toBe(`原来的正常回复${answer}`);
    expect(rows.at(-1)?.currencyAmount).toBe(4);
    expect(attempts[0]?.outcome).toBe("success");
    expect(settlements).toBe(1);
  });
  test("continuation refusal refunds once without changing the existing answer", async () => {
    await (await continuation(request("gemini-3.8-flash-high"))).text();
    expect(refunds).toEqual([2]);
    expect(balance).toBe(100);
    expect(rows.at(-1)?.content).toBe("原来的正常回复");
    expect(rows.at(-1)?.currencyAmount).toBe(2);
    expect(attempts).toHaveLength(0);
    expect(settlements).toBe(0);
  });
  test("filtered partial continuation preserves text but adds no charge", async () => {
    answer = "新生成半段";
    finish = "content-filter";
    await (await continuation(request("gemini-3.8-flash-high"))).text();
    expect(refunds).toEqual([2]);
    expect(balance).toBe(100);
    expect(rows.at(-1)?.content).toBe("原来的正常回复新生成半段");
    expect(rows.at(-1)?.currencyAmount).toBe(2);
    expect(attempts).toHaveLength(0);
    expect(settlements).toBe(0);
  });
});
