import "server-only";

import type { Locale } from "./config";
import type { Dict } from "./types";

const loaders: Record<Locale, () => Promise<Dict>> = {
  "zh-TW": async () => (await import("./zh-TW")).zhTW,
  "ja-JP": async () => (await import("./ja-JP")).jaJP,
  "th-TH": async () => (await import("./th-TH")).thTH,
  en: async () => (await import("./en")).en,
};

/** Load only the selected dictionary into the RSC payload. */
export async function getDictionary(locale: Locale): Promise<Dict> {
  return loaders[locale]();
}
