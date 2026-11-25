import { describe, expect, test } from "bun:test";
import {
  buildSystemPrompt,
  interpolate,
  parseOpening,
  resolveUserName,
} from "@/lib/ai/build-prompt";
import { DEARM_OUTPUT_PROTOCOL } from "@/lib/ai/output-protocol";

describe("parseOpening", () => {
  test("returns empty body and metadata buckets for empty input", () => {
    expect(parseOpening(null)).toEqual({
      firstAssistantBody: "",
      scenarios: [],
      systems: [],
    });
  });

  test("extracts scenario/system but preserves renderable opening content", () => {
    const result = parseOpening(
      "<narration>她推开门</narration><user>你来了。</user><message>等你很久了。</message><scenario>下午</scenario><system>保持克制</system>",
    );
    expect(result.firstAssistantBody).toBe(
      "<narration>她推开门</narration><user>你来了。</user><message>等你很久了。</message>",
    );
    expect(result.scenarios).toEqual(["下午"]);
    expect(result.systems).toEqual(["保持克制"]);
  });

  test("supports repeated metadata tags and ignores empty bodies", () => {
    const result = parseOpening(
      "<scenario>s1</scenario><scenario> </scenario><system>x</system><system>y</system>",
    );
    expect(result.scenarios).toEqual(["s1"]);
    expect(result.systems).toEqual(["x", "y"]);
  });
});

describe("interpolate", () => {
  test("replaces standard and paste-damaged char/user macros", () => {
    expect(
      interpolate("{{ Char }} sees {{USER}}; {<!-- -->{char}}; ｛{ user }}", {
        char: "陆沉",
        user: "Maat",
      }),
    ).toBe("陆沉 sees Maat; 陆沉; Maat");
  });

  test("preserves unrelated template variables and comments byte-for-byte", () => {
    const source = `{{state.hp}} <!-- keep --> $${"{theme.color}"} {{unknown}}`;
    expect(interpolate(source, { char: "C", user: "U" })).toBe(source);
  });
});

describe("resolveUserName", () => {
  test("localizes the anonymous fallback without overriding account or mask names", () => {
    const emptyUser = { displayName: null, username: null, name: null };
    expect(resolveUserName(emptyUser, null, "zh-Hant")).toBe("使用者");
    expect(resolveUserName(emptyUser, null, "ja-JP")).toBe("ユーザー");
    expect(resolveUserName(emptyUser, null, "th-TH")).toBe("ผู้ใช้");
    expect(resolveUserName(emptyUser, null, "en")).toBe("User");
    expect(
      resolveUserName({ ...emptyUser, username: "stable-name" }, null, "ja-JP"),
    ).toBe("stable-name");
    expect(resolveUserName(emptyUser, { name: "Mask Name" }, "th-TH")).toBe(
      "Mask Name",
    );
  });
});

describe("buildSystemPrompt", () => {
  const baseCharacter = {
    name: "陆沉",
    persona: "PERSONA_SENTINEL",
    adversity: "ADVERSITY_SENTINEL",
    defaultCognition: "COGNITION_SENTINEL",
    plotSetting: "PLOT_SENTINEL",
    outputSetting: "OUTPUT_SENTINEL",
    sampleDialogue: "SAMPLE_SENTINEL",
    opening: "<message>GREETING_SENTINEL</message>",
  };
  const baseUser = { displayName: "Maat", username: "maat", name: null };

  test("maps Dearm fields into the canonical six-slot order", () => {
    const prompt = buildSystemPrompt({
      character: baseCharacter,
      user: baseUser,
    });
    const sentinels = [
      "PERSONA_SENTINEL",
      "GREETING_SENTINEL",
      "OUTPUT_SENTINEL",
      "SAMPLE_SENTINEL",
      "PLOT_SENTINEL",
      "ADVERSITY_SENTINEL",
    ];
    let previous = -1;
    for (const sentinel of sentinels) {
      const index = prompt.indexOf(sentinel);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(prompt).toContain(
      "<DefaultCognition>\nCOGNITION_SENTINEL\n</DefaultCognition>",
    );
  });

  test("keeps the complete opening in Greeting as a format example", () => {
    const prompt = buildSystemPrompt({
      character: {
        ...baseCharacter,
        opening:
          '<message class="voice">台词</message><style>.x{color:red}</style><scenario>夜</scenario>',
      },
      user: baseUser,
    });
    expect(prompt).toContain(
      '<message class="voice">台词</message><style>.x{color:red}</style><scenario>夜</scenario>',
    );
  });

  test("does not invent empty recall/world/item slots absent from the master", () => {
    const prompt = buildSystemPrompt({
      character: baseCharacter,
      user: baseUser,
    });
    expect(prompt).not.toContain("<ItemSystem></ItemSystem>");
    expect(prompt).not.toContain("<WorldLore></WorldLore>");
    expect(prompt).not.toContain("<RecalledFragments></RecalledFragments>");
    expect(prompt).not.toContain("<RecentHistory></RecentHistory>");
  });

  test("the Dearm adapter defines user-tag restraint without replacing creator formats", () => {
    expect(DEARM_OUTPUT_PROTOCOL).toContain("<user>...</user>");
    expect(DEARM_OUTPUT_PROTOCOL).toContain(
      "Never emit <user> or <usr> in an ordinary reply",
    );
    expect(DEARM_OUTPUT_PROTOCOL).toContain(
      "Never repeat, quote, paraphrase, or restage",
    );
    expect(DEARM_OUTPUT_PROTOCOL).toContain("Creator-defined tags");
    expect(DEARM_OUTPUT_PROTOCOL).toContain(
      "scripts in direct model output are sanitized",
    );
    expect(DEARM_OUTPUT_PROTOCOL).toContain("creator-defined trigger tag");
  });

  test("writes structured mask data and resolves macros to the mask name", () => {
    const prompt = buildSystemPrompt({
      character: { ...baseCharacter, persona: "{{char}} 看着 {{user}}。" },
      user: baseUser,
      mask: {
        name: "阿月",
        gender: "女",
        description: "怕疼但嘴硬",
        preference: "喜欢慢节奏试探",
      },
    });
    expect(prompt).toContain("陆沉 看着 阿月。");
    expect(prompt).toContain("<UserName>阿月</UserName>");
    expect(prompt).toContain("<UserGender>女</UserGender>");
    expect(prompt).toContain("<UserDescription>怕疼但嘴硬</UserDescription>");
    expect(prompt).toContain("<UserPreference>喜欢慢节奏试探</UserPreference>");
  });

  test("selects English master instructions and Japanese response language", () => {
    const prompt = buildSystemPrompt({
      character: baseCharacter,
      user: baseUser,
      responseLocale: "ja-JP",
    });
    expect(prompt).toContain('<ResponseLanguage locale="ja-JP">');
    expect(prompt).toContain("natural Japanese");
    expect(prompt).toContain("PERSONA_SENTINEL");
  });

  test("is deterministic for identical inputs", () => {
    const input = { character: baseCharacter, user: baseUser };
    expect(buildSystemPrompt(input)).toBe(buildSystemPrompt(input));
  });
});
