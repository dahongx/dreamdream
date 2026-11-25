"use client";

import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import {
  markNotificationReadAction,
  type PlatformNotificationRow,
} from "@/lib/notifications/admin";

interface Props {
  initialItems: PlatformNotificationRow[];
  className?: string;
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell({ initialItems, className }: Props) {
  const { locale, dict } = useI18n();
  const [items, setItems] = useState(initialItems);
  const [hasUnreadDot, setHasUnreadDot] = useState(initialItems.length > 0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = dict.notifications;

  function typeLabel(
    type: PlatformNotificationRow["notificationType"],
  ): string {
    return type === "announcement" ? t.typeAnnouncement : t.typeReminder;
  }

  function markRead(id: string) {
    if (pendingId) return;
    setPendingId(id);
    startTransition(async () => {
      await markNotificationReadAction(id);
      setItems((current) => current.filter((item) => item.id !== id));
      setPendingId(null);
    });
  }

  function onOpenChange(open: boolean) {
    if (!open || !hasUnreadDot) return;
    setHasUnreadDot(false);
  }

  return (
    <Popover.Root onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t.triggerAria}
          className={`${className ?? "app-topbar-icon"} app-topbar-bell ${hasUnreadDot ? "has-unread" : ""}`}
        >
          <Bell size={21} strokeWidth={1.6} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          className="z-[80] w-[min(340px,calc(100vw-24px))] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-sm)] shadow-(--shadow-overlay) focus:outline-none"
        >
          <header className="flex items-center justify-between border-b border-border-subtle px-[var(--space-xs)] pb-[var(--space-sm)]">
            <h2 className="font-display-zh text-base text-text-primary">
              {t.title}
            </h2>
            {hasUnreadDot && (
              <span className="text-xs text-accent-gold-soft">
                {t.unreadCountFmt.replace("{count}", String(items.length))}
              </span>
            )}
          </header>

          {items.length === 0 ? (
            <p className="px-[var(--space-xs)] py-[var(--space-lg)] text-center text-sm text-text-muted">
              {t.empty}
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto py-[var(--space-xs)]">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={pendingId === item.id}
                  onClick={() => markRead(item.id)}
                  title={t.markReadHint}
                  className="block w-full rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-sm)] text-left transition-colors hover:bg-accent-primary/10 disabled:opacity-60"
                >
                  <div className="mb-[var(--space-xs)] flex items-center justify-between gap-[var(--space-sm)]">
                    <span className="rounded-[var(--radius-pill)] bg-accent-gold/12 px-[var(--space-xs)] py-[2px] text-[11px] text-accent-gold-soft">
                      {typeLabel(item.notificationType)}
                    </span>
                    <time className="font-mono text-[11px] text-text-muted">
                      {formatDateTime(item.createdAt, locale)}
                    </time>
                  </div>
                  <div className="font-display-zh text-sm text-text-primary">
                    {item.title}
                  </div>
                  <p className="mt-[var(--space-xs)] line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-text-secondary">
                    {item.body}
                  </p>
                </button>
              ))}
            </div>
          )}
          <Popover.Arrow className="fill-surface-solid" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
