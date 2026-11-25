"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useActionState, useCallback, useState } from "react";
import { useI18n } from "@/i18n/client";
import {
  type RedeemResult,
  redeemInviteCodeAction,
} from "@/lib/invite/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuotaExhaustedModal({ open, onOpenChange }: Props) {
  const { dict } = useI18n();
  const t = dict.quota;

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

  if (state?.ok) {
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-md" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border-subtle bg-bg-elevated p-[var(--space-lg)] shadow-2xl">
          <Dialog.Title className="font-display-zh text-xl text-text-primary">
            {t.quotaExhaustedTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-sm)] font-body-zh text-sm leading-relaxed text-text-secondary">
            {t.quotaExhaustedBody}
          </Dialog.Description>

          <div className="mt-[var(--space-lg)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]">
            <p className="text-sm text-text-secondary">{t.qqGroupHint}</p>
            <div className="mt-[var(--space-sm)] flex items-center gap-[var(--space-sm)]">
              <code className="rounded-[var(--radius-sm)] bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] font-mono text-lg text-accent-primary">
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
          </div>

          <form action={formAction} className="mt-[var(--space-lg)]">
            <label
              htmlFor="quota-modal-invite-code"
              className="block text-sm text-text-secondary"
            >
              {t.inviteCodeLabel}
            </label>
            <div className="mt-[var(--space-xs)] flex gap-[var(--space-sm)]">
              <input
                id="quota-modal-invite-code"
                name="code"
                type="text"
                placeholder={t.inviteCodePlaceholder}
                className="flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
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

          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-[var(--space-md)] top-[var(--space-md)] text-text-muted transition-colors hover:text-text-primary"
              aria-label={t.insufficientCurrencyDismissAria}
            >
              ✕
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
