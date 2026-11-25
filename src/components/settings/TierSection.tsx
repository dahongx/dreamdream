"use client";

import { useActionState, useCallback, useState } from "react";
import { fieldBaseCls } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import type { UserRole } from "@/lib/db/schema";
import {
  type RedeemResult,
  redeemInviteCodeAction,
} from "@/lib/invite/actions";

interface Props {
  role: UserRole;
  dailyUsed: number;
  dailyLimit: number;
}

const TIER_COLORS: Record<string, string> = {
  regular: "bg-text-muted/20 text-text-secondary",
  beta_tester: "bg-accent-primary/20 text-accent-primary",
  admin: "bg-accent-amber/20 text-accent-amber",
};

export function TierSection({ role, dailyUsed, dailyLimit }: Props) {
  const { dict } = useI18n();
  const t = dict.quota;

  const tierLabel =
    role === "admin"
      ? t.tierAdmin
      : role === "beta_tester"
        ? t.tierBetaTester
        : t.tierRegular;

  const [state, formAction, isPending] = useActionState<
    RedeemResult | null,
    FormData
  >(redeemInviteCodeAction, null);

  const [copied, setCopied] = useState(false);

  const copyGroupNumber = useCallback(() => {
    navigator.clipboard.writeText(t.qqGroupNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [t.qqGroupNumber]);

  return (
    <section className="space-y-[var(--space-md)]">
      <h2 className="font-display-zh text-lg text-text-primary">
        {t.upgradeTitle}
      </h2>

      <div className="flex items-center gap-[var(--space-md)]">
        <span
          className={`rounded-[var(--radius-pill)] px-[var(--space-md)] py-[var(--space-xs)] text-xs font-semibold ${TIER_COLORS[role] ?? TIER_COLORS.regular}`}
        >
          {tierLabel}
        </span>
        <span className="text-sm text-text-secondary">
          {t.dailyUsageFmt
            .replace("{used}", String(dailyUsed))
            .replace("{limit}", String(dailyLimit))}
        </span>
      </div>

      {state?.ok && (
        <p className="rounded-[var(--radius-sm)] border border-accent-primary/40 bg-accent-primary/10 p-[var(--space-sm)] text-sm text-accent-primary">
          {t.inviteCodeSuccess}
        </p>
      )}

      {role === "regular" && (
        <div className="space-y-[var(--space-md)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]">
          <p className="text-sm text-text-secondary">{t.upgradeHint}</p>

          <div className="flex items-center gap-[var(--space-sm)]">
            <span className="text-sm text-text-secondary">
              {t.qqGroupHint}:
            </span>
            <code className="rounded-[var(--radius-sm)] bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] font-mono text-accent-primary">
              {t.qqGroupNumber}
            </code>
            <button
              type="button"
              onClick={copyGroupNumber}
              className="rounded-[var(--radius-sm)] border border-border-strong px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary transition-colors hover:bg-surface-glass"
            >
              {copied ? t.qqGroupCopied : t.inviteCopy}
            </button>
          </div>

          <form action={formAction}>
            <label
              htmlFor="settings-invite-code"
              className="block text-sm text-text-secondary"
            >
              {t.inviteCodeLabel}
            </label>
            <div className="mt-[var(--space-xs)] flex gap-[var(--space-sm)]">
              <input
                id="settings-invite-code"
                name="code"
                type="text"
                placeholder={t.inviteCodePlaceholder}
                className={`${fieldBaseCls} flex-1 px-[var(--space-md)] py-[var(--space-sm)] text-sm`}
                autoComplete="off"
                required
              />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {isPending ? t.inviteCodeSubmitting : t.inviteCodeSubmit}
              </button>
            </div>
            {state && !state.ok && (
              <p className="mt-[var(--space-xs)] text-xs text-semantic-error">
                {t.inviteCodeError}
              </p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
