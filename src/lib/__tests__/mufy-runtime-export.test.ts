import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const script = await Bun.file("scripts/export-mufy-runtime.js").text();
const roleId = "54aa723f-f61a-40ff-89cb-2c003388675d";
async function simulate(stalledBody: boolean) {
  const win: Record<string, unknown> = {};
  const detail = {
    characterId: roleId,
    name: "Fixture",
    greeting: "Public opening",
    avatarUrl: stalledBody ? "https://assets.example/avatar.png" : null,
    lastSessionId: "private-session",
    maskDescription: "private-mask",
    currentMaskId: "private-mask-id",
    token: "private-token",
  };
  const doc = {
    querySelectorAll: () => [],
    querySelector: () => null,
    styleSheets: [],
    images: [],
    documentElement: { scrollWidth: 800, scrollHeight: 600 },
    body: { appendChild: () => {} },
    getElementById: () => null,
    createElement: () => ({ remove: () => {}, click: () => {} }),
  };
  await runInNewContext(script, {
    window: win,
    location: {
      href: `https://chat.mufy.ai/chat?roleId=${roleId}&sessionId=private-session`,
      origin: "https://chat.mufy.ai",
    },
    localStorage: { getItem: () => "credential-never-exported" },
    document: doc,
    performance,
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    URL,
    Blob,
    AbortController,
    Date,
    console: { table: () => {} },
    setTimeout: (callback: () => void) => setTimeout(callback, 5),
    clearTimeout,
    fetch: async (url: string, options: { signal?: AbortSignal }) => {
      if (url.startsWith("/api/characters/get"))
        return { ok: true, json: async () => ({ data: detail }) };
      return {
        ok: true,
        headers: { get: () => "image/png" },
        blob: () =>
          new Promise((_, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => reject(new Error("body timed out")),
              { once: true },
            );
          }),
      };
    },
  });
  return win.__MUFY_RUNTIME_SNAPSHOT__ as {
    pageUrl: string;
    captureExecutionMs: number;
    detail: { data: Record<string, unknown> };
    assetSummary: { failed: number };
    assets: { error: string }[];
  };
}

test("runtime exports role material without viewer session, mask or credentials", async () => {
  const snapshot = await simulate(false);
  const serialized = JSON.stringify(snapshot);
  for (const value of [
    "private-session",
    "private-mask",
    "private-token",
    "credential-never-exported",
  ])
    expect(serialized.includes(value)).toBe(false);
  expect(snapshot.detail.data.greeting).toBe("Public opening");
  expect(snapshot.captureExecutionMs).toBeGreaterThanOrEqual(0);
});

test("asset timeout covers a stalled response body, not just response headers", async () => {
  const snapshot = await simulate(true);
  expect(snapshot.assetSummary.failed).toBe(1);
  expect(snapshot.assets[0].error).toContain("body timed out");
});
