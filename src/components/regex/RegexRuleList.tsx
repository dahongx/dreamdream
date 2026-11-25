"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import type { RegexRule } from "@/lib/db/schema";
import {
  deleteRegexRuleAction,
  swapRegexRuleOrderAction,
} from "@/lib/regex/actions";

interface Props {
  packId: string;
  rules: RegexRule[];
  variant?: "table" | "compact";
  readOnly?: boolean;
  /** 如果传入，「编辑」按钮不会跳老 edit 页而是回调 —— studio session 入口跳板。 */
  onEditOverride?: (ruleId: string) => void;
}

export function RegexRuleList({
  packId,
  rules,
  variant = "table",
  readOnly = false,
  onEditOverride,
}: Props) {
  const { dict } = useI18n();
  const t = dict.regex;
  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-[var(--space-sm)]">
        {rules.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/70 p-[var(--space-lg)]">
            <p className="font-display-zh text-lg text-text-primary">
              {t.emptyTitle}
            </p>
            <p className="mt-[var(--space-xs)] text-sm text-text-muted">
              {t.emptyHint}
            </p>
          </div>
        ) : (
          rules.map((rule, i) => (
            <CompactRow
              key={rule.id}
              rule={rule}
              packId={packId}
              prevRuleId={i > 0 ? rules[i - 1].id : null}
              nextRuleId={i < rules.length - 1 ? rules[i + 1].id : null}
              readOnly={readOnly}
              onEditOverride={onEditOverride}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-[var(--space-sm)] p-[var(--space-xl)] text-center">
          <p className="font-display-zh text-xl text-text-primary">
            {t.emptyTitle}
          </p>
          <p className="text-sm text-text-muted">{t.emptyHint}</p>
        </div>
      ) : (
        <table className="w-full table-auto text-left text-sm">
          <thead className="border-b border-border-subtle text-xs uppercase tracking-[0.2em] text-text-muted">
            <tr>
              <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                {t.listColName}
              </th>
              <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                {t.listColOrder}
              </th>
              {!readOnly && (
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.listColActions}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, i) => (
              <Row
                key={rule.id}
                rule={rule}
                packId={packId}
                prevRuleId={i > 0 ? rules[i - 1].id : null}
                nextRuleId={i < rules.length - 1 ? rules[i + 1].id : null}
                readOnly={readOnly}
                onEditOverride={onEditOverride}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CompactRow({
  rule,
  packId,
  prevRuleId,
  nextRuleId,
  readOnly,
  onEditOverride,
}: {
  rule: RegexRule;
  packId: string;
  prevRuleId: string | null;
  nextRuleId: string | null;
  readOnly: boolean;
  onEditOverride?: (ruleId: string) => void;
}) {
  const { dict } = useI18n();
  const t = dict.regex;
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    void (async () => {
      if (!(await dialog.confirm({ body: t.confirmDelete, danger: true })))
        return;
      startTransition(async () => {
        await deleteRegexRuleAction(rule.id);
      });
    })();
  }

  function onSwap(otherId: string | null) {
    if (!otherId) return;
    startTransition(async () => {
      await swapRegexRuleOrderAction(rule.id, otherId);
    });
  }

  return (
    <article
      className={`rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/70 p-[var(--space-md)] ${pending ? "opacity-50" : ""}`}
    >
      <h3 className="truncate font-display-zh text-lg leading-tight text-text-primary">
        {rule.name}
      </h3>
      <p className="mt-[var(--space-xs)] text-xs text-text-muted">
        {t.orderLabel} {rule.orderIndex}
      </p>

      {rule.outputGuidance && (
        <p className="mt-[var(--space-sm)] line-clamp-2 text-xs leading-relaxed text-text-muted">
          {rule.outputGuidance}
        </p>
      )}

      {!readOnly && (
        <div className="mt-[var(--space-md)] flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
          <div className="flex items-center gap-[var(--space-xs)]">
            <button
              type="button"
              onClick={() => onSwap(prevRuleId)}
              disabled={pending || !prevRuleId}
              aria-label={t.moveUpAria}
              className="rounded-[var(--radius-sm)] border border-border-subtle px-[6px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onSwap(nextRuleId)}
              disabled={pending || !nextRuleId}
              aria-label={t.moveDownAria}
              className="rounded-[var(--radius-sm)] border border-border-subtle px-[6px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
            >
              ↓
            </button>
          </div>
          <div className="flex gap-[var(--space-sm)] text-sm">
            {onEditOverride ? (
              <button
                type="button"
                onClick={() => onEditOverride(rule.id)}
                className="text-accent-primary hover:underline"
              >
                {t.actionEdit}
              </button>
            ) : (
              <Link
                href={`/packs/${packId}/rules/${rule.id}/edit`}
                className="text-accent-primary hover:underline"
              >
                {t.actionEdit}
              </Link>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="text-semantic-error hover:underline"
            >
              {t.actionDelete}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Row({
  rule,
  packId,
  prevRuleId,
  nextRuleId,
  readOnly,
  onEditOverride,
}: {
  rule: RegexRule;
  packId: string;
  prevRuleId: string | null;
  nextRuleId: string | null;
  readOnly: boolean;
  onEditOverride?: (ruleId: string) => void;
}) {
  const { dict } = useI18n();
  const t = dict.regex;
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    void (async () => {
      if (!(await dialog.confirm({ body: t.confirmDelete, danger: true })))
        return;
      startTransition(async () => {
        await deleteRegexRuleAction(rule.id);
      });
    })();
  }

  function onSwap(otherId: string | null) {
    if (!otherId) return;
    startTransition(async () => {
      await swapRegexRuleOrderAction(rule.id, otherId);
    });
  }

  return (
    <tr
      className={`border-b border-border-subtle/40 last:border-none ${pending ? "opacity-50" : ""}`}
    >
      <td className="px-[var(--space-md)] py-[var(--space-sm)] font-display-zh text-text-primary">
        {rule.name}
      </td>
      <td className="px-[var(--space-md)] py-[var(--space-sm)] font-mono text-text-muted">
        <div className="flex items-center gap-[var(--space-xs)]">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => onSwap(prevRuleId)}
                disabled={pending || !prevRuleId}
                aria-label={t.moveUpAria}
                className="rounded-[var(--radius-sm)] border border-border-subtle px-[6px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onSwap(nextRuleId)}
                disabled={pending || !nextRuleId}
                aria-label={t.moveDownAria}
                className="rounded-[var(--radius-sm)] border border-border-subtle px-[6px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
              >
                ↓
              </button>
            </>
          )}
          <span>{rule.orderIndex}</span>
        </div>
      </td>
      {!readOnly && (
        <td className="px-[var(--space-md)] py-[var(--space-sm)]">
          <div className="flex gap-[var(--space-sm)]">
            {onEditOverride ? (
              <button
                type="button"
                onClick={() => onEditOverride(rule.id)}
                className="text-accent-primary hover:underline"
              >
                {t.actionEdit}
              </button>
            ) : (
              <Link
                href={`/packs/${packId}/rules/${rule.id}/edit`}
                className="text-accent-primary hover:underline"
              >
                {t.actionEdit}
              </Link>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="text-semantic-error hover:underline"
            >
              {t.actionDelete}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
