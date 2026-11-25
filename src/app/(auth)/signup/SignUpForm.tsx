"use client";

import Link from "next/link";
import { useState } from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { btnPrimaryLg } from "@/components/ui/button";
import { fieldCls } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/types";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { sfwServiceCopy } from "@/lib/legal/sfw-service-copy";

export function SignUpForm({
  dict,
  error,
  next,
}: {
  dict: Dict;
  error?: string;
  next?: string;
}) {
  const t = dict.auth;
  const { locale } = useI18n();
  // 原生 form POST 整页跳转；state 在导航前生效，按钮变呼吸点并
  // disabled，防重复提交（之前点击后零反馈、可连点）。
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/api/auth/signup"
      method="post"
      onSubmit={() => setSubmitting(true)}
      className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]"
    >
      {next && next !== "/" && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-[var(--space-xs)]">
        <span className="text-sm text-text-secondary">{t.emailLabel}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          className={fieldCls}
        />
      </label>
      <label className="flex flex-col gap-[var(--space-xs)]">
        <span className="text-sm text-text-secondary">{t.usernameLabel}</span>
        <input
          name="username"
          required
          autoComplete="username"
          minLength={2}
          maxLength={32}
          pattern="[\p{L}\p{M}\p{N}_-]{2,32}"
          placeholder={t.usernamePlaceholder}
          className={fieldCls}
        />
      </label>
      <label className="flex flex-col gap-[var(--space-xs)]">
        <span className="text-sm text-text-secondary">{t.passwordLabel}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder={t.passwordPlaceholder}
          className={fieldCls}
        />
      </label>
      <label className="flex flex-col gap-[var(--space-xs)]">
        <span className="text-sm text-text-secondary">
          {t.confirmPasswordLabel}
        </span>
        <input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className={fieldCls}
        />
      </label>
      {LEGAL_PAGES_ENABLED && (
        <div className="flex items-start gap-[var(--space-sm)] text-sm leading-relaxed text-text-secondary">
          <input
            id="sfw-signup-consent"
            name="sfwConsent"
            type="checkbox"
            value="accepted"
            required
            className="mt-[var(--space-xs)] shrink-0 accent-[var(--accent-primary)]"
          />
          <div>
            <label htmlFor="sfw-signup-consent">
              {sfwServiceCopy(locale).consent}{" "}
            </label>
            <Link
              href="/agreement/user"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-primary underline underline-offset-4"
            >
              {dict.legal.userAgreement}
            </Link>
            {dict.legal.signupConsentAnd}
            <Link
              href="/agreement/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-primary underline underline-offset-4"
            >
              {dict.legal.privacyPolicy}
            </Link>
          </div>
        </div>
      )}
      {error ? (
        <p className="text-sm text-semantic-error" aria-live="polite">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={btnPrimaryLg}
      >
        {submitting && <BreathingDots onAccent size={6} />}
        {submitting ? dict.signup.submitting : dict.signup.submit}
      </button>
    </form>
  );
}
