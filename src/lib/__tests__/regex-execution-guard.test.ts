import { expect, test } from "bun:test";
import type { RegexRule } from "@/lib/db/schema";
import { applyRegex } from "@/lib/regex/apply";
import { applyRegexToSegments } from "@/lib/regex/segments";

test("lazy execution failures preserve content and allow later rules", () => {
  const source = "__lazy_compile_fixture__";
  const input = `${source} keep ${source}`;
  const base: RegexRule = {
    id: "failed",
    packId: "test",
    name: "lazy failure",
    pattern: source,
    replacement: "discard",
    enabled: true,
    visible: false,
    orderIndex: 0,
    targetText: null,
    outputGuidance: null,
    variableMapping: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const rules = [
    base,
    {
      ...base,
      id: "next",
      pattern: "keep",
      replacement: "KEEP",
      orderIndex: 1,
    },
  ];
  const original = RegExp.prototype.exec;
  let calls = 0;
  RegExp.prototype.exec = function (text: string) {
    if (this.source === source && ++calls % 2 === 0) {
      throw new SyntaxError("Regular expression too large");
    }
    return original.call(this, text);
  };
  try {
    const plain = applyRegex(input, rules);
    expect(plain.text).toBe(input.replace("keep", "KEEP"));
    expect(plain.unmatchedRules[0].reason).toContain("pattern execution error");
    calls = 0;
    const segmented = applyRegexToSegments(input, rules);
    expect(segmented.segments).toEqual([
      { type: "html", content: input.replace("keep", "KEEP") },
    ]);
    expect(segmented.unmatchedRules[0].reason).toContain(
      "pattern execution error",
    );
  } finally {
    RegExp.prototype.exec = original;
  }
});
