import { beforeEach, expect, mock, test } from "bun:test";
import { users } from "@/lib/db/schema";

// Isolated action tests. No authentication service or real database writes.
let tier: "gold" | "platinum" | "diamond" | null = null;
let expiresAt: Date | null = null;
let count = 0;
let lockCalls = 0;
let inserts = 0;
let queue: Promise<unknown> = Promise.resolve();
const id = "00000000-0000-4000-8000-000000000001";
const input = {
  id: null,
  name: "验收面具",
  note: null,
  gender: null,
  description: null,
  preference: null,
  instruction: null,
};

mock.module("@/lib/auth/current-user", () => ({
  getCurrentUserId: async () => id,
}));
mock.module("@/lib/db/client", () => {
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () =>
          table === users
            ? {
                for: async (mode: string) => {
                  expect(mode).toBe("update");
                  lockCalls++;
                  return [{ tier, expiresAt }];
                },
              }
            : Promise.resolve(Array.from({ length: count }, () => ({ id }))),
      }),
    }),
    insert: () => ({
      values: (value: object) => ({
        returning: async () => {
          expect(lockCalls).toBeGreaterThan(0);
          count++;
          inserts++;
          return [{ ...value, id }];
        },
      }),
    }),
    update: () => ({
      set: (value: object) => ({
        where: () => ({ returning: async () => [{ ...value, id }] }),
      }),
    }),
  };
  return {
    db: {
      ...tx,
      transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => {
        // Simulate serialization; lock-call assertion separately guards implementation.
        const next = queue.then(() => callback(tx));
        queue = next.catch(() => {});
        return next;
      },
    },
  };
});
const { saveMaskAction } = await import("../../src/lib/masks/actions");
beforeEach(() => {
  tier = null;
  expiresAt = null;
  count = 0;
  lockCalls = 0;
  inserts = 0;
  queue = Promise.resolve();
});

test("direct server requests cannot bypass the basic quota", async () => {
  count = 2;
  const result = await saveMaskAction(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe("MASK_LIMIT");
  expect(inserts).toBe(0);
  expect(lockCalls).toBe(1);
});
test("the second mask is permitted", async () => {
  count = 1;
  expect((await saveMaskAction(input)).ok).toBe(true);
  expect(count).toBe(2);
});
test("serialized concurrent creates cannot claim the same remaining slot", async () => {
  count = 1;
  const results = await Promise.all([
    saveMaskAction(input),
    saveMaskAction(input),
  ]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(count).toBe(2);
  expect(lockCalls).toBe(2);
});
for (const memberTier of ["gold", "platinum", "diamond"] as const) {
  test(`${memberTier} obeys configured benefit`, async () => {
    count = 3;
    tier = memberTier;
    expiresAt = new Date(Date.now() + 60_000);
    expect((await saveMaskAction(input)).ok).toBe(memberTier !== "gold");
  });
}
test("expired unlimited membership cannot add, but can update existing masks", async () => {
  count = 4;
  tier = "platinum";
  expiresAt = new Date(Date.now() - 1);
  expect((await saveMaskAction(input)).ok).toBe(false);
  expect((await saveMaskAction({ ...input, id })).ok).toBe(true);
  expect(count).toBe(4);
});
