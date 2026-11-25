"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";

export async function setLocaleAction(locale: string): Promise<{ ok: true }> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, normalizeLocale(locale), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
