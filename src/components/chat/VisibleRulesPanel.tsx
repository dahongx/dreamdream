"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import type { RegexRule } from "@/lib/db/schema";
import { setRegexPreferenceAction } from "@/lib/regex/preferences-action";

interface Props {
  sessionId: string;
  /**
   * Only `visible=true && enabled=true` rules belong here. Caller filters.
   */
  rules: RegexRule[];
  /**
   * Initial state per rule. `true` = applied, `false` = user opted out.
   * Rules not in the map default to true.
   */
  initialPrefs: Record<string, boolean>;
  /**
   * Notify parent when a pref changes so the live render flips without
   * waiting for revalidatePath to refresh the RSC.
   */
  onChange: (ruleId: string, enabled: boolean) => void;
}

/**
 * Popover-style panel surfaced from the chat header. Lists rules the
 * creator marked `visible=true`; each row has an on/off switch. Hides
 * itself entirely when there are no visible rules.
 */
export function VisibleRulesPanel({
  sessionId,
  rules,
  initialPrefs,
  onChange,
}: Props) {
  const { dict } = useI18n();
  const t = dict.chat;
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (rules.length === 0) return null;

  function toggle(ruleId: string) {
    const next = prefs[ruleId] === false;
    setPrefs((p) => ({ ...p, [ruleId]: next }));
    onChange(ruleId, next);
    setPendingId(ruleId);
    startTransition(async () => {
      try {
        await setRegexPreferenceAction(ruleId, next, sessionId);
      } finally {
        // 无论成功或网络抛错都清掉 pending,否则该行 spinner 会永远转。
        setPendingId(null);
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-[var(--radius-sm)] border px-[var(--space-md)] py-[var(--space-xs)] text-xs uppercase tracking-[0.2em] transition-colors ${
          open
            ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
            : "border-border-subtle text-text-muted hover:text-text-primary"
        }`}
      >
        {t.visibleRulesButton}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+var(--space-xs))] z-20 flex w-72 flex-col gap-[var(--space-xs)] rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated p-[var(--space-md)] shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
            {t.visibleRulesTitle}
          </p>
          <p className="text-xs text-text-muted">{t.visibleRulesHint}</p>
          <ul className="mt-[var(--space-xs)] flex flex-col gap-[var(--space-xs)]">
            {rules.map((rule) => {
              const enabled = prefs[rule.id] !== false;
              return (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-[var(--space-sm)] rounded-[var(--radius-sm)] border border-border-subtle/40 bg-surface-glass px-[var(--space-sm)] py-[var(--space-xs)]"
                >
                  <span className="truncate font-body-zh text-sm text-text-primary">
                    {rule.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(rule.id)}
                    disabled={pendingId === rule.id}
                    className={`shrink-0 rounded-[var(--radius-pill)] px-[var(--space-sm)] py-[2px] text-xs ${
                      enabled
                        ? "bg-accent-primary/20 text-accent-primary"
                        : "bg-surface-glass text-text-muted"
                    } ${pendingId === rule.id ? "opacity-60" : ""}`}
                  >
                    {enabled ? t.visibleRulesOn : t.visibleRulesOff}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
