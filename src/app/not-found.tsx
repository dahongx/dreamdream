import Link from "next/link";
import { getRequestDict } from "@/i18n/server";

/**
 * App-wide 404. Sits inside the Shell layout so the rail + topbar
 * still render — the dead end isn't the whole app, just the URL.
 */
export default async function NotFound() {
  const dict = await getRequestDict();
  const t = dict.notFound;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-[var(--space-lg)] p-[var(--space-3xl)] text-center">
      <p className="font-mono text-base uppercase tracking-[0.3em] text-text-secondary">
        404
      </p>
      <h1 className="hero-title">{t.title}</h1>
      <p className="max-w-md text-base text-text-muted">{t.body}</p>
      <div className="mt-[var(--space-md)] flex flex-wrap items-center justify-center gap-[var(--space-sm)]">
        <Link
          href="/explore"
          className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
        >
          {t.goExplore}
        </Link>
        <Link
          href="/mine"
          className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-lg)] py-[var(--space-sm)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {t.goLibrary}
        </Link>
      </div>
    </div>
  );
}
