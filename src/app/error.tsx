"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * App-wide error boundary. Catches unhandled throws from Server Components,
 * Server Actions, and client components below the layout. Sits inside the
 * Shell so the rail + topbar survive — only the failing surface goes dark.
 *
 * `reset()` re-runs the failing segment; useful for transient errors
 * (DB timeout, AI provider 5xx). The error digest is logged but not
 * shown — it's the Next-side hash for matching up with server logs.
 */
export default function GlobalError({ error, reset }: Props) {
  const { dict } = useI18n();
  useEffect(() => {
    // Browser console only; Server-side errors already land in the
    // Next dev terminal or the deploy logs.
    console.error("[dearm] caught error", error);
  }, [error]);

  const t = dict.error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-[var(--space-lg)] p-[var(--space-3xl)] text-center">
      <p className="font-mono text-base uppercase tracking-[0.3em] text-semantic-error">
        {t.eyebrow}
      </p>
      <h1 className="hero-title">{t.title}</h1>
      <p className="max-w-md text-base text-text-muted">{t.body}</p>
      {error.digest && (
        <p className="font-mono text-xs text-text-muted">ref: {error.digest}</p>
      )}
      <div className="mt-[var(--space-md)] flex flex-wrap items-center justify-center gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
        >
          {t.retry}
        </button>
        <Link
          href="/explore"
          className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-lg)] py-[var(--space-sm)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {t.goExplore}
        </Link>
      </div>
    </div>
  );
}
