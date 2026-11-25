import Link from "next/link";
import { getRequestDict } from "@/i18n/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { AuthBrandBackdrop, AuthBrandmark } from "../AuthBrandmark";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

interface SignInPageProps {
  searchParams?: Promise<SearchParams>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const dict = await getRequestDict();
  const params = searchParams ? await searchParams : {};
  const errorKey = firstParam(params.error);
  const messageKey = firstParam(params.message);
  const next = safeNextPath(firstParam(params.next) ?? null);
  const signupHref =
    next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  const errors: Record<string, string> = {
    callbackFailed: dict.auth.callbackFailed,
    checkEmail: dict.auth.checkEmail,
    emailInvalid: dict.auth.emailInvalid,
    wrongCredentials: dict.auth.wrongCredentials,
  };
  const notices: Record<string, string> = {
    checkEmail: dict.auth.checkEmail,
    confirmed: dict.auth.emailConfirmed,
    passwordReset: dict.auth.passwordReset,
    accountDeleted: dict.auth.accountDeleted,
  };

  const error = errorKey
    ? (errors[errorKey] ?? dict.auth.wrongCredentials)
    : undefined;
  const notice = messageKey ? notices[messageKey] : undefined;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-stretch justify-center gap-[var(--space-md)] px-[var(--page-px)] py-[var(--page-py)]">
      <AuthBrandBackdrop />
      <header className="flex flex-col gap-[var(--space-sm)] text-center">
        <AuthBrandmark />
        <h1 className="hero-title text-3xl">{dict.signin.hero}</h1>
      </header>

      <SignInForm dict={dict} error={error} notice={notice} next={next} />

      <p className="text-center text-sm text-text-muted">
        {dict.signin.noAccountHint}{" "}
        <Link
          href={signupHref}
          className="text-accent-primary underline-offset-4 hover:underline"
        >
          {dict.signin.goSignUp}
        </Link>
      </p>
    </main>
  );
}
