import { describe, expect, test } from "bun:test";
import { resolveLocaleFromAcceptLanguage } from "@/i18n/config";
import {
  buildResponseLanguageSection,
  masterInstructionLocaleFor,
  normalizeConversationLocale,
  resolveConversationLocalePreference,
} from "@/lib/ai/conversation-locale";

describe("conversation locale", () => {
  test("normalizes launch-market aliases", () => {
    expect(normalizeConversationLocale("zh-TW")).toBe("zh-Hant");
    expect(normalizeConversationLocale("zh-HK")).toBe("zh-Hant");
    expect(normalizeConversationLocale("zh-Hant-TW")).toBe("zh-Hant");
    expect(normalizeConversationLocale("zh-SG")).toBe("zh-Hans");
    expect(normalizeConversationLocale("ja")).toBe("ja-JP");
    expect(normalizeConversationLocale("th_TH")).toBe("th-TH");
  });

  test("uses the reviewed English master units outside Simplified Chinese", () => {
    expect(masterInstructionLocaleFor("zh-Hans")).toBe("zh-Hans");
    expect(masterInstructionLocaleFor("zh-Hant")).toBe("en");
    expect(masterInstructionLocaleFor("ja-JP")).toBe("en");
    expect(masterInstructionLocaleFor("th-TH")).toBe("en");
  });

  test("keeps the Traditional UI fallback but defaults chat output to Simplified", () => {
    const uiLocale = resolveLocaleFromAcceptLanguage(null);
    expect(uiLocale).toBe("zh-TW");
    expect(normalizeConversationLocale(uiLocale)).toBe("zh-Hant");
    expect(resolveConversationLocalePreference(null, null)).toBe("zh-Hans");
  });

  test("resolves chat language from the raw cookie or weighted browser locale", () => {
    expect(resolveConversationLocalePreference("zh-TW", "zh-CN")).toBe(
      "zh-Hant",
    );
    expect(resolveConversationLocalePreference("zh-CN", "zh-TW")).toBe(
      "zh-Hans",
    );
    expect(
      resolveConversationLocalePreference(
        null,
        "en;q=0.4, zh-CN;q=0.9, zh-TW;q=0.8",
      ),
    ).toBe("zh-Hans");
    expect(
      resolveConversationLocalePreference(null, "zh-TW, zh-CN;q=0.8"),
    ).toBe("zh-Hant");
  });

  test("protects structural markup while setting natural-language output", () => {
    const section = buildResponseLanguageSection("th-TH");
    expect(section).toContain('locale="th-TH"');
    expect(section).toContain("natural Thai");
    expect(section).toContain(
      "Never translate identifiers or structural markup",
    );
  });
});
