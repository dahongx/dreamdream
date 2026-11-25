import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  normalizeLocale,
  resolveLocaleFromAcceptLanguage,
} from "./config";
import { getDictionary } from "./dictionaries";
import type { Dict, Locale } from "./types";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale) return normalizeLocale(cookieLocale);

  const headerStore = await headers();
  return resolveLocaleFromAcceptLanguage(headerStore.get("accept-language"));
}

export async function getRequestDict(): Promise<Dict> {
  return getDictionary(await getRequestLocale());
}

export async function getRequestI18n(): Promise<{
  locale: Locale;
  dict: Dict;
}> {
  const locale = await getRequestLocale();
  return { locale, dict: await getDictionary(locale) };
}
