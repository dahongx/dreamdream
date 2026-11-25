// Run independently: module mocks must not contaminate the full application suite.
import { beforeEach, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

let authenticated = true;
let allowed = true;
let queryResults: unknown[][] = [];
let calls = 0;
let output = '["我把热茶递过去。","我们去散步吧。","你今天过得怎么样？"]';
let finishReason = "stop";
let lastPrompt = "";
mock.module("@/lib/auth/current-user", () => ({
  getCurrentUserId: async () => {
    if (!authenticated) throw new Error("not signed in");
    return "owner";
  },
}));
mock.module("@/lib/db/client", () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: async () => queryResults.shift() ?? [],
      };
      return chain;
    },
  },
}));
mock.module("@/lib/masks/queries", () => ({
  getSessionActiveMask: async () => ({ id: "mask", name: "玩家" }),
}));
mock.module("@/lib/ai/generators/rate-limit", () => ({
  checkRateLimit: () => ({ allowed }),
}));
mock.module("@/lib/ai/provider", () => ({
  modelById: () => ({}),
  providerOptionsByModelId: () => undefined,
}));
mock.module("ai", () => ({
  generateText: async (args: { prompt: string }) => {
    calls++;
    lastPrompt = args.prompt;
    return {
      text: output,
      finishReason,
      usage: { inputTokens: 50, outputTokens: 30 },
    };
  },
}));
const { POST } = await import("../../src/app/api/chat/suggestions/route");
let serial = 0;
beforeEach(() => {
  serial++;
  authenticated = true;
  allowed = true;
  calls = 0;
  finishReason = "stop";
  output = '["我把热茶递过去。","我们去散步吧。","你今天过得怎么样？"]';
  queryResults = [
    [{ id: `session-${serial}`, characterId: "character" }],
    [
      {
        id: "character",
        name: "店员",
        visibility: "public",
        ownerId: "creator",
        persona: "PRIVATE MUST NOT LEAK",
      },
    ],
    [
      {
        id: `message-${serial}`,
        role: "assistant",
        content: "<p>你想喝什么茶？</p>",
      },
    ],
  ];
});
function request(
  body = '{"sessionId":"e948756e-7f63-4c98-9f68-f513d833a585"}',
) {
  return new NextRequest("http://localhost/api/chat/suggestions", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}
test("unauthenticated calls cannot generate", async () => {
  authenticated = false;
  expect((await POST(request())).status).toBe(401);
  expect(calls).toBe(0);
});
test("malformed request returns 400", async () => {
  expect((await POST(request("{"))).status).toBe(400);
  expect(calls).toBe(0);
});
test("missing or unowned session returns 404 without model call", async () => {
  queryResults[0] = [];
  expect((await POST(request())).status).toBe(404);
  expect(calls).toBe(0);
});
test("private character access is enforced", async () => {
  queryResults[1] = [
    { id: "character", visibility: "private", ownerId: "different" },
  ];
  expect((await POST(request())).status).toBe(404);
  expect(calls).toBe(0);
});
test("pending user turn cannot generate suggestions", async () => {
  queryResults[2] = [{ role: "user", content: "等待中" }];
  expect((await POST(request())).status).toBe(409);
  expect(calls).toBe(0);
});
test("rate limit prevents paid upstream request", async () => {
  allowed = false;
  expect((await POST(request())).status).toBe(429);
  expect(calls).toBe(0);
});
test("returns exactly three replies, never creator prompt or a chat row", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).suggestions.length).toBe(3);
  expect(lastPrompt).toContain("你想喝什么茶");
  expect(lastPrompt).not.toContain("PRIVATE MUST NOT LEAK");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
test("partial or refused output is not a successful set of suggestions", async () => {
  finishReason = "content-filter";
  expect((await POST(request())).status).toBe(502);
});
test("malformed model output fails without fabricated fallback replies", async () => {
  output = "not json";
  expect((await POST(request())).status).toBe(502);
});
