"use client";

import { useModalClose } from "./useModalClose";

interface Props {
  label: string;
  /** Fallback URL when there's no history to pop (e.g. opened in a new tab). */
  fallbackHref: string;
}

export function ModalCloseButton({ label, fallbackHref }: Props) {
  const close = useModalClose(fallbackHref);

  return (
    <button
      type="button"
      onClick={close}
      className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
    >
      {label}
    </button>
  );
}
