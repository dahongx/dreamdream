/**
 * Public i18n types and locale utilities. Dictionaries stay behind the
 * server-only dynamic loader so client modules never import every language.
 */

export type { Locale } from "./config";
export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_OPTIONS,
  localeToHtmlLang,
  normalizeLocale,
  resolveLocaleFromAcceptLanguage,
  SUPPORTED_LOCALES,
} from "./config";
export type { Dict } from "./types";
