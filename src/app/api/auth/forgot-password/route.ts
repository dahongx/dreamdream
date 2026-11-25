import { type NextRequest, NextResponse } from "next/server";
import { EMAIL_RE, normalizeEmail } from "@/lib/auth/identity";
import { publicUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(publicUrl(request, path), { status: 303 });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");

  // 防枚举:无论邮箱是否存在 / 格式是否合法,一律回同一句「已发送」,
  // 不给攻击者任何「这个邮箱注册过没」的信号。文案本身也是条件式措辞。
  if (EMAIL_RE.test(email)) {
    // 重置信里的链接点开后回到 /auth/callback,exchangeCodeForSession 建立
    // 「恢复会话」,再用 ?next= 把用户带到 /reset-password 填新密码。
    const redirectUrl = publicUrl(request, "/auth/callback");
    redirectUrl.searchParams.set("next", "/reset-password");

    const supabase = await createClient();
    // 失败(如限流)也不向用户暴露,同样走 resetSent —— 详情进服务端日志即可。
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl.toString(),
    });
  }

  return redirect(request, "/forgot-password?message=resetSent");
}
