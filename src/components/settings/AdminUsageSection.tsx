"use client";

import { useI18n } from "@/i18n/client";
import type {
  AdminUsageStats,
  DailyModelUsage,
  UsageAggregate,
} from "@/lib/usage/stats";
import { AdminUsageModelTrendChart } from "./AdminUsageModelTrendChart";

interface Props {
  stats: AdminUsageStats;
  dailyUsage: DailyModelUsage;
  dailyEndDate: string;
  dailyMaxEndDate: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(millicents: number): string {
  const usd = millicents / 100_000;
  return `$${usd.toFixed(2)}`;
}

function formatCny(cnyMillicents: number): string {
  // CNY is summed from per-message frozen snapshots, so it's already a
  // millicents-style integer (1 CNY = 100_000). Just rescale.
  return `¥${(cnyMillicents / 100_000).toFixed(2)}`;
}

function cacheHitRate(agg: UsageAggregate): string {
  if (!agg.tokensIn || !agg.cacheReadTokens) return "—";
  return `${((agg.cacheReadTokens / agg.tokensIn) * 100).toFixed(1)}%`;
}

function AggregateCard({
  label,
  agg,
  t,
}: {
  label: string;
  agg: UsageAggregate;
  t: ReturnType<typeof useI18n>["dict"]["quota"];
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]">
      <p className="mb-[var(--space-sm)] font-mono text-xs uppercase tracking-[0.15em] text-text-secondary">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-x-[var(--space-md)] gap-y-[var(--space-xs)] text-xs">
        <span className="text-text-muted">{t.adminUsageMessages}</span>
        <span className="text-right text-text-primary">{agg.messageCount}</span>

        <span className="text-text-muted">{t.adminUsageTokensIn}</span>
        <span className="text-right text-text-primary">
          {formatTokens(agg.tokensIn)}
        </span>

        <span className="text-text-muted">{t.adminUsageTokensOut}</span>
        <span className="text-right text-text-primary">
          {formatTokens(agg.tokensOut)}
        </span>

        <span className="text-text-muted">{t.adminUsageCacheRead}</span>
        <span className="text-right text-text-primary">
          {formatTokens(agg.cacheReadTokens)}
        </span>

        <span className="text-text-muted">{t.adminUsageCacheWrite}</span>
        <span className="text-right text-text-primary">
          {formatTokens(agg.cacheWriteTokens)}
        </span>

        <span className="text-text-muted">{t.adminUsageCacheHitRate}</span>
        <span className="text-right text-text-primary">
          {cacheHitRate(agg)}
        </span>

        <span className="text-text-muted">{t.adminUsageCost}</span>
        <span className="text-right font-semibold text-accent-amber">
          {formatCost(agg.totalCostMillicents)} /{" "}
          {formatCny(agg.totalCostCnyMillicents)}
        </span>
      </div>
    </div>
  );
}

export function AdminUsageSection({
  stats,
  dailyUsage,
  dailyEndDate,
  dailyMaxEndDate,
}: Props) {
  const { dict } = useI18n();
  const t = dict.quota;

  return (
    <section className="space-y-[var(--space-md)]">
      <div className="grid gap-[var(--space-md)] sm:grid-cols-3">
        <AggregateCard label={t.adminUsageToday} agg={stats.today} t={t} />
        <AggregateCard label={t.adminUsageWeek} agg={stats.week} t={t} />
        <AggregateCard label={t.adminUsageMonth} agg={stats.month} t={t} />
      </div>

      {stats.byModel.length > 0 && (
        <div className="space-y-[var(--space-md)]">
          <h2 className="mb-[var(--space-sm)] font-mono text-xs uppercase tracking-[0.15em] text-text-secondary">
            {t.adminUsageByModel}
          </h2>
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-glass text-left text-text-muted">
                  <th className="px-[var(--space-sm)] py-[var(--space-xs)]">
                    Model
                  </th>
                  <th className="px-[var(--space-sm)] py-[var(--space-xs)] text-right">
                    {t.adminUsageMessages}
                  </th>
                  <th className="px-[var(--space-sm)] py-[var(--space-xs)] text-right">
                    {t.adminUsageTokensIn}
                  </th>
                  <th className="px-[var(--space-sm)] py-[var(--space-xs)] text-right">
                    {t.adminUsageTokensOut}
                  </th>
                  <th className="px-[var(--space-sm)] py-[var(--space-xs)] text-right">
                    {t.adminUsageCacheRead}
                  </th>
                  <th className="px-[var(--space-sm)] py-[var(--space-xs)] text-right">
                    {t.adminUsageCost}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.byModel.map((row) => (
                  <tr
                    key={row.model}
                    className="border-b border-border-subtle/50 last:border-0"
                  >
                    <td className="px-[var(--space-sm)] py-[var(--space-xs)] font-mono text-text-primary">
                      {row.model}
                    </td>
                    <td className="px-[var(--space-sm)] py-[var(--space-xs)] text-right text-text-secondary">
                      {row.messageCount}
                    </td>
                    <td className="px-[var(--space-sm)] py-[var(--space-xs)] text-right text-text-secondary">
                      {formatTokens(row.tokensIn)}
                    </td>
                    <td className="px-[var(--space-sm)] py-[var(--space-xs)] text-right text-text-secondary">
                      {formatTokens(row.tokensOut)}
                    </td>
                    <td className="px-[var(--space-sm)] py-[var(--space-xs)] text-right text-text-secondary">
                      {formatTokens(row.cacheReadTokens)}
                    </td>
                    <td className="px-[var(--space-sm)] py-[var(--space-xs)] text-right font-semibold text-accent-amber">
                      {formatCost(row.costMillicents)} /{" "}
                      {formatCny(row.costCnyMillicents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminUsageModelTrendChart
            initial={dailyUsage}
            initialEndDate={dailyEndDate}
            maxEndDate={dailyMaxEndDate}
          />
        </div>
      )}
    </section>
  );
}
