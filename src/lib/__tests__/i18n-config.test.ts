import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  matchSupportedLocale,
  normalizeLocale,
  resolveLocaleFromAcceptLanguage,
  SUPPORTED_LOCALES,
} from "@/i18n/config";

describe("i18n locale resolution", () => {
  test("ships four locales and never offers Simplified Chinese", () => {
    expect([...SUPPORTED_LOCALES]).toEqual(["zh-TW", "ja-JP", "th-TH", "en"]);
    expect(DEFAULT_LOCALE).toBe("zh-TW");
    expect(LOCALE_OPTIONS.map((option) => option.value)).toEqual([
      ...SUPPORTED_LOCALES,
    ]);
  });

  test("folds every Chinese tag — including legacy zh-CN cookies — into zh-TW", () => {
    expect(normalizeLocale("zh")).toBe("zh-TW");
    expect(normalizeLocale("zh-CN")).toBe("zh-TW");
    expect(normalizeLocale("zh-Hant-HK")).toBe("zh-TW");
    expect(normalizeLocale("zh-Hans-CN")).toBe("zh-TW");
    expect(normalizeLocale("zh-Hans-SG")).toBe("zh-TW");
    expect(normalizeLocale("zh-SG")).toBe("zh-TW");
    expect(normalizeLocale("ja")).toBe("ja-JP");
    expect(normalizeLocale("th_TH")).toBe("th-TH");
    expect(normalizeLocale("unknown")).toBe("zh-TW");
    expect(matchSupportedLocale("unknown")).toBeNull();
  });

  test("honors Accept-Language quality weights and skips unsupported tags", () => {
    expect(
      resolveLocaleFromAcceptLanguage("fr-FR, th-TH;q=0.8, ja-JP;q=0.9"),
    ).toBe("ja-JP");
    expect(resolveLocaleFromAcceptLanguage("en;q=0, zh-HK;q=0.7")).toBe(
      "zh-TW",
    );
  });
});
