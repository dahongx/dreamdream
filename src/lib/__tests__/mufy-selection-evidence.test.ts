import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const script = await readFile(
  "scripts/collect-mufy-selection-evidence.js",
  "utf8",
);
const roleId = "54aa723f-f61a-40ff-89cb-2c003388675d";
async function collect(status: number) {
  let requests = 0;
  const win: Record<string, unknown> = {
    __MUFY_SELECTION_AUDIT_QUEUE__: [roleId, roleId],
  };
  runInNewContext(script, {
    window: win,
    Date,
    performance,
    AbortSignal,
    localStorage: { getItem: () => "test-credential-never-exported" },
    setTimeout: (callback: () => void) => {
      callback();
    },
    fetch: async () => {
      requests++;
      return {
        status,
        ok: status === 200,
        json: async () => ({
          code: 200,
          data: {
            characterId: roleId,
            name: "角色",
            creatorName: "作者",
            greeting: "开场",
            lastSessionId: "private-session",
            maskDescription: "private-mask",
            token: "private-token",
          },
        }),
      };
    },
  });
  for (let i = 0; i < 30; i++) await Promise.resolve();
  return {
    state: win.__MUFY_SELECTION_AUDIT__ as {
      status: string;
      records: Record<string, unknown>[];
    },
    requests,
  };
}
test("public evidence whitelist excludes credentials/session/mask and never approves", async () => {
  const { state } = await collect(200);
  expect(state.status).toBe("finished");
  expect(state.records.length).toBe(2);
  const serialized = JSON.stringify(state);
  for (const value of [
    "test-credential",
    "private-session",
    "private-mask",
    "private-token",
    "confirmed",
  ])
    expect(serialized.includes(value)).toBe(false);
});
test("auth and rate limiting pause once, never retry blindly", async () => {
  for (const status of [401, 403, 429]) {
    const { state, requests } = await collect(status);
    expect(state.status).toBe("paused");
    expect(requests).toBe(1);
    expect(state.records[0].status).toBe("failed");
  }
});
