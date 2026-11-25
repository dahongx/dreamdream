import { expect, test } from "bun:test";
import {
  selectNewTestProfiles,
  requireVerifiedSelection,
  validateTestInventory,
  TEST_PROFILE_HOST,
  type TestProfileInventory,
} from "../import/mufy-profile-selection";
import type { rankProfileCandidates } from "../import/mufy-profiles";
const inventory = (): TestProfileInventory => ({
  version: 1,
  environment: "test",
  host: TEST_PROFILE_HOST,
  capturedAt: new Date().toISOString(),
  complete: true,
  characters: [{ id: "existing", name: "甲" }],
});
const rows = (names: string[]): ReturnType<typeof rankProfileCandidates> =>
  names.map((name, i) => ({
    source: {
      key: String(i),
      name,
      aliases: [],
      archiveLine: i + 1,
      promptSha256: "hash",
      promptChars: 1,
      variantCount: null,
    },
    candidate: {
      roleId: String(i),
      name,
      author: null,
      tags: [],
      favorites: 100 - i,
      likes: null,
      chats: null,
      updatedAt: null,
    },
    confirmed: false,
    observedAt: new Date().toISOString(),
  }));
test("exclude before limit and replenish", () => {
  const result = selectNewTestProfiles(
    rows(["甲", "乙", "丙"]),
    inventory(),
    2,
  );
  expect(result.rows.map((r) => r.candidate.name)).toEqual(["乙", "丙"]);
  expect(result.excluded[0].targetIds).toEqual(["existing"]);
});
test("unique roleId cannot consume two places", () => {
  const input = rows(["乙", "乙", "丙"]);
  input[1].candidate.roleId = input[0].candidate.roleId;
  expect(selectNewTestProfiles(input, inventory(), 2).rows.length).toBe(2);
});
test("version suffix is review hold not identity proof", () => {
  const result = selectNewTestProfiles(
    rows(["甲（36岁版）", "甲乙"]),
    inventory(),
    2,
  );
  expect(result.excluded[0].reason).toBe("test-version-name-review");
  expect(result.rows[0].candidate.name).toBe("甲乙");
});
test("normalization handles fullwidth/whitespace", () => {
  const value = inventory();
  value.characters[0].name = "Ａ B";
  expect(selectNewTestProfiles(rows(["ab"]), value, 1).rows).toEqual([]);
});
test("wrong environment, host, incomplete and expired inventory rejected", () => {
  for (const patch of [
    { environment: "production" },
    { host: "dearm.ai" },
    { complete: false },
    { capturedAt: "2020-01-01" },
    { characters: [{ id: "x", name: "" }] },
  ]) {
    expect(() => validateTestInventory({ ...inventory(), ...patch })).toThrow();
  }
});
test("obvious fulltext mismatch is rejected and lower-ranked candidate replenishes", () => {
  const input = rows(["宴雎", "乙", "丙"]);
  input[0].source.name = "本人";
  const result = selectNewTestProfiles(input, inventory(), 2);
  expect(result.rows.map((r) => r.candidate.name)).toEqual(["乙", "丙"]);
  expect(result.rejectedPairs[0].sourceName).toBe("本人");
});
test("wrong association cannot hide correct association to the same role", () => {
  const input = rows(["乙", "乙"]);
  input[0].source.name = "没有";
  input[1].candidate.roleId = input[0].candidate.roleId;
  expect(selectNewTestProfiles(input, inventory(), 1).rows[0].source.key).toBe(
    "1",
  );
});
test("name-compatible candidates do not pass batch acceptance gate", () => {
  expect(() =>
    requireVerifiedSelection({
      status: "draft-awaiting-identity-version-and-target-review",
      requested: 100,
      rows: Array(100).fill({}),
    }),
  ).toThrow();
  expect(() =>
    requireVerifiedSelection({ status: "verified", requested: 100, rows: [] }),
  ).toThrow();
  expect(() =>
    requireVerifiedSelection({ status: "verified", requested: 1, rows: [{}] }),
  ).toThrow();
});
test("explicit different versions do not borrow the base-card Prompt", () => {
  const input = rows(["风满楼（魔尊版）", "乙"]);
  input[0].source.name = "风满楼";
  const result = selectNewTestProfiles(input, inventory(), 1);
  expect(result.rejectedPairs[0].reason).toBe("unmatched-explicit-version");
  expect(result.rows[0].candidate.name).toBe("乙");
});
test("new age-specific extra story does not imply a different main-card version", () => {
  const input = rows(["顾知裴（更新番外18岁的小顾）"]);
  input[0].source.name = "顾知裴";
  expect(selectNewTestProfiles(input, inventory(), 1).rows.length).toBe(1);
});
