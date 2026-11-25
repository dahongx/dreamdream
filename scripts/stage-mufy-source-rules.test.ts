import { describe, expect, test } from "bun:test";
import { validateSourceRules } from "./stage-mufy-source-rules";

const roleId = "54aa723f-f61a-40ff-89cb-2c003388675d";
const capturedAt = "2026-10-15T05:18:29.526Z";
const now = Date.parse("2026-10-15T06:00:00Z");
const empty = {
  version: 1,
  roleId,
  capturedAt,
  captureScope: "normal-page-public-render-rules",
  responseCode: 200,
  responseDataWasNull: true,
  rules: [],
};
describe("real source rules capture validation", () => {
  test("accepts proven successful null response, not an invented empty list", () => {
    expect(validateSourceRules(empty, roleId, now).count).toBe(0);
    expect(() =>
      validateSourceRules({ ...empty, responseCode: undefined }, roleId, now),
    ).toThrow();
    expect(() =>
      validateSourceRules({ ...empty, rules: undefined }, roleId, now),
    ).toThrow();
  });
  test("rejects wrong role, failures, future timestamps and unknown metadata", () => {
    for (const change of [
      { roleId: "other" },
      { responseCode: 401 },
      { responseDataWasNull: undefined },
      { responseDataWasNull: "false" },
      { capturedAt: "2099-01-01T00:00:00Z" },
      { token: "do-not-stage" },
    ]) {
      expect(() =>
        validateSourceRules({ ...empty, ...change }, roleId, now),
      ).toThrow();
    }
  });
  test("allows five-minute clock drift but has no 85-rule legacy exception", () => {
    expect(
      validateSourceRules(
        { ...empty, capturedAt: new Date(now + 299_000).toISOString() },
        roleId,
        now,
      ).count,
    ).toBe(0);
    expect(() =>
      validateSourceRules(
        { ...empty, capturedAt: new Date(now + 301_000).toISOString() },
        roleId,
        now,
      ),
    ).toThrow();
    const legacyRole = "396e1ded-9bfc-42e4-9350-c04a33e52a0f";
    expect(() =>
      validateSourceRules(
        {
          ...empty,
          roleId: legacyRole,
          capturedAt: "2026-10-15T04:35:26.759Z",
          responseCode: undefined,
          responseDataWasNull: undefined,
          rules: Array(85).fill({}),
        },
        legacyRole,
        now,
      ),
    ).toThrow("invalid-capture-response");
  });
  test("retains source order, numeric ids and all original public flags", () => {
    const rules = [2, 1].map((regexRuleId) => ({
      regexRuleId,
      ruleName: "fixture",
      regPattern: "x",
      replaceString: "y",
      targetSymbol: "",
      mode: 4,
      enabled: true,
      visibility: false,
      userEnabled: true,
    }));
    const result = validateSourceRules(
      { ...empty, responseDataWasNull: false, rules },
      roleId,
      now,
    );
    expect(result.export.rules).toEqual(rules);
    expect(() =>
      validateSourceRules(
        { ...empty, responseDataWasNull: false, rules: [rules[0], rules[0]] },
        roleId,
        now,
      ),
    ).toThrow();
    expect(() =>
      validateSourceRules(
        {
          ...empty,
          responseDataWasNull: false,
          rules: [{ ...rules[0], mode: 9 }],
        },
        roleId,
        now,
      ),
    ).toThrow();
  });
});
