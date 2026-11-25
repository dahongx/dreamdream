"use client";

import { useState } from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { fieldCls } from "@/components/ui/field";
import type { Dict } from "@/i18n/types";
import { AuthQueryMessage } from "../AuthQueryMessage";

export function ForgotPasswordForm({
  dict,
  notice,
  error,
}: {
  dict: Dict;
  notice?: string;
  error?: string;
}) {
  const t = dict.auth;
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/api/auth/forgot-password"
      method="post"
      onSubmit={() => setSubmitting(true)}
      className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]"
    >
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
      <AuthQueryMessage
        errors={{ resetSessionMissing: t.resetSessionMissing }}
        notices={{ resetSent: t.resetSent }}
        initialError={error}
        initialNotice={notice}
      />
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="inline-flex items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-base font-medium text-text-on-accent transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active disabled:opacity-70"
      >
        {submitting && <BreathingDots onAccent size={6} />}
        {submitting ? t.sendingResetButton : t.sendResetButton}
      </button>
    </form>
  );
}
