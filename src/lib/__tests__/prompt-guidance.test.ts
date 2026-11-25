import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "@/lib/ai/build-prompt";
import type { RegexRule } from "@/lib/db/schema";
import {
  buildRegexGuidanceSection,
  filterRulesForUser,
  REGEX_GUIDANCE_HEADING,
} from "@/lib/regex/prompt";

function rule(over: Partial<RegexRule>): RegexRule {
  return {
    id: "r1",
    packId: "p1",
    name: "rule",
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

describe("filterRulesForUser", () => {
  test("uses the same effective rule set for prompting and rendering", () => {
    const rules = [
      rule({ id: "always", visible: false }),
      rule({ id: "visible-on", visible: true }),
      rule({ id: "visible-off", visible: true }),
      rule({ id: "globally-off", enabled: false }),
    ];
    const preferences = new Map([
      ["visible-on", true],
      ["visible-off", false],
      ["always", false],
    ]);
    expect(filterRulesForUser(rules, preferences).map(({ id }) => id)).toEqual([
      "always",
      "visible-on",
    ]);
  });
});

describe("buildRegexGuidanceSection", () => {
  test("omits empty, disabled, and guidance-less rules", () => {
    expect(buildRegexGuidanceSection([])).toBeNull();
    expect(
      buildRegexGuidanceSection([
        rule({ outputGuidance: "use <a>", enabled: false }),
        rule({ outputGuidance: "  " }),
      ]),
    ).toBeNull();
  });

  test("emits enabled guidance with conditional trigger semantics", () => {
    const output = buildRegexGuidanceSection([
      rule({
        id: "env",
        name: "env panel",
        outputGuidance: "  在回复开头输出 <env>  ",
      }),
    ]) as string;
    expect(output).toContain(REGEX_GUIDANCE_HEADING);
    expect(output).toContain("### env panel\n\n在回复开头输出 <env>");
    expect(output).toContain("you **must** emit");
    expect(output).toContain("do **not** force");
  });

  test("preserves the creator's structural example after its guidance", () => {
    const output = buildRegexGuidanceSection([
      rule({
        name: "env",
        outputGuidance: "回复开头输出 <env>",
        targetText: '<env data-v="{{state}}"><time>$1</time></env>',
      }),
    ]) as string;
    expect(output).toContain("Required structural example:");
    expect(output).toContain('<env data-v="{{state}}"><time>$1</time></env>');
    expect(output.indexOf("回复开头输出 <env>")).toBeLessThan(
      output.indexOf('<env data-v="{{state}}">'),
    );
  });
});

describe("buildSystemPrompt with rules", () => {
  const character = {
    name: "陆沉",
    persona: "PERSONA_SENTINEL",
    adversity: null,
    defaultCognition: null,
    plotSetting: "PLOT_SENTINEL",
    outputSetting: "OUTPUT_SENTINEL",
    sampleDialogue: "SAMPLE_SENTINEL",
    opening: null,
  };
  const user = { displayName: "Maat", username: "maat", name: null };

  test("puts guidance in OutputSetting before later canonical slots", () => {
    const prompt = buildSystemPrompt({
      character,
      user,
      rules: [rule({ name: "env", outputGuidance: "在回复开头输出 <env>" })],
    });
    const protocol = prompt.indexOf("<DearmHostOutputProtocol>");
    const creatorSetting = prompt.indexOf("OUTPUT_SENTINEL");
    const guidance = prompt.indexOf(REGEX_GUIDANCE_HEADING);
    const samples = prompt.indexOf("SAMPLE_SENTINEL");
    expect(protocol).toBeLessThan(creatorSetting);
    expect(creatorSetting).toBeLessThan(guidance);
    expect(guidance).toBeLessThan(samples);
  });

  test("does not insert guidance for disabled rules", () => {
    const prompt = buildSystemPrompt({
      character,
      user,
      rules: [rule({ outputGuidance: "use <env>", enabled: false })],
    });
    expect(prompt).not.toContain(REGEX_GUIDANCE_HEADING);
  });
});
