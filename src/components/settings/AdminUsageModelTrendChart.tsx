"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { fetchDailyModelUsageAction } from "@/lib/usage/actions";
import type { DailyModelUsage } from "@/lib/usage/stats";

interface Props {
  initial: DailyModelUsage;
  initialEndDate: string;
  maxEndDate: string;
}

// 8 色独立调色板。避开 `--accent-gold`，保留其徽章 / 特别标记语义。
// 图表内部用于区分多个模型序列，与主色系（v2 Wave 5 已改冷银）解耦
// —— 图表可读性优先，8 色必须互相拉开色相，不追求跟 --accent-primary
// 同色。这也是唯一保留 violet/fuchsia 具体 hex 的合法场景。
const PALETTE = [
  "#a78bfa", // violet
  "#f0abfc", // fuchsia
  "#fbbf24", // amber
  "#34d399", // emerald
  "#38bdf8", // sky
  "#fb7185", // rose
  "#5eead4", // teal
  "#fb923c", // orange
];

const W = 800;
const H = 280;
const PAD_L = 64;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const norm = v / pow;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

function xAt(i: number, n: number): number {
  if (n <= 1) return PAD_L + PLOT_W / 2;
  return PAD_L + (i / (n - 1)) * PLOT_W;
}

function yAt(v: number, max: number): number {
  if (max <= 0) return PAD_T + PLOT_H;
  return PAD_T + (1 - v / max) * PLOT_H;
}

function shortDay(d: string): string {
  // "2026-06-23" -> "06-23"
  return d.slice(5);
}

function formatCount(v: number): string {
  return String(v);
}

// CNY millicents -> ¥X.XX。1 CNY = 100_000 millicents。
function formatCny(millicents: number): string {
  const cny = millicents / 100_000;
  if (cny >= 100) return `¥${cny.toFixed(0)}`;
  if (cny >= 10) return `¥${cny.toFixed(1)}`;
  return `¥${cny.toFixed(2)}`;
}

interface PanelProps {
  title: string;
  days: string[];
  models: string[];
  // null 表示该日没有数据点（不是 0），用于在折线里产生 gap
  // —— 主要给「单次平均成本」这种除数可能为 0 的指标用。
  values: Record<string, (number | null)[]>;
  formatY: (v: number) => string;
  formatTooltipValue: (v: number) => string;
}

// 把一条 model 的 (number | null)[] 切成多段连续的非 null 段。
// 单点段会被忽略 polyline，仅渲染圆点。
function segmentsOf(
  arr: (number | null)[],
): Array<Array<{ i: number; v: number }>> {
  const segments: Array<Array<{ i: number; v: number }>> = [];
  let cur: Array<{ i: number; v: number }> = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v == null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else {
      cur.push({ i, v });
    }
  }
  if (cur.length) segments.push(cur);
  return segments;
}

function LineChartPanel({
  title,
  days,
  models,
  values,
  formatY,
  formatTooltipValue,
}: PanelProps) {
  const { dict } = useI18n();
  const t = dict.quota;

  const rawMax = models.reduce((m, name) => {
    const arr = values[name] ?? [];
    let local = m;
    for (const v of arr) {
      if (v != null && v > local) local = v;
    }
    return local;
  }, 0);
  const yMax = niceCeil(rawMax);
  const yTickCount = 5;
  const yTicks = Array.from(
    { length: yTickCount + 1 },
    (_, i) => (yMax / yTickCount) * i,
  );
  const hasData = models.length > 0 && rawMax > 0;

  return (
    <div className="space-y-[var(--space-xs)]">
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-secondary">
        {title}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        role="img"
        aria-label={title}
      >
        {/* Y 轴网格 + 刻度 */}
        {yTicks.map((v, i) => {
          const y = yAt(v, yMax);
          return (
            <g key={`y-${i}-${v}`}>
              <line
                x1={PAD_L}
                x2={PAD_L + PLOT_W}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-border-subtle"
                strokeDasharray={i === 0 ? undefined : "2 3"}
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
                className="font-mono text-text-muted"
              >
                {formatY(v)}
              </text>
            </g>
          );
        })}

        {/* X 轴日期标签 */}
        {days.map((d, i) => (
          <text
            key={d}
            x={xAt(i, days.length)}
            y={PAD_T + PLOT_H + 16}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            className="font-mono text-text-muted"
          >
            {shortDay(d)}
          </text>
        ))}

        {/* 折线 —— 切成多段以避开 null gap（如 calls=0 那天的单次平均成本） */}
        {hasData &&
          models.map((name, mi) => {
            const color = PALETTE[mi % PALETTE.length];
            const arr = values[name] ?? [];
            const segments = segmentsOf(arr);
            return (
              <g key={name}>
                {segments.map((seg, si) => {
                  if (seg.length < 2) return null;
                  const points = seg
                    .map((p) => `${xAt(p.i, days.length)},${yAt(p.v, yMax)}`)
                    .join(" ");
                  return (
                    <polyline
                      key={`${name}-seg-${si}-${seg[0].i}`}
                      points={points}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
                {segments.flat().map((p) => (
                  <circle
                    key={`${name}-${days[p.i]}`}
                    cx={xAt(p.i, days.length)}
                    cy={yAt(p.v, yMax)}
                    r={2.5}
                    fill={color}
                  >
                    <title>{`${name} · ${days[p.i]} · ${formatTooltipValue(p.v)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

        {!hasData && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            className="text-text-muted"
          >
            {t.adminUsageNoData}
          </text>
        )}
      </svg>
    </div>
  );
}

export function AdminUsageModelTrendChart({
  initial,
  initialEndDate,
  maxEndDate,
}: Props) {
  const { dict } = useI18n();
  const t = dict.quota;
  const [endDate, setEndDate] = useState(initialEndDate);
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onDateChange(next: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setEndDate(next);
    startTransition(async () => {
      const fresh = await fetchDailyModelUsageAction(next);
      setData(fresh);
    });
  }

  const { days, models, callCounts, costCnyMillicents } = data;
  const hasAnyData = models.length > 0;

  // 单次平均成本 = 当日成本 / 当日调用次数。calls=0 那天没有可解释的均值
  // —— 用 null 让折线在那里断开，而不是误导性地画到 0。
  const avgCostPerCall: Record<string, (number | null)[]> = {};
  for (const m of models) {
    const calls = callCounts[m] ?? [];
    const cost = costCnyMillicents[m] ?? [];
    avgCostPerCall[m] = days.map((_, i) =>
      calls[i] && calls[i] > 0 ? cost[i] / calls[i] : null,
    );
  }

  // 把 number[] 升级成 (number | null)[] 喂给 LineChartPanel（无 null 即无 gap）。
  const callCountsForPanel: Record<string, (number | null)[]> = {};
  const costForPanel: Record<string, (number | null)[]> = {};
  for (const m of models) {
    callCountsForPanel[m] = callCounts[m] ?? [];
    costForPanel[m] = costCnyMillicents[m] ?? [];
  }

  return (
    <div className="space-y-[var(--space-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
        <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-text-secondary">
          {t.adminUsageDailyTrend}
        </h3>
        <label className="flex items-center gap-[var(--space-xs)] text-xs text-text-muted">
          <span>{t.adminUsageEndDate}</span>
          <input
            type="date"
            value={endDate}
            max={maxEndDate}
            disabled={pending}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-xs)] py-[2px] text-text-primary disabled:opacity-50"
          />
        </label>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]">
        <div
          className={`space-y-[var(--space-md)] transition-opacity ${
            pending ? "opacity-50" : ""
          }`}
        >
          <LineChartPanel
            title={t.adminUsageDailyTrendCalls}
            days={days}
            models={models}
            values={callCountsForPanel}
            formatY={(v) => formatCount(Math.round(v))}
            formatTooltipValue={(v) => formatCount(v)}
          />

          <LineChartPanel
            title={t.adminUsageDailyTrendCost}
            days={days}
            models={models}
            values={costForPanel}
            formatY={(v) => formatCny(v)}
            formatTooltipValue={(v) => formatCny(v)}
          />

          <LineChartPanel
            title={t.adminUsageDailyTrendAvgCost}
            days={days}
            models={models}
            values={avgCostPerCall}
            formatY={(v) => formatCny(v)}
            formatTooltipValue={(v) => formatCny(v)}
          />
        </div>

        {/* 共享 legend：色块 + 模型名 + 窗口内总调用 / 总成本 / 单次均价 */}
        {hasAnyData && (
          <ul className="mt-[var(--space-md)] flex flex-wrap gap-x-[var(--space-md)] gap-y-[var(--space-xs)]">
            {models.map((name, mi) => {
              const totalCalls = (callCounts[name] ?? []).reduce(
                (s, x) => s + x,
                0,
              );
              const totalCost = (costCnyMillicents[name] ?? []).reduce(
                (s, x) => s + x,
                0,
              );
              const avgPerCall = totalCalls > 0 ? totalCost / totalCalls : null;
              return (
                <li
                  key={name}
                  className="flex items-center gap-[var(--space-xs)] font-mono text-xs"
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: PALETTE[mi % PALETTE.length] }}
                    className="inline-block h-[2px] w-3 rounded"
                  />
                  <span className="text-text-primary">{name}</span>
                  <span className="text-text-muted">
                    ({totalCalls} · {formatCny(totalCost)}
                    {avgPerCall != null
                      ? ` · ${formatCny(avgPerCall)}/${t.adminUsageDailyTrendPerCall}`
                      : ""}
                    )
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
