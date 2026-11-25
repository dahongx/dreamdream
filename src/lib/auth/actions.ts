"use server";

import { redirect } from "next/navigation";
import { getRequestDict } from "@/i18n/server";
import { revokeNewUserGrantIfPreviouslyDeleted } from "@/lib/account/new-user-grant";
import { validatePassword } from "@/lib/auth/password-policy";
import { createClient } from "@/lib/supabase/server";
import {
  EMAIL_RE,
  normalizeEmail,
  normalizeUsername,
  USERNAME_RE,
} from "./identity";

export interface SignupResult {
  error?: string;
}

export async function signupAction(
  _prev: SignupResult,
  formData: FormData,
): Promise<SignupResult> {
  const dict = await getRequestDict();
  const t = dict.auth;

  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  const username = normalizeUsername(
    formData.get("username")?.toString() ?? "",
  );
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirmPassword")?.toString() ?? "";

  if (!email) return { error: t.emailRequired };
  if (!EMAIL_RE.test(email)) return { error: t.emailInvalid };
  if (!USERNAME_RE.test(username)) return { error: t.usernameInvalid };
  const pwError = validatePassword(password);
  if (pwError) return { error: t[pwError] };
  if (password !== confirm) return { error: t.passwordMismatch };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: username,
        name: username,
        email,
      },
    },
  });

  if (error) return { error: t.signupFailed };

  // 这个邮箱注销过 → 不再发新人币。注销是硬删除且邮箱会被释放，不挡的话
  // 「注销 → 重注册」可以无限刷 100 金 / 200 银。见 new-user-grant.ts。
  if (data.user) {
    await revokeNewUserGrantIfPreviouslyDeleted(data.user.id, email);
  }

  if (!data.session) redirect("/signin?message=checkEmail");

  redirect("/");
}
