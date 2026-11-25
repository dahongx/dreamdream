"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useI18n } from "@/i18n/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencyType: "gold" | "silver" | null;
  required: number | null;
  balance: number | null;
}

export function InsufficientCurrencyModal({
  open,
  onOpenChange,
  currencyType,
  required,
  balance,
}: Props) {
  const { dict } = useI18n();
  const t = dict.quota;

  const currencyLabel =
    currencyType === "gold" ? t.currencyGoldLabel : t.currencySilverLabel;
  const body = t.insufficientCurrencyBodyFmt
    .replace("{required}", String(required ?? "—"))
    .replace("{balance}", String(balance ?? "—"))
    .replace("{currencyLabel}", currencyLabel);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-md" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border-subtle bg-bg-elevated p-[var(--space-lg)] shadow-2xl">
          <Dialog.Title className="font-display-zh text-xl text-text-primary">
            {t.insufficientCurrencyTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-sm)] font-body-zh text-sm leading-relaxed text-text-secondary">
            {body}
          </Dialog.Description>

          <div className="mt-[var(--space-lg)] flex justify-end">
            <Dialog.Close asChild>
              <Link
                href="/shop"
                className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
              >
                {t.insufficientCurrencyShopCta}
              </Link>
            </Dialog.Close>
          </div>

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
