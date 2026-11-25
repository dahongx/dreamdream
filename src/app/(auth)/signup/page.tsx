import Link from "next/link";
import { getRequestI18n } from "@/i18n/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { sfwServiceCopy } from "@/lib/legal/sfw-service-copy";
import { AuthBrandBackdrop, AuthBrandmark } from "../AuthBrandmark";
import { SignUpForm } from "./SignUpForm";

type SearchParams = Record<string, string | string[] | undefined>;

interface SignUpPageProps {
  searchParams?: Promise<SearchParams>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { dict, locale } = await getRequestI18n();
  const params = searchParams ? await searchParams : {};
  const errorKey = firstParam(params.error);
  const next = safeNextPath(firstParam(params.next) ?? null);
  const signinHref =
    next === "/" ? "/signin" : `/signin?next=${encodeURIComponent(next)}`;
  const errors: Record<string, string> = {
    sfwConsentRequired: sfwServiceCopy(locale).consentRequired,
    emailInvalid: dict.auth.emailInvalid,
    emailRequired: dict.auth.emailRequired,
    emailTaken: dict.auth.emailTaken,
    inviteInvalid: dict.auth.inviteInvalid,
    inviteRequired: dict.auth.inviteRequired,
    passwordMismatch: dict.auth.passwordMismatch,
    passwordTooShort: dict.auth.passwordTooShort,
    passwordWeak: dict.auth.passwordWeak,
    signupFailed: dict.auth.signupFailed,
    usernameInvalid: dict.auth.usernameInvalid,
    usernameTaken: dict.auth.usernameTaken,
  };
  const error = errorKey
    ? (errors[errorKey] ?? dict.auth.signupFailed)
    : undefined;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-stretch justify-center gap-[var(--space-lg)] px-[var(--page-px)] py-[var(--space-3xl)]">
      <AuthBrandBackdrop />
      <header className="flex flex-col gap-[var(--space-sm)] text-center">
        <AuthBrandmark />
        <h1 className="hero-title text-3xl">{dict.signup.hero}</h1>
      </header>

      <SignUpForm dict={dict} error={error} next={next} />

      {/* 同意声明必须挨着注册按钮 —— 协议第二章把「完成注册」定义成签约动作，
          用户得在按下去之前就看得到自己同意了什么，以及能点进去读全文。 */}
      {!LEGAL_PAGES_ENABLED && (
        <p className="text-center text-sm text-text-muted">
          {dict.legal.signupConsentPrefix}
          <Link
            href="/agreement/user"
            className="text-accent-primary underline-offset-4 hover:underline"
          >
            {dict.legal.userAgreement}
          </Link>
          {dict.legal.signupConsentAnd}
          <Link
            href="/agreement/privacy"
            className="text-accent-primary underline-offset-4 hover:underline"
          >
            {dict.legal.privacyPolicy}
          </Link>
          {dict.legal.signupConsentSuffix}
        </p>
      )}

      <p className="text-center text-sm text-text-muted">
        {dict.signup.hasAccountHint}{" "}
        <Link
          href={signinHref}
          className="text-accent-primary underline-offset-4 hover:underline"
        >
          {dict.signup.goSignIn}
        </Link>
      </p>
    </main>
  );
}
