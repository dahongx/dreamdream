"use client";

import { useActionState, useCallback, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import {
  type GenerateResult,
  generateInviteCodeAction,
  type InviteCodeItem,
} from "@/lib/invite/admin";

interface Props {
  codes: InviteCodeItem[];
}

function codeStatus(code: InviteCodeItem): "active" | "used" | "expired" {
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return "expired";
  if (code.usedCount >= code.maxUses) return "used";
  return "active";
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-accent-primary/20 text-accent-primary",
  used: "bg-text-muted/20 text-text-secondary",
  expired: "bg-semantic-error/20 text-semantic-error",
};

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// CNY snapshot 是 millicents 整数（1 CNY = 100_000）。与 AdminUsageSection
// 同口径展示。
function formatCny(cnyMillicents: number): string {
  return `¥${(cnyMillicents / 100_000).toFixed(2)}`;
}

export function AdminInviteSection({ codes }: Props) {
  const { dict, locale } = useI18n();
  const t = dict.quota;

  const [state, formAction, isPending] = useActionState<
    GenerateResult | null,
    FormData
  >(generateInviteCodeAction, null);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const fallbackCopy = useCallback((text: string) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (success) {
        setCopiedCode(text);
        setCopyError(null);
        setTimeout(() => setCopiedCode(null), 2000);
      } else {
        setCopyError("复制失败");
        setTimeout(() => setCopyError(null), 3000);
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
      setCopyError("复制失败");
      setTimeout(() => setCopyError(null), 3000);
    }
  }, []);

  const copyCode = useCallback(
    (code: string) => {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(code)
          .then(() => {
            setCopiedCode(code);
            setCopyError(null);
            setTimeout(() => setCopiedCode(null), 2000);
          })
          .catch((err) => {
            console.error("Clipboard write failed:", err);
            // Fallback 到传统方法
            fallbackCopy(code);
          });
      } else {
        // 浏览器不支持 Clipboard API，直接用 fallback
        fallbackCopy(code);
      }
    },
    [fallbackCopy],
  );

  return (
    <section className="space-y-[var(--space-md)]">
      <form
        action={formAction}
        className="flex flex-wrap items-end gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]"
      >
        <div className="flex flex-col gap-[var(--space-xs)]">
          <label
            htmlFor="admin-invite-days"
            className="text-xs text-text-secondary"
          >
            {t.adminInviteExpiresDays}
          </label>
          <input
            id="admin-invite-days"
            name="expiresInDays"
            type="number"
            min={1}
            max={365}
            defaultValue={7}
            required
            className="w-20 rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-[var(--space-xs)]">
          <label
            htmlFor="admin-invite-max-uses"
            className="text-xs text-text-secondary"
          >
            {t.adminInviteMaxUses}
          </label>
          <input
            id="admin-invite-max-uses"
            name="maxUses"
            type="number"
            min={1}
            max={999}
            defaultValue={1}
            className="w-20 rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-[var(--space-xs)]">
          <label
            htmlFor="admin-invite-daily-limit"
            className="text-xs text-text-secondary"
          >
            {t.adminInviteDailyLimit}
          </label>
          <input
            id="admin-invite-daily-limit"
            name="dailyLimit"
            type="number"
            min={1}
            max={999999}
            defaultValue={200}
            className="w-24 rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
        >
          {isPending ? t.adminInviteGenerating : t.adminInviteGenerate}
        </button>

        {state?.ok && (
          <div className="flex items-center gap-[var(--space-sm)]">
            <code className="rounded-[var(--radius-sm)] bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] font-mono text-accent-primary">
              {state.code}
            </code>
            <button
              type="button"
              onClick={() => copyCode(state.code)}
              className={`rounded-[var(--radius-sm)] border px-[var(--space-sm)] py-[var(--space-xs)] text-xs transition-colors ${
                copyError
                  ? "border-semantic-error text-semantic-error"
                  : "border-border-strong text-text-secondary hover:bg-surface-glass"
              }`}
            >
              {copyError
                ? copyError
                : copiedCode === state.code
                  ? t.adminInviteCodeCopied
                  : "复制"}
            </button>
          </div>
        )}
        {state && !state.ok && (
          <p className="text-xs text-semantic-error">{state.error}</p>
        )}
      </form>

      {codes.length === 0 ? (
        <p className="text-sm text-text-muted">{t.adminInviteEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-glass text-xs text-text-secondary">
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.adminInviteTableCode}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.adminInviteTableStatus}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.adminInviteTableUses}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.adminInviteTableDailyLimit}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.adminInviteTableExpires}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                  {t.adminInviteTableUsers}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)] text-right">
                  {t.adminInviteTableApiCalls}
                </th>
                <th className="px-[var(--space-md)] py-[var(--space-sm)] text-right">
                  {t.adminInviteTableTotalCost}
                </th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const status = codeStatus(code);
                const statusLabel =
                  status === "active"
                    ? t.adminInviteStatusActive
                    : status === "used"
                      ? t.adminInviteStatusUsed
                      : t.adminInviteStatusExpired;

                return (
                  <tr
                    key={code.id}
                    className="border-b border-border-subtle/50 last:border-0"
                  >
                    <td className="px-[var(--space-md)] py-[var(--space-sm)]">
                      <div className="flex items-center gap-[var(--space-xs)]">
                        <code className="font-mono text-text-primary">
                          {code.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode(code.code)}
                          className={`rounded-[var(--radius-sm)] px-[var(--space-xs)] py-px text-xs transition-colors ${
                            copyError
                              ? "text-semantic-error"
                              : "text-text-muted hover:text-text-primary"
                          }`}
                        >
                          {copyError
                            ? copyError
                            : copiedCode === code.code
                              ? t.adminInviteCodeCopied
                              : "复制"}
                        </button>
                      </div>
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)]">
                      <span
                        className={`inline-block rounded-[var(--radius-pill)] px-[var(--space-sm)] py-px text-xs font-medium ${STATUS_COLORS[status]}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                      {code.usedCount} / {code.maxUses}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                      {code.dailyLimit} 轮/天
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                      {code.expiresAt
                        ? formatDate(code.expiresAt, locale)
                        : t.adminInviteNoExpiry}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                      {code.redemptions.length > 0
                        ? code.redemptions
                            .map((r) => r.userEmail ?? "—")
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-right text-text-secondary tabular-nums">
                      {code.apiCallCount}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-right font-semibold text-accent-amber tabular-nums">
                      {formatCny(code.totalCostCnyMillicents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
