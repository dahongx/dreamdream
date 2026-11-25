import { describe, expect, test } from "bun:test";
import type { RegexRule } from "@/lib/db/schema";
import { applyRegex, buildRegExp } from "@/lib/regex/apply";
import { derivePatternFromTarget } from "@/lib/regex/derive";
import {
  applyRegexStreaming,
  findSafeBoundary,
  visibleStreamTail,
} from "@/lib/regex/stream";

function rule(over: Partial<RegexRule>): RegexRule {
  return {
    id: "r1",
    packId: "p1",
    name: "test",
    targetText: null,
    pattern: "",
    replacement: "",
    variableMapping: [],
    outputGuidance: null,
    enabled: true,
    visible: false,
    orderIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe("buildRegExp", () => {
  test("bare pattern gets gms flags", () => {
    const re = buildRegExp("foo");
    expect(re.flags.includes("g")).toBe(true);
    expect(re.flags.includes("m")).toBe(true);
    expect(re.flags.includes("s")).toBe(true);
  });

  test("literal pattern preserves flags but adds g", () => {
    const re = buildRegExp("/foo/i");
    expect(re.flags.includes("i")).toBe(true);
    expect(re.flags.includes("g")).toBe(true);
  });

  test("captures via $1 work", () => {
    const re = buildRegExp("<a>(.*?)</a>");
    expect("<a>x</a>".replace(re, "[$1]")).toBe("[x]");
  });
});

describe("applyRegex", () => {
  test("replaces matched rule and reports count", () => {
    const r = rule({
      pattern: "<env>(.*?)</env>",
      replacement: "[$1]",
    });
    const out = applyRegex("hi <env>13:37</env> bye", [r]);
    expect(out.text).toBe("hi [13:37] bye");
    expect(out.matchedRules).toEqual([{ id: "r1", name: "test", count: 1 }]);
    expect(out.unmatchedRules).toEqual([]);
  });

  test("substitutes capture groups above nine as one group number", () => {
    const r = rule({
      pattern:
        "<x>(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)</x>",
      replacement: "$1 / $10",
    });
    expect(applyRegex("<x>alpha|2|3|4|5|6|7|8|9|omega</x>", [r]).text).toBe(
      "alpha / omega",
    );
  });

  test("disabled rules are skipped", () => {
    const r = rule({
      pattern: "<x>(.*?)</x>",
      replacement: "[$1]",
      enabled: false,
    });
    const out = applyRegex("<x>hi</x>", [r]);
    expect(out.text).toBe("<x>hi</x>");
    expect(out.matchedRules).toEqual([]);
  });

  test("visible rules with userPrefs=false are skipped", () => {
    const r = rule({
      pattern: "<x>(.*?)</x>",
      replacement: "[$1]",
      visible: true,
    });
    const userPrefs = new Map<string, boolean>([[r.id, false]]);
    const out = applyRegex("<x>hi</x>", [r], { userPrefs });
    expect(out.text).toBe("<x>hi</x>");
  });

  test("enabled=false short-circuits BEFORE visibility/prefs", () => {
    // A disabled rule must stay off regardless of pref entries — otherwise
    // a stray pref row (user_regex_preferences left over after a creator
    // toggles `enabled` off) could silently re-activate it.
    const r = rule({
      id: "stuck",
      pattern: "<x>(.*?)</x>",
      replacement: "[$1]",
      enabled: false,
      visible: true,
    });
    // User has explicitly opted IN — which is the default, so this also
    // covers the case of a stale "true" pref left in the DB.
    const userPrefs = new Map<string, boolean>([[r.id, true]]);
    const out = applyRegex("<x>hi</x>", [r], { userPrefs });
    expect(out.text).toBe("<x>hi</x>");
    expect(out.matchedRules).toEqual([]);
  });

  test("unmatched rules are reported with reason", () => {
    const r = rule({
      pattern: "<missing>(.*?)</missing>",
      replacement: "[$1]",
    });
    const out = applyRegex("nothing here", [r]);
    expect(out.unmatchedRules.length).toBe(1);
    expect(out.unmatchedRules[0].id).toBe("r1");
  });

  test("rules applied in orderIndex ascending order", () => {
    const a = rule({ id: "a", pattern: "A", replacement: "B", orderIndex: 2 });
    const b = rule({ id: "b", pattern: "B", replacement: "C", orderIndex: 1 });
    const out = applyRegex("A", [a, b]);
    // b runs first on "A" → no match for "B"; a runs → "B"
    expect(out.text).toBe("B");
  });

  test("$& substitutes the whole match", () => {
    const r = rule({ pattern: "\\bfoo\\b", replacement: "[$&]" });
    const out = applyRegex("foo bar foo", [r]);
    expect(out.text).toBe("[foo] bar [foo]");
    expect(out.matchedRules[0].count).toBe(2);
  });

  test("multiple captures substitute independently", () => {
    const r = rule({
      pattern: "<a>(.*?)</a><b>(.*?)</b>",
      replacement: "$2 | $1",
    });
    const out = applyRegex("x <a>1</a><b>2</b> y", [r]);
    expect(out.text).toBe("x 2 | 1 y");
  });
});

describe("derivePatternFromTarget", () => {
  test("derives pattern + variable mapping from leaf-only xml", () => {
    const d = derivePatternFromTarget(
      "<env><time>13:37</time><weather>多云</weather></env>",
    );
    expect(d).not.toBeNull();
    expect(d?.rootTag).toBe("env");
    expect(d?.variableMapping.length).toBe(2);
    expect(d?.variableMapping[0].name).toBe("time");
    expect(d?.variableMapping[1].name).toBe("weather");
    const re = new RegExp(d?.pattern ?? "", "s");
    const m = "<env><time>13:37</time><weather>多云</weather></env>".match(re);
    expect(m?.[1]).toBe("13:37");
    expect(m?.[2]).toBe("多云");
  });

  test("returns null on empty input", () => {
    expect(derivePatternFromTarget("")).toBeNull();
    expect(derivePatternFromTarget("   ")).toBeNull();
  });
});

describe("findSafeBoundary", () => {
  test("returns buffer length when no `<` is open", () => {
    expect(findSafeBoundary("hello world")).toBe(11);
    expect(findSafeBoundary("<env>13:37</env>")).toBe(16);
  });

  test("cuts at the last unclosed `<`", () => {
    expect(findSafeBoundary("<env>13:37</env> some <env")).toBe(22);
    expect(findSafeBoundary("blah <inc")).toBe(5);
  });
});

describe("visibleStreamTail", () => {
  test("hides a partial tag tail (prevents 爆代码 flash)", () => {
    // Real streaming flashes observed in chat: status-card HTML mid-stream
    expect(visibleStreamTail("<div cla")).toBe("");
    expect(visibleStreamTail('<span class="zero-com')).toBe("");
    expect(visibleStreamTail("<details")).toBe("");
  });

  test("shows plain-text tails (normal typing, low latency)", () => {
    expect(visibleStreamTail("你好世界")).toBe("你好世界");
    expect(visibleStreamTail("typing...")).toBe("typing...");
    expect(visibleStreamTail("")).toBe("");
  });
});

describe("applyRegexStreaming", () => {
  test("renders complete tags and leaves the streaming tail untouched", () => {
    const r = rule({
      pattern: "<env>(.*?)</env>",
      replacement: "[$1]",
    });
    // `<en` is truly mid-stream (no `>` yet)
    const out = applyRegexStreaming("hi <env>14:30</env> rest <en", [r]);
    expect(out.rendered).toBe("hi [14:30] rest ");
    expect(out.tail).toBe("<en");
  });

  test("with no open tail, behaves like applyRegex", () => {
    const r = rule({
      pattern: "<env>(.*?)</env>",
      replacement: "[$1]",
    });
    const out = applyRegexStreaming("done <env>x</env>", [r]);
    expect(out.rendered).toBe("done [x]");
    expect(out.tail).toBe("");
  });
});
