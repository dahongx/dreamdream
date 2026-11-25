"use client";

import { useActionState, useState } from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import {
  listModelPriceHistory,
  type ModelPriceHistoryRow,
  type ModelPriceRow,
  type UpdatePriceResult,
  updateModelPriceAction,
} from "@/lib/billing/admin";

interface Props {
  prices: ModelPriceRow[];
}

function formatPrice(usd: number): string {
  // Show enough precision for cheap models (DeepSeek cache_read $0.003625).
  // USD-only by design: the rate has its own column and per-message CNY
  // accounting happens elsewhere — duplicating ¥ here clutters the table.
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTimestamp(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminBillingSection({ prices }: Props) {
  const { dict } = useI18n();
  const t = dict.quota;
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="space-y-[var(--space-md)]">
      <header className="space-y-[var(--space-xs)]">
        <p className="text-xs text-text-muted">{t.adminBillingSubtitle}</p>
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-secondary">
          {t.adminBillingUnitHint}
        </p>
      </header>

      {prices.length === 0 ? (
        <p className="text-sm text-text-muted">{t.adminBillingEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-glass text-text-secondary">
                <th className="px-[var(--space-sm)] py-[var(--space-sm)]">
                  {t.adminBillingColModel}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColInput}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColOutput}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColCacheRead}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColCacheWrite}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColReasoning}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColCnyRate}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColGoldPerUse}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)] text-right">
                  {t.adminBillingColSilverPerUse}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)]">
                  {t.adminBillingColUpdatedAt}
                </th>
                <th className="px-[var(--space-sm)] py-[var(--space-sm)]">
                  {t.adminBillingColActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <PriceRow
                  key={p.modelId}
                  row={p}
                  isEditing={editing === p.modelId}
                  onEdit={() => setEditing(p.modelId)}
                  onCancel={() => setEditing(null)}
                  onSaved={() => setEditing(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface PriceRowProps {
  row: ModelPriceRow;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}

function PriceRow({
  row,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: PriceRowProps) {
  const { dict, locale } = useI18n();
  const t = dict.quota;

  const [state, formAction, isPending] = useActionState<
    UpdatePriceResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await updateModelPriceAction(prev, formData);
    if (result.ok) onSaved();
    return result;
  }, null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ModelPriceHistoryRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    if (history === null) {
      setHistoryLoading(true);
      try {
        const h = await listModelPriceHistory(row.modelId);
        setHistory(h);
      } finally {
        setHistoryLoading(false);
      }
    }
    setHistoryOpen(true);
  };

  if (isEditing) {
    return (
      <tr className="border-b border-border-subtle/50 bg-bg-base/40">
        <td colSpan={9} className="px-[var(--space-md)] py-[var(--space-md)]">
          <form action={formAction} className="space-y-[var(--space-sm)]">
            <input type="hidden" name="modelId" value={row.modelId} />
            <div className="flex flex-wrap items-end gap-[var(--space-md)]">
              <Field
                label={t.adminBillingDisplayName}
                name="displayName"
                defaultValue={row.displayName}
                width="w-48"
                error={
                  state?.ok === false
                    ? state.fieldErrors?.displayName
                    : undefined
                }
              />
              <PriceField
                label={t.adminBillingColInput}
                name="inputPerMTok"
                defaultValue={row.inputPerMTok}
                error={
                  state?.ok === false
                    ? state.fieldErrors?.inputPerMTok
                    : undefined
                }
              />
              <PriceField
                label={t.adminBillingColOutput}
                name="outputPerMTok"
                defaultValue={row.outputPerMTok}
                error={
                  state?.ok === false
                    ? state.fieldErrors?.outputPerMTok
                    : undefined
                }
              />
              <PriceField
                label={t.adminBillingColCacheRead}
                name="cacheReadPerMTok"
                defaultValue={row.cacheReadPerMTok}
                error={
                  state?.ok === false
                    ? state.fieldErrors?.cacheReadPerMTok
                    : undefined
                }
              />
              <PriceField
                label={t.adminBillingColCacheWrite}
                name="cacheWritePerMTok"
                defaultValue={row.cacheWritePerMTok}
                error={
                  state?.ok === false
                    ? state.fieldErrors?.cacheWritePerMTok
                    : undefined
                }
              />
              <PriceField
                label={t.adminBillingColReasoning}
                name="reasoningPerMTok"
                defaultValue={row.reasoningPerMTok}
                error={
                  state?.ok === false
                    ? state.fieldErrors?.reasoningPerMTok
                    : undefined
                }
              />
              <PriceField
                label={t.adminBillingColCnyRate}
                name="usdCnyRate"
                defaultValue={row.usdCnyRate}
                error={
                  state?.ok === false
                    ? state.fieldErrors?.usdCnyRate
                    : undefined
                }
              />
              <Field
                label={t.adminBillingColGoldPerUse}
                name="goldCostPerCall"
                defaultValue={String(row.goldCostPerCall)}
                width="w-24"
                error={
                  state?.ok === false
                    ? state.fieldErrors?.goldCostPerCall
                    : undefined
                }
              />
              <Field
                label={t.adminBillingColSilverPerUse}
                name="silverCostPerCall"
                defaultValue={String(row.silverCostPerCall)}
                width="w-24"
                error={
                  state?.ok === false
                    ? state.fieldErrors?.silverCostPerCall
                    : undefined
                }
              />
            </div>
            <Field
              label={t.adminBillingNotes}
              name="notes"
              defaultValue={row.notes ?? ""}
              width="w-full max-w-xl"
            />
            {state && !state.ok && (
              <p className="text-xs text-semantic-error">{state.error}</p>
            )}
            <div className="flex items-center gap-[var(--space-sm)]">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-xs font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {isPending ? t.adminBillingSaving : t.adminBillingSave}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className="rounded-[var(--radius-sm)] border border-border-strong px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-secondary transition-colors hover:bg-surface-glass disabled:opacity-50"
              >
                {t.adminBillingCancel}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-border-subtle/50">
        <td className="px-[var(--space-sm)] py-[var(--space-sm)]">
          <div className="font-mono text-text-primary">{row.displayName}</div>
          <div className="text-[10px] text-text-muted">{row.modelId}</div>
          {row.notes && (
            <div className="mt-px text-[10px] text-text-muted/80">
              {row.notes}
            </div>
          )}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {formatPrice(row.inputPerMTok)}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {formatPrice(row.outputPerMTok)}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {formatPrice(row.cacheReadPerMTok)}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {formatPrice(row.cacheWritePerMTok)}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {formatPrice(row.reasoningPerMTok)}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {row.usdCnyRate.toFixed(4)}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {row.goldCostPerCall}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-right font-mono text-text-secondary">
          {row.silverCostPerCall}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)] text-text-muted">
          <div>{formatTimestamp(row.updatedAt, locale)}</div>
          {row.updatedByEmail && (
            <div className="text-[10px] text-text-muted/70">
              {row.updatedByEmail}
            </div>
          )}
        </td>
        <td className="px-[var(--space-sm)] py-[var(--space-sm)]">
          <div className="flex items-center gap-[var(--space-xs)]">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-[var(--radius-sm)] border border-accent-primary/40 px-[var(--space-sm)] py-px text-[11px] text-accent-primary transition-colors hover:bg-accent-primary/10"
            >
              {t.adminBillingEdit}
            </button>
            <button
              type="button"
              onClick={toggleHistory}
              className="rounded-[var(--radius-sm)] border border-border-strong px-[var(--space-sm)] py-px text-[11px] text-text-secondary transition-colors hover:bg-surface-glass"
            >
              {historyOpen
                ? t.adminBillingHistoryHide
                : t.adminBillingHistoryToggle}
            </button>
            {state?.ok && (
              <span className="text-[10px] text-accent-primary">
                {t.adminBillingSaved}
              </span>
            )}
          </div>
        </td>
      </tr>
      {historyOpen && (
        <tr className="border-b border-border-subtle/50 bg-bg-base/30">
          <td colSpan={9} className="px-[var(--space-md)] py-[var(--space-sm)]">
            {historyLoading ? (
              <BreathingDots size={5} />
            ) : !history || history.length === 0 ? (
              <p className="text-[11px] text-text-muted">
                {t.adminBillingHistoryEmpty}
              </p>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-left">
                      {t.adminBillingHistoryEffective}
                    </th>
                    <th className="text-right">{t.adminBillingColInput}</th>
                    <th className="text-right">{t.adminBillingColOutput}</th>
                    <th className="text-right">{t.adminBillingColCacheRead}</th>
                    <th className="text-right">
                      {t.adminBillingColCacheWrite}
                    </th>
                    <th className="text-right">{t.adminBillingColReasoning}</th>
                    <th className="text-right">{t.adminBillingColCnyRate}</th>
                    <th className="text-left">{t.adminBillingColUpdatedBy}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="text-text-secondary">
                        {formatTimestamp(h.effectiveFrom, locale)}
                      </td>
                      <td className="text-right font-mono text-text-secondary">
                        {formatPrice(h.inputPerMTok)}
                      </td>
                      <td className="text-right font-mono text-text-secondary">
                        {formatPrice(h.outputPerMTok)}
                      </td>
                      <td className="text-right font-mono text-text-secondary">
                        {formatPrice(h.cacheReadPerMTok)}
                      </td>
                      <td className="text-right font-mono text-text-secondary">
                        {formatPrice(h.cacheWritePerMTok)}
                      </td>
                      <td className="text-right font-mono text-text-secondary">
                        {formatPrice(h.reasoningPerMTok)}
                      </td>
                      <td className="text-right font-mono text-text-secondary">
                        {h.usdCnyRate.toFixed(4)}
                      </td>
                      <td className="text-text-muted">
                        {h.changedByEmail ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  width,
  error,
}: {
  label: string;
  name: string;
  defaultValue: string;
  width: string;
  error?: string[];
}) {
  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      <label
        htmlFor={`billing-${name}`}
        className="text-[10px] uppercase tracking-[0.1em] text-text-muted"
      >
        {label}
      </label>
      <input
        id={`billing-${name}`}
        name={name}
        defaultValue={defaultValue}
        className={`${width} rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-primary focus:border-accent-primary focus:outline-none`}
      />
      {error?.[0] && (
        <p className="text-[10px] text-semantic-error">{error[0]}</p>
      )}
    </div>
  );
}

function PriceField({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue: number;
  error?: string[];
}) {
  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      <label
        htmlFor={`billing-${name}`}
        className="text-[10px] uppercase tracking-[0.1em] text-text-muted"
      >
        {label}
      </label>
      <input
        id={`billing-${name}`}
        name={name}
        type="number"
        step="any"
        min="0"
        defaultValue={defaultValue}
        required
        className="w-24 rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] text-right font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
      />
      {error?.[0] && (
        <p className="text-[10px] text-semantic-error">{error[0]}</p>
      )}
    </div>
  );
}
