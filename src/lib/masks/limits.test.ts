import { expect, test } from "bun:test";
import { canCreateMask, hasUnlimitedMaskBenefit } from "./limits";

const now = Date.UTC(2026, 9, 28);
test("basic quota allows two real masks", () => {
  expect(canCreateMask(false, 0)).toBe(true);
  expect(canCreateMask(false, 1)).toBe(true);
  expect(canCreateMask(false, 2)).toBe(false);
  expect(canCreateMask(false, 10)).toBe(false);
});
test("free and gold users have no unlimited-mask benefit", () => {
  expect(hasUnlimitedMaskBenefit(null, null, now)).toBe(false);
  expect(hasUnlimitedMaskBenefit("gold", new Date(now + 1), now)).toBe(false);
});
for (const tier of ["platinum", "diamond"] as const) {
  test(`${tier}: only unexpired membership grants unlimited masks`, () => {
    expect(hasUnlimitedMaskBenefit(tier, new Date(now + 1), now)).toBe(true);
    expect(hasUnlimitedMaskBenefit(tier, new Date(now), now)).toBe(false);
    expect(hasUnlimitedMaskBenefit(tier, new Date(now - 1), now)).toBe(false);
    expect(hasUnlimitedMaskBenefit(tier, null, now)).toBe(false);
  });
}
test("unlimited accounts are not bounded by the basic limit", () => {
  expect(canCreateMask(true, 100)).toBe(true);
});
