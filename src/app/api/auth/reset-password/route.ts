import { type NextRequest, NextResponse } from "next/server";
import { validatePassword } from "@/lib/auth/password-policy";
import { publicUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(publicUrl(request, path), { status: 303 });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirmPassword")?.toString() ?? "";

  const pwError = validatePassword(password);
  if (pwError) {
    return redirect(request, `/reset-password?error=${pwError}`);
  }
  if (password !== confirm) {
    return redirect(request, "/reset-password?error=passwordMismatch");
  }

  const supabase = await createClient();
  // 授权靠恢复会话(来自邮件链接 → callback)。会话不在 → 打回忘记密码页。
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect(request, "/forgot-password?error=resetSessionMissing");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return redirect(request, "/reset-password?error=resetFailed");
  }

  // 改密成功后登出恢复会话,让用户用新密码在 /signin 重新登录一次(干净)。
  await supabase.auth.signOut();
  return redirect(request, "/signin?message=passwordReset");
}
