import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

type RequestMock = {
  result: unknown;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
};
const script = await Bun.file(
  resolve(import.meta.dir, "../../../scripts/collect-mufy-profiles.js"),
).text();
async function simulate(
  responses: Array<{ status: number; body?: unknown }>,
  token = true,
  seed: unknown[] = [],
) {
  const stores = new Map<string, Map<unknown, unknown>>([
    ["records", new Map(seed.map((v) => [(v as { key: string }).key, v]))],
    ["meta", new Map()],
  ]);
  const db = {
    createObjectStore: () => {},
    close: () => {},
    transaction: (name: string) => {
      const tx: {
        oncomplete?: () => void;
        onerror?: () => void;
        onabort?: () => void;
        objectStore: () => unknown;
      } = {
        objectStore: () => ({
          getAll: () => {
            const r: RequestMock = {
              result: [...(stores.get(name)?.values() ?? [])],
            };
            queueMicrotask(() => r.onsuccess?.());
            return r;
          },
          put: (value: unknown, key?: unknown) => {
            stores.get(name)?.set(key ?? (value as { key: string }).key, value);
            queueMicrotask(() => tx.oncomplete?.());
          },
        }),
      };
      return tx;
    },
  };
  const nodes = new Map<string, { textContent: string; id: string }>();
  let requests = 0,
    t = 0;
  const window: Record<string, unknown> = {
    __MUFY_PROFILE_QUEUE__: {
      version: 1,
      jobId: "test",
      rows: [{ key: "k", name: "Name" }],
      request: { showNsfw: true, pageSize: 40, sortBy: "newest" },
      intervalMs: 1000,
      maxRetries: 3,
    },
  };
  const context = {
    window,
    location: { origin: "https://chat.mufy.ai" },
    indexedDB: {
      open: () => {
        const r: RequestMock = { result: db };
        queueMicrotask(() => {
          r.onupgradeneeded?.();
          r.onsuccess?.();
        });
        return r;
      },
    },
    localStorage: { getItem: () => (token ? "private-test-token" : null) },
    document: {
      getElementById: (id: string) => nodes.get(id),
      createElement: () => ({ id: "", textContent: "" }),
      body: {
        appendChild: (n: { id: string; textContent: string }) =>
          nodes.set(n.id, n),
      },
    },
    fetch: async () => {
      requests++;
      const response = responses.shift() ?? {
        status: 200,
        body: { code: 200, data: { data: [], hasNext: false } },
      };
      return {
        status: response.status,
        ok: response.status === 200,
        json: async () => response.body,
      };
    },
    AbortSignal,
    performance: { now: () => ++t },
    setTimeout: (fn: () => void) => {
      queueMicrotask(fn);
      return 1;
    },
  };
  runInNewContext(script, context);
  await (window.__MUFY_PROFILE_COLLECTION_PROMISE__ as Promise<unknown>);
  const state = JSON.parse(
    nodes.get("mufy-profile-export")?.textContent ?? "null",
  ) as {
    status: string;
    records: Array<{
      status: string;
      complete: boolean;
      attempts: number;
      candidates: unknown[];
    }>;
  };
  return { state, requests, serialized: JSON.stringify(state) };
}
test("browser collector completes all pages and deduplicates roles", async () => {
  const item = {
    characterId: "14ead055-aea5-4687-ba5f-98ee14bbbf9d",
    name: "Name",
    totalLikes: 0,
  };
  const r = await simulate([
    { status: 200, body: { code: 200, data: { data: [item], hasNext: true } } },
    {
      status: 200,
      body: { code: 200, data: { data: [item], hasNext: false } },
    },
  ]);
  expect(r.requests).toBe(2);
  expect(r.state.records[0].candidates).toHaveLength(1);
  expect(r.state.records[0].complete).toBe(true);
  expect(r.serialized).not.toContain("private-test-token");
});
test("auth failure pauses rather than declaring not-found", async () => {
  const r = await simulate([{ status: 401 }]);
  expect(r.state.status).toBe("AUTH_REQUIRED");
  expect(r.state.records[0].status).toBe("failed");
  expect(r.state.records[0].attempts).toBe(1);
});
test("429 pauses immediately without evading rate limits", async () => {
  const r = await simulate([{ status: 429 }]);
  expect(r.state.status).toBe("RATE_LIMITED");
  expect(r.requests).toBe(1);
});
test("successful checkpoint is skipped on resume", async () => {
  const r = await simulate([], true, [
    { key: "k", status: "not-found", complete: true, candidates: [] },
  ]);
  expect(r.requests).toBe(0);
  expect(r.state.records).toHaveLength(1);
});
test("server errors have bounded retries", async () => {
  const r = await simulate([{ status: 500 }, { status: 500 }, { status: 500 }]);
  expect(r.requests).toBe(3);
  expect(r.state.records[0].attempts).toBe(3);
  expect(r.state.records[0].status).toBe("failed");
});
test("changed response protocol pauses collection", async () => {
  const r = await simulate([
    { status: 200, body: { code: 200, data: { data: [] } } },
  ]);
  expect(r.state.status).toBe("SEARCH_SCHEMA_CHANGED");
});
