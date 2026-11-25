export const LOCALE_COOKIE = "nj_locale";

/**
 * Shipping locales. The product no longer serves Simplified Chinese: Traditional
 * Chinese is the default and Simplified requests fold into it. `src/i18n/zh.ts`
 * survives only as the authoring source the translation-parity tests diff
 * against — it is not registered here and can never be selected.
 */
export const SUPPORTED_LOCALES = ["zh-TW", "ja-JP", "th-TH", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-TW";

export const LOCALE_OPTIONS: ReadonlyArray<{
  value: Locale;
  label: string;
}> = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "ja-JP", label: "日本語" },
  { value: "th-TH", label: "ไทย" },
  { value: "en", label: "English" },
];

export function matchSupportedLocale(
  input: string | null | undefined,
): Locale | null {
  const value = input?.trim().replaceAll("_", "-").toLowerCase();
  if (!value || value === "*") return null;

  // Every Chinese tag folds into Traditional — including Simplified requests and
  // the legacy `zh` / `zh-CN` cookies still held by pre-migration users.
  if (value === "zh" || value.startsWith("zh-")) return "zh-TW";
  if (value === "ja" || value.startsWith("ja-")) return "ja-JP";
  if (value === "th" || value.startsWith("th-")) return "th-TH";
  if (value === "en" || value.startsWith("en-")) return "en";
  return null;
}

export function normalizeLocale(input: string | null | undefined): Locale {
  return matchSupportedLocale(input) ?? DEFAULT_LOCALE;
}

export function localeToHtmlLang(locale: Locale): string {
  return locale;
}

/** Respect quality weights instead of assuming the first language wins. */
export function resolveLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const candidates = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((param) =>
        param.trim().toLowerCase().startsWith("q="),
      );
      const parsedQ = qParam ? Number(qParam.trim().slice(2)) : 1;
      return {
        tag,
        q: Number.isFinite(parsedQ) ? parsedQ : 0,
        index,
      };
    })
    .filter(({ q }) => q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const candidate of candidates) {
    const locale = matchSupportedLocale(candidate.tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
