import { describe, expect, test } from "bun:test";
import { checkRateLimit } from "@/lib/ai/generators/rate-limit";
import {
  buildGeneratorLanguageDirective,
  GENERATOR_TYPES,
  resolveGenerator,
} from "@/lib/ai/generators/registry";

describe("resolveGenerator", () => {
  test("loads + returns the target-text prompt template", () => {
    const r = resolveGenerator({
      type: "target-text",
      prompt: "我要一个物品栏",
      locale: "zh-TW",
    });
    expect(r.systemPrompt).toContain("目标字符");
    expect(r.userPrompt).toBe("我要一个物品栏");
  });

  test("interpolates TARGET_TEXT + VARIABLE_MAPPING for replacement-html", () => {
    const r = resolveGenerator({
      type: "replacement-html",
      prompt: "暗色赛博朋克",
      locale: "zh-TW",
      context: {
        targetText: "<env><time>13:37</time></env>",
        variableMapping: [{ index: 1, name: "time" }],
      },
    });
    expect(r.systemPrompt).toContain("<env><time>13:37</time></env>");
    // serialized mapping injected
    expect(r.systemPrompt).toContain('"name":"time"');
    // no leftover slot tokens
    expect(r.systemPrompt).not.toContain("<<<TARGET_TEXT>>>");
    expect(r.systemPrompt).not.toContain("<<<VARIABLE_MAPPING>>>");
  });

  test("global-css folds in target_selectors", () => {
    const r = resolveGenerator({
      type: "global-css",
      prompt: "紫色渐变",
      locale: "zh-TW",
      context: { targetSelectors: [".nj_ai_message_bubble"] },
    });
    expect(r.systemPrompt).toContain(".nj_ai_message_bubble");
  });

  test("output-guidance picks up target_text + replacement_hint", () => {
    const r = resolveGenerator({
      type: "output-guidance",
      prompt: "环境状态面板",
      locale: "zh-TW",
      context: {
        targetText: "<env>...</env>",
        replacementHint: "<div>$1</div>",
      },
    });
    expect(r.systemPrompt).toContain("<env>...</env>");
    expect(r.systemPrompt).toContain("<div>$1</div>");
  });

  test("image-prompt picks up character context and target", () => {
    const r = resolveGenerator({
      type: "image-prompt",
      prompt: "雨夜黑发剑客",
      locale: "zh-TW",
      context: {
        imageTarget: "cover",
        characterName: "裴照",
        characterBio: "冷淡危险的世家少主",
        characterTags: ["古风", "暗恋"],
      },
    });
    expect(r.systemPrompt).toContain("角色图片提示词优化");
    expect(r.systemPrompt).toContain("目标用途：cover");
    expect(r.systemPrompt).toContain("裴照");
    expect(r.systemPrompt).toContain("古风、暗恋");
  });

  test("missing context vars degrade gracefully (empty string in slot, not crashing)", () => {
    const r = resolveGenerator({
      type: "replacement-html",
      prompt: "x",
      locale: "zh-TW",
      // no context
    });
    expect(r.systemPrompt).toContain("target_text:");
    expect(r.systemPrompt).toContain("variable_mapping: []");
    expect(r.systemPrompt).not.toContain("<<<TARGET_TEXT>>>");
  });

  test("all generator types resolve", () => {
    for (const type of GENERATOR_TYPES) {
      const r = resolveGenerator({ type, prompt: "test", locale: "zh-TW" });
      expect(r.systemPrompt.length).toBeGreaterThan(0);
    }
  });

  test("pins creator-facing output to each supported locale", () => {
    const traditional = buildGeneratorLanguageDirective("zh-TW");
    expect(traditional).toContain("繁體中文");
    expect(traditional).toContain("不得輸出簡體中文");
    expect(buildGeneratorLanguageDirective("ja-JP")).toContain("日本語");
    expect(buildGeneratorLanguageDirective("th-TH")).toContain("ภาษาไทย");
    expect(buildGeneratorLanguageDirective("en")).toContain("English");

    const resolved = resolveGenerator({
      type: "target-text",
      prompt: "inventory",
      locale: "th-TH",
    });
    expect(resolved.systemPrompt).toContain("<response_language>");
    expect(resolved.systemPrompt).toContain("ภาษาไทย");
    expect(resolved.systemPrompt).toContain("标签名");
    expect(resolved.systemPrompt).toContain("proposal type");
    expect(resolved.systemPrompt).toContain("$1/$2");
    expect(resolved.systemPrompt).toContain("{{char}}/{{user}}");
    expect(resolved.systemPrompt.endsWith("</response_language>")).toBe(true);
  });
});

describe("checkRateLimit", () => {
  test("first call is allowed and remaining decrements", () => {
    const userId = `rl-test-${Date.now()}-${Math.random()}`;
    const v = checkRateLimit(userId);
    expect(v.allowed).toBe(true);
    expect(v.remaining).toBe(19);
  });

  test("20 calls allowed, 21st refused", () => {
    const userId = `rl-test-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 20; i++) {
      const v = checkRateLimit(userId);
      expect(v.allowed).toBe(true);
    }
    const v21 = checkRateLimit(userId);
    expect(v21.allowed).toBe(false);
    expect(v21.remaining).toBe(0);
    expect(v21.resetAt).toBeGreaterThan(Date.now());
  });

  test("different users have independent counters", () => {
    const a = `rl-a-${Date.now()}-${Math.random()}`;
    const b = `rl-b-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 20; i++) checkRateLimit(a);
    expect(checkRateLimit(a).allowed).toBe(false);
    expect(checkRateLimit(b).allowed).toBe(true);
  });
});
