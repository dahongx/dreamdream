export const CONVERSATION_LOCALES = [
  "zh-Hans",
  "zh-Hant",
  "en",
  "ja-JP",
  "th-TH",
] as const;

export type ConversationLocale = (typeof CONVERSATION_LOCALES)[number];
export type MasterInstructionLocale = "zh-Hans" | "en";

const DEFAULT_CONVERSATION_LOCALE: ConversationLocale = "zh-Hans";

const RESPONSE_LANGUAGE_NAMES: Record<ConversationLocale, string> = {
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese using natural Taiwan terminology",
  en: "English",
  "ja-JP": "natural Japanese",
  "th-TH": "natural Thai",
};

function matchConversationLocale(
  input: string | null | undefined,
): ConversationLocale | null {
  const value = input?.trim().replaceAll("_", "-").toLowerCase();
  if (!value) return null;

  if (
    value.startsWith("zh-hant") ||
    value.startsWith("zh-tw") ||
    value.startsWith("zh-hk") ||
    value.startsWith("zh-mo")
  ) {
    return "zh-Hant";
  }
  if (
    value === "zh" ||
    value === "zh-hans" ||
    value.startsWith("zh-cn") ||
    value.startsWith("zh-sg")
  ) {
    return "zh-Hans";
  }
  if (value === "ja" || value.startsWith("ja-")) return "ja-JP";
  if (value === "th" || value.startsWith("th-")) return "th-TH";
  if (value === "en" || value.startsWith("en-")) return "en";
  return null;
}

export function normalizeConversationLocale(
  input: string | null | undefined,
  fallback: ConversationLocale = DEFAULT_CONVERSATION_LOCALE,
): ConversationLocale {
  return matchConversationLocale(input) ?? fallback;
}

/**
 * Resolve the model's natural-language output independently from the UI
 * dictionary. The UI currently folds every Chinese browser locale into
 * zh-TW, which previously erased the zh-CN/zh-Hans signal and made otherwise
 * Simplified-Chinese conversations occasionally switch to Traditional.
 *
 * An explicit locale cookie wins. Without one, honor Accept-Language quality
 * weights. When neither signal is usable, chat defaults to Simplified Chinese.
 */
export function resolveConversationLocalePreference(
  localeCookie: string | null | undefined,
  acceptLanguage: string | null | undefined,
): ConversationLocale {
  if (localeCookie) {
    return normalizeConversationLocale(
      localeCookie,
      DEFAULT_CONVERSATION_LOCALE,
    );
  }

  const candidates = (acceptLanguage ?? "")
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
    .filter(({ tag, q }) => tag.length > 0 && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const candidate of candidates) {
    const matched = matchConversationLocale(candidate.tag);
    if (matched) return matched;
  }

  return DEFAULT_CONVERSATION_LOCALE;
}

/**
 * The structured master template currently has two validated instruction-unit
 * sets: canonical Simplified Chinese and the reviewed English translation.
 * Non-Chinese conversations use the English instruction set until a complete,
 * separately versioned master translation exists for that locale.
 */
export function masterInstructionLocaleFor(
  locale: ConversationLocale,
): MasterInstructionLocale {
  return locale === "zh-Hans" ? "zh-Hans" : "en";
}

export function buildResponseLanguageSection(
  locale: ConversationLocale,
): string {
  return `<ResponseLanguage locale="${locale}">
Write all natural-language roleplay output in ${RESPONSE_LANGUAGE_NAMES[locale]}.
Preserve creator-defined tag names, HTML, CSS, JavaScript, selectors, URLs, variables, placeholders, and code exactly. Never translate identifiers or structural markup.
</ResponseLanguage>`;
}
