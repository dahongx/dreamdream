import { type NextRequest, NextResponse } from "next/server";
import { EMAIL_RE, normalizeEmail } from "@/lib/auth/identity";
import { safeNextPath } from "@/lib/auth/next-path";
import { publicUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(publicUrl(request, path), { status: 303 });
}

function withNext(path: string, next: string): string {
  if (next === "/") return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}next=${encodeURIComponent(next)}`;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  const password = formData.get("password")?.toString() ?? "";
  const next = safeNextPath(formData.get("next")?.toString() ?? null);

  if (!EMAIL_RE.test(email) || !password) {
    return redirect(request, withNext("/signin?error=wrongCredentials", next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.message.toLowerCase();
    const key = message.includes("email not confirmed")
      ? "checkEmail"
      : "wrongCredentials";
    return redirect(request, withNext(`/signin?error=${key}`, next));
  }

  return redirect(request, next);
}
