import { redirect } from "next/navigation";
import { getRequestDict } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

interface ResetPasswordPageProps {
  searchParams?: Promise<SearchParams>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const dict = await getRequestDict();
  const params = searchParams ? await searchParams : {};
  const errorKey = firstParam(params.error);

  // 只有从重置邮件链接进来(callback 已 exchangeCodeForSession 建立恢复会话)
  // 才有 user。直接输入 URL 访问 → 无会话 → 打回忘记密码页，别露出改密表单。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password?error=resetSessionMissing");
  }

  const errors: Record<string, string> = {
    passwordTooShort: dict.auth.passwordTooShort,
    passwordWeak: dict.auth.passwordWeak,
    passwordMismatch: dict.auth.passwordMismatch,
    resetFailed: dict.auth.resetFailed,
    resetSessionMissing: dict.auth.resetSessionMissing,
  };
  const error = errorKey
    ? (errors[errorKey] ?? dict.auth.resetFailed)
    : undefined;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-stretch justify-center gap-[var(--space-md)] px-[var(--page-px)] py-[var(--page-py)]">
      <header className="flex flex-col gap-[var(--space-sm)]">
        <h1 className="hero-title text-3xl">{dict.reset.hero}</h1>
      </header>

      <ResetPasswordForm dict={dict} error={error} />
    </main>
  );
}
