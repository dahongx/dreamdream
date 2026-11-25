"use client";

import { Megaphone } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useI18n } from "@/i18n/client";
import {
  createAnnouncementAction,
  type NotificationActionResult,
  type PlatformNotificationRow,
} from "@/lib/notifications/admin";

interface Props {
  announcements: PlatformNotificationRow[];
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminAnnouncementsSection({ announcements }: Props) {
  const { dict, locale } = useI18n();
  const t = dict.admin;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    NotificationActionResult | null,
    FormData
  >(createAnnouncementAction, null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="space-y-[var(--space-lg)]">
      <form
        ref={formRef}
        action={formAction}
        className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]"
      >
        <div className="mb-[var(--space-md)] flex items-center gap-[var(--space-sm)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-accent-gold/12 text-accent-gold-soft">
            <Megaphone width={18} height={18} strokeWidth={1.6} />
          </span>
          <div>
            <h2 className="font-display-zh text-lg text-text-primary">
              {t.announcementCreateTitle}
            </h2>
            <p className="text-xs text-text-muted">
              {t.announcementCreateHint}
            </p>
          </div>
        </div>

        <div className="space-y-[var(--space-md)]">
          <label className="block space-y-[var(--space-xs)]">
            <span className="text-xs text-text-secondary">
              {t.announcementTitleLabel}
            </span>
            <input
              name="title"
              required
              maxLength={120}
              className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-sm)] text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary"
              placeholder={t.announcementTitlePlaceholder}
            />
            {state?.ok === false && state.fieldErrors?.title && (
              <span className="text-xs text-semantic-error">
                {state.fieldErrors.title[0]}
              </span>
            )}
          </label>

          <label className="block space-y-[var(--space-xs)]">
            <span className="text-xs text-text-secondary">
              {t.announcementBodyLabel}
            </span>
            <textarea
              name="body"
              required
              maxLength={3000}
              rows={5}
              className="w-full resize-y rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-sm)] text-sm leading-7 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary"
              placeholder={t.announcementBodyPlaceholder}
            />
            {state?.ok === false && state.fieldErrors?.body && (
              <span className="text-xs text-semantic-error">
                {state.fieldErrors.body[0]}
              </span>
            )}
          </label>

          <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-[var(--radius-pill)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent shadow-(--shadow-cta) transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
            >
              {isPending ? t.announcementPublishing : t.announcementPublish}
            </button>
            {state?.ok && (
              <span className="text-xs text-semantic-success">
                {t.announcementPublished}
              </span>
            )}
            {state && !state.ok && (
              <span className="text-xs text-semantic-error">{state.error}</span>
            )}
          </div>
        </div>
      </form>

      <section className="space-y-[var(--space-md)]">
        <h2 className="font-display-zh text-lg text-text-primary">
          {t.announcementHistoryTitle}
        </h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-text-muted">
            {t.announcementHistoryEmpty}
          </p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle">
            {announcements.map((item) => (
              <article
                key={item.id}
                className="border-b border-border-subtle/60 bg-surface-glass/50 p-[var(--space-md)] last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
                  <h3 className="font-display-zh text-base text-text-primary">
                    {item.title}
                  </h3>
                  <time className="font-mono text-xs text-text-muted">
                    {formatDateTime(item.createdAt, locale)}
                  </time>
                </div>
                <p className="mt-[var(--space-sm)] whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
