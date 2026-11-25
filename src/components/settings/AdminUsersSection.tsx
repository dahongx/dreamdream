"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import {
  getUserDailyUsage,
  type UserAnalyticsRow,
  type UserDailyUsageRow,
} from "@/lib/analytics/users";

interface Props {
  // 全周期 + 最近一周聚合（page 服务端预取）
  summaryRows: UserAnalyticsRow[];
  // 当前所选日期（默认今日 Shanghai）+ 该日数据，由 page 服务端预取
  initialDailyDate: string;
  initialDailyRows: UserDailyUsageRow[];
  // 日期 input 的 max 限制，避免选未来日期（后端有 clamp 兜底但 UX 上拦截更顺手）
  maxDate: string;
}

function formatDateTime(
  iso: string | null,
  fallback: string,
  locale: Locale,
): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// CNY 快照口径（1 CNY = 100_000 millicents），与 AdminUsageSection / AdminInviteSection 一致。
function formatCny(cnyMillicents: number): string {
  return `¥${(cnyMillicents / 100_000).toFixed(2)}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function AdminUsersSection({
  summaryRows,
  initialDailyDate,
  initialDailyRows,
  maxDate,
}: Props) {
  const { dict, locale } = useI18n();
  const t = dict.adminUsers;

  const [dailyDate, setDailyDate] = useState(initialDailyDate);
  const [dailyRows, setDailyRows] = useState(initialDailyRows);
  const [pending, startTransition] = useTransition();

  function onDateChange(next: string) {
    if (!DATE_RE.test(next)) return;
    setDailyDate(next);
    startTransition(async () => {
      const fresh = await getUserDailyUsage(next);
      setDailyRows(fresh);
    });
  }

  return (
    <div className="space-y-[var(--space-xl)]">
      {/* ─────── 表 1: 全部注册用户 ─────── */}
      <section className="space-y-[var(--space-md)]">
        <h2 className="font-display-zh text-lg text-text-primary">
          {t.summaryTitle}
        </h2>

        {summaryRows.length === 0 ? (
          <p className="text-sm text-text-muted">{t.summaryEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-glass text-xs text-text-secondary">
                  <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                    {t.colUsername}
                  </th>
                  <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                    {t.colEmail}
                  </th>
                  <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                    {t.colCreatedAt}
                  </th>
                  <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                    {t.colLastSignIn}
                  </th>
                  <th className="px-[var(--space-md)] py-[var(--space-sm)] text-right">
                    {t.colTotalApiCalls}
                  </th>
                  <th className="px-[var(--space-md)] py-[var(--space-sm)] text-right">
                    {t.colTotalCost}
                  </th>
                  <th className="px-[var(--space-md)] py-[var(--space-sm)] text-right">
                    {t.colLastWeekApiCalls}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border-subtle/50 last:border-0"
                  >
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-primary">
                      {row.username}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                      {row.email ?? "—"}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                      {formatDateTime(row.createdAt, "—", locale)}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                      {formatDateTime(
                        row.lastSignInAt,
                        t.neverSignedIn,
                        locale,
                      )}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-right text-text-secondary tabular-nums">
                      {row.totalApiCalls}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-right font-semibold text-accent-amber tabular-nums">
                      {formatCny(row.totalCostCnyMillicents)}
                    </td>
                    <td className="px-[var(--space-md)] py-[var(--space-sm)] text-right text-text-secondary tabular-nums">
                      {row.lastWeekApiCalls}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─────── 表 2: 按日用量（日期可选） ─────── */}
      <section className="space-y-[var(--space-md)]">
        <header className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
          <h2 className="font-display-zh text-lg text-text-primary">
            {t.dailyTitle}
          </h2>
          <label className="flex items-center gap-[var(--space-xs)] text-xs text-text-muted">
            <span>{t.dailyEndDate}</span>
            <input
              type="date"
              value={dailyDate}
              max={maxDate}
              disabled={pending}
              onChange={(e) => onDateChange(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-xs)] py-[2px] text-text-primary disabled:opacity-50"
            />
          </label>
        </header>

        <div className={`transition-opacity ${pending ? "opacity-50" : ""}`}>
          {dailyRows.length === 0 ? (
            <p className="text-sm text-text-muted">{t.dailyEmpty}</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-glass text-xs text-text-secondary">
                    <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                      {t.colUsername}
                    </th>
                    <th className="px-[var(--space-md)] py-[var(--space-sm)]">
                      {t.colEmail}
                    </th>
                    <th className="px-[var(--space-md)] py-[var(--space-sm)] text-right">
                      {t.colDailyApiCalls}
                    </th>
                    <th className="px-[var(--space-md)] py-[var(--space-sm)] text-right">
                      {t.colDailyCost}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border-subtle/50 last:border-0"
                    >
                      <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-primary">
                        {row.username}
                      </td>
                      <td className="px-[var(--space-md)] py-[var(--space-sm)] text-text-secondary">
                        {row.email ?? "—"}
                      </td>
                      <td className="px-[var(--space-md)] py-[var(--space-sm)] text-right text-text-secondary tabular-nums">
                        {row.apiCalls}
                      </td>
                      <td className="px-[var(--space-md)] py-[var(--space-sm)] text-right font-semibold text-accent-amber tabular-nums">
                        {formatCny(row.costCnyMillicents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
