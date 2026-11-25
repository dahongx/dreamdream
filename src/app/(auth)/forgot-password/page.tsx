import Link from "next/link";
import { getRequestDict } from "@/i18n/server";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

interface ForgotPasswordPageProps {
  searchParams?: Promise<SearchParams>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const dict = await getRequestDict();
  const params = searchParams ? await searchParams : {};
  const messageKey = firstParam(params.message);
  const errorKey = firstParam(params.error);

  const notices: Record<string, string> = { resetSent: dict.auth.resetSent };
  const errors: Record<string, string> = {
    resetSessionMissing: dict.auth.resetSessionMissing,
  };

  const notice = messageKey ? notices[messageKey] : undefined;
  const error = errorKey ? errors[errorKey] : undefined;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-stretch justify-center gap-[var(--space-md)] px-[var(--page-px)] py-[var(--page-py)]">
      <header className="flex flex-col gap-[var(--space-sm)]">
        <h1 className="hero-title text-3xl">{dict.forgot.hero}</h1>
        <p className="text-base text-text-muted">{dict.forgot.prompt}</p>
      </header>

      <ForgotPasswordForm dict={dict} notice={notice} error={error} />

      <p className="text-center text-sm text-text-muted">
        <Link
          href="/signin"
          className="text-accent-primary underline-offset-4 hover:underline"
        >
          {dict.forgot.backToSignIn}
        </Link>
      </p>
    </main>
  );
}
