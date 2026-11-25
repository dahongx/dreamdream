"use server";

import { redirect } from "next/navigation";
import { getRequestDict } from "@/i18n/server";
import { EMAIL_RE, normalizeEmail } from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/server";

export interface SignInResult {
  error?: string;
}

export async function signInAction(
  _prev: SignInResult,
  formData: FormData,
): Promise<SignInResult> {
  const dict = await getRequestDict();
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  const password = formData.get("password")?.toString() ?? "";

  if (!EMAIL_RE.test(email) || !password) {
    return { error: dict.auth.wrongCredentials };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: error.message.toLowerCase().includes("email not confirmed")
        ? dict.auth.checkEmail
        : dict.auth.wrongCredentials,
    };
  }

  redirect("/");
}
