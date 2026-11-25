import { type NextRequest, NextResponse } from "next/server";
import {
  EMAIL_RE,
  normalizeEmail,
  normalizeUsername,
  USERNAME_RE,
} from "@/lib/auth/identity";
import { safeNextPath } from "@/lib/auth/next-path";
import { validatePassword } from "@/lib/auth/password-policy";
import { publicUrl } from "@/lib/auth/urls";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { hasSfwSignupConsent } from "@/lib/legal/sfw-service-copy";
import { createClient } from "@/lib/supabase/server";

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(publicUrl(request, path), { status: 303 });
}

function withNext(path: string, next: string): string {
  if (next === "/") return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}next=${encodeURIComponent(next)}`;
}

function signupErrorKey(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("username") ||
    normalized.includes("users_username")
  ) {
    return "usernameTaken";
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("duplicate")
  ) {
    return "emailTaken";
  }

  return "signupFailed";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  const username = normalizeUsername(
    formData.get("username")?.toString() ?? "",
  );
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirmPassword")?.toString() ?? "";
  const next = safeNextPath(formData.get("next")?.toString() ?? null);
  if (LEGAL_PAGES_ENABLED && !hasSfwSignupConsent(formData)) {
    return redirect(
      request,
      withNext("/signup?error=sfwConsentRequired", next),
    );
  }

  if (!email)
    return redirect(request, withNext("/signup?error=emailRequired", next));
  if (!EMAIL_RE.test(email))
    return redirect(request, withNext("/signup?error=emailInvalid", next));
  if (!USERNAME_RE.test(username)) {
    return redirect(request, withNext("/signup?error=usernameInvalid", next));
  }
  const pwError = validatePassword(password);
  if (pwError)
    return redirect(request, withNext(`/signup?error=${pwError}`, next));
  if (password !== confirm)
    return redirect(request, withNext("/signup?error=passwordMismatch", next));

  // 把 next 透传到邮件确认链路:Supabase 发的确认邮件点击后回到 /auth/callback
  // → 我们用 ?next= 把 next 再带过去 → callback 成功后跳到原始目标。
  const emailRedirectUrl = publicUrl(request, "/auth/callback");
  if (next !== "/") {
    emailRedirectUrl.searchParams.set("next", next);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: emailRedirectUrl.toString(),
      data: {
        username,
        display_name: username,
        name: username,
        email,
      },
    },
  });

  if (error) {
    return redirect(
      request,
      withNext(`/signup?error=${signupErrorKey(error.message)}`, next),
    );
  }

  if (!data.session) {
    return redirect(request, withNext("/signin?message=checkEmail", next));
  }

  return redirect(request, next);
}
