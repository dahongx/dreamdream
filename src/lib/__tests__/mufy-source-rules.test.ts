import { describe, expect, test } from "bun:test";
import {
  applyMufySourceRules,
  prepareMufySourceRules,
} from "../import/mufy-source-rules";

const capture = (pairs: Array<[string, string]>) => ({
  version: 1,
  roleId: "role",
  capturedAt: "2026-10-15T00:00:00Z",
  captureScope: "normal-page-public-render-rules",
  responseCode: 200,
  responseDataWasNull: false,
  rules: pairs.map(([regPattern, replaceString], i) => ({
    regexRuleId: String(i),
    ruleName: `rule ${i}`,
    regPattern,
    replaceString,
    mode: 99,
  })),
});
const render = (raw: string, pairs: Array<[string, string]>) =>
  applyMufySourceRules(raw, prepareMufySourceRules(capture(pairs), "role"));

describe("public Mufy source rule chain", () => {
  test("requires a successful observed response even for an empty array", () => {
    const empty = capture([]);
    expect(
      prepareMufySourceRules({ ...empty, responseDataWasNull: true }, "role"),
    ).toEqual([]);
    for (const changed of [
      { responseCode: undefined },
      { responseCode: 401 },
      { responseDataWasNull: undefined },
      { responseDataWasNull: "false" },
      { capturedAt: new Date(Date.now() + 301_000).toISOString() },
    ])
      expect(() =>
        prepareMufySourceRules({ ...empty, ...changed }, "role"),
      ).toThrow("invalid-capture-response");
    expect(
      prepareMufySourceRules(
        { ...empty, capturedAt: new Date(Date.now() + 299_000).toISOString() },
        "role",
      ),
    ).toEqual([]);
    expect(() =>
      prepareMufySourceRules(
        { ...capture([["a", "b"]]), responseDataWasNull: true },
        "role",
      ),
    ).toThrow("invalid-capture-response");
  });
  test("joins prefix, fields and suffix before iframe routing", () => {
    expect(
      render("<tw><up>new name</up></tw>", [
        ["/<tw>/g", "<section>"],
        ["/<up>(.*?)</up>/g", "<b>$1</b>"],
        ["/</tw>/g", "</section>"],
      ]).html,
    ).toBe("<section><b>new name</b></section>");
  });
  test("later rules do not rewrite generated HTML or captured values", () => {
    const result = render("<a>name</a> name", [
      ["/<a>(.*?)</a>/g", "<b>$1 name</b>"],
      ["/name/g", "other"],
    ]);
    expect(result.html).toBe("<b>name name</b> other");
    expect(result.matchedRules.map((r) => r.count)).toEqual([1, 1]);
  });
  test("uses exact source order, ignores editor mode, and supports $0", () => {
    expect(
      render("abc", [
        ["/a/", "$0-$99-$&-$$"],
        ["/b/", "B"],
      ]).html,
    ).toBe("a--$&-$$Bc");
  });
  test("preserves flags, bare default g, multiline body decoding", () => {
    expect(render("A\na a", [["/a/i", "X"]]).html).toBe("X\na a");
    expect(render("a\na", [["a", "X"]]).html).toBe("X\nX");
    expect(render("a\nb", [["/a\\nb/", "X"]]).html).toBe("X");
    expect(render("<x>a\nb</x>", [["/<x>(.*?)</x>/g", "$1"]]).html).toBe(
      "<x>a\nb</x>",
    );
  });
  test("handles zero width and non-global patterns without loops", () => {
    expect(render("aa", [["/(?=a)/g", "x"]]).html).toBe("xaxa");
    expect(render("aa", [["/a/i", "x"]]).html).toBe("xa");
  });
  test("fails whole capture on binding, invalid regex, duplicate IDs or markers", () => {
    expect(() => prepareMufySourceRules(capture([]), "other")).toThrow(
      "binding",
    );
    expect(() => render("a", [["/[a/", "x"]])).toThrow("invalid-regexp");
    expect(() => render("\uE000a", [])).toThrow("reserved-marker");
    const duplicate = capture([
      ["a", "b"],
      ["b", "c"],
    ]);
    duplicate.rules[1].regexRuleId = "0";
    expect(() => prepareMufySourceRules(duplicate, "role")).toThrow(
      "duplicate-rule-id",
    );
  });
  test("fails closed instead of truncating matching or oversized output", () => {
    const rules = prepareMufySourceRules(
      capture([["a", "0123456789"]]),
      "role",
    );
    expect(() =>
      applyMufySourceRules("aaa", rules, { maxMatchesPerRule: 2 }),
    ).toThrow("per-rule-match-limit");
    expect(() =>
      applyMufySourceRules("aaa", rules, { maxOutputLength: 20 }),
    ).toThrow("output-length-limit");
    expect(() =>
      applyMufySourceRules("aaa", rules, { maxInputLength: 2 }),
    ).toThrow("input-length-limit");
  });
});
