"use client";

import { useState } from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { fieldCls } from "@/components/ui/field";
import type { Dict } from "@/i18n/types";
import { AuthQueryMessage } from "../AuthQueryMessage";

export function ResetPasswordForm({
  dict,
  error,
}: {
  dict: Dict;
  error?: string;
}) {
  const t = dict.auth;
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/api/auth/reset-password"
      method="post"
      onSubmit={() => setSubmitting(true)}
      className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]"
    >
      <label className="flex flex-col gap-[var(--space-xs)]">
        <span className="text-sm text-text-secondary">
          {t.newPasswordLabel}
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={t.newPasswordPlaceholder}
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
          minLength={8}
          autoComplete="new-password"
          placeholder={t.newPasswordPlaceholder}
          className={fieldCls}
        />
      </label>
      <AuthQueryMessage
        errors={{
          passwordTooShort: t.passwordTooShort,
          passwordWeak: t.passwordWeak,
          passwordMismatch: t.passwordMismatch,
          resetFailed: t.resetFailed,
          resetSessionMissing: t.resetSessionMissing,
        }}
        fallbackError={t.resetFailed}
        initialError={error}
      />
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="inline-flex items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-base font-medium text-text-on-accent transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active disabled:opacity-70"
      >
        {submitting && <BreathingDots onAccent size={6} />}
        {submitting ? t.resettingButton : t.resetPasswordButton}
      </button>
    </form>
  );
}
