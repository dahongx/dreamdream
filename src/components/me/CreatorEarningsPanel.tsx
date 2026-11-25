"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type {
  CreatorEarningDetailRow,
  CreatorEarningsOverview,
} from "@/lib/creator/queries";

interface Props {
  overview: CreatorEarningsOverview;
  details: ReadonlyArray<CreatorEarningDetailRow>;
}

type SubTab = "overview" | "detail";

/**
 * 创作收益面板 —— /me 第三个 tab 的内容。两个子 tab：
 *   收益总览：累计收益大数字 + 四项生涯数据格
 *   收益详情：角色 / 收益 / 时间 三列流水
 *
 * 视觉遵守 DESIGN.md：暗紫底、衬线大标题、克制的玻璃面板。
 */
export function CreatorEarningsPanel({ overview, details }: Props) {
  const { dict } = useI18n();
  const t = dict.me;
  const [subTab, setSubTab] = useState<SubTab>("overview");

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {/* 子 tab */}
      <div className="flex gap-[var(--space-sm)] border-b border-border-subtle">
        <SubTabButton
          active={subTab === "overview"}
          label={t.earningsSubTabOverview}
          onClick={() => setSubTab("overview")}
        />
        <SubTabButton
          active={subTab === "detail"}
          label={t.earningsSubTabDetail}
          onClick={() => setSubTab("detail")}
        />
      </div>

      {subTab === "overview" ? (
        <OverviewContent overview={overview} />
      ) : (
        <DetailContent details={details} />
      )}
    </div>
  );
}

function OverviewContent({ overview }: { overview: CreatorEarningsOverview }) {
  const { dict } = useI18n();
  const t = dict.me;

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {/* 累计收益大数字 */}
      <div className="glass-card flex flex-col gap-[var(--space-xs)] p-[var(--space-xl)]">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display-zh text-lg text-text-primary">
            {t.earningsBalanceTitle}
          </h3>
          <span className="text-xs text-text-muted">
            {t.earningsBalanceHint}
          </span>
        </div>
        <div className="flex items-baseline gap-[var(--space-sm)]">
          <span className="font-mono text-4xl font-semibold text-currency-gold">
            {formatEarnings(overview.totalEarnings)}
          </span>
          <span className="text-sm text-text-muted">
            {t.earningsBalanceUnit}
          </span>
        </div>
      </div>

      {/* 四项生涯数据格：总数 + 自上次结算以来「新增 ▲」 */}
      <div className="grid grid-cols-2 gap-[var(--space-sm)] sm:grid-cols-4">
        <DataTile
          value={overview.totalConversations}
          delta={overview.deltaConversations}
          label={t.earningsStatConversations}
        />
        <DataTile
          value={overview.totalFavorites}
          delta={overview.deltaFavorites}
          label={t.earningsStatFavorites}
        />
        <DataTile
          value={overview.totalLikes}
          delta={overview.deltaLikes}
          label={t.earningsStatLikes}
        />
        <DataTile
          value={overview.totalFans}
          delta={overview.deltaFans}
          label={t.earningsStatFans}
        />
      </div>
    </div>
  );
}

function DetailContent({
  details,
}: {
  details: ReadonlyArray<CreatorEarningDetailRow>;
}) {
  const { dict, locale } = useI18n();
  const t = dict.me;

  const kindLabel = (kind: CreatorEarningDetailRow["kind"]): string => {
    switch (kind) {
      case "dialogue":
        return t.earningsKindDialogue;
      case "like":
        return t.earningsKindLike;
      case "favorite":
        return t.earningsKindFavorite;
      case "fans":
        return t.earningsKindFans;
    }
  };

  const formatDateTime = (date: Date): string =>
    new Date(date).toLocaleString(locale, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (details.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-[var(--space-sm)] py-[var(--space-2xl)] text-center">
        <p className="font-display-zh text-base text-text-primary">
          {t.earningsDetailEmpty}
        </p>
        <p className="max-w-xs text-xs text-text-muted">
          {t.earningsDetailEmptyHint}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card flex flex-col gap-[var(--space-xs)] p-[var(--space-lg)]">
      {/* 表头：角色 / 收益 / 时间 */}
      <div className="grid grid-cols-[2fr_1fr_1.4fr] gap-[var(--space-sm)] border-b border-border-subtle pb-[var(--space-xs)] text-xs font-medium text-text-muted">
        <span>{t.earningsDetailColCharacter}</span>
        <span className="text-right text-currency-gold">
          {t.earningsDetailColAmount}
        </span>
        <span className="text-right">{t.earningsDetailColTime}</span>
      </div>
      {/* 数据行 */}
      <div className="flex max-h-[440px] flex-col overflow-y-auto">
        {details.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[2fr_1fr_1.4fr] items-center gap-[var(--space-sm)] border-b border-border-subtle/40 py-[var(--space-sm)] text-sm last:border-0"
          >
            <span className="flex min-w-0 items-center gap-[6px]">
              <span className="truncate text-text-primary">
                {row.characterName ?? t.earningsDetailFansRow}
              </span>
              <span className="shrink-0 rounded-[var(--radius-sm)] bg-surface-glass/60 px-[5px] py-[1px] text-[10px] text-text-muted">
                {kindLabel(row.kind)}
              </span>
            </span>
            <span className="text-right font-mono text-currency-gold">
              +{formatEarnings(row.amount)}
            </span>
            <span className="text-right text-xs text-text-muted">
              {formatDateTime(row.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTile({
  value,
  delta = 0,
  label,
}: {
  value: number;
  delta?: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-[2px] rounded-[var(--radius-md)] bg-surface-glass/40 py-[var(--space-md)]">
      <span className="flex items-baseline gap-[4px]">
        <span className="nums-editorial text-2xl text-text-primary">
          {formatStat(value)}
        </span>
        {delta > 0 && (
          // 自上次早 8 点结算以来的新增（绿色 ▲ 增量）
          <span className="font-mono text-xs font-medium text-semantic-success">
            +{formatStat(delta)}
            <span aria-hidden className="ml-[1px]">
              ▲
            </span>
          </span>
        )}
      </span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

function SubTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border-b-2 px-[var(--space-sm)] pb-[var(--space-xs)] text-sm font-medium transition-colors ${
        active
          ? "border-accent-primary text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

/** 收益金额：整数不带小数，有小数保留两位（0.6 / 8.6 / 12）。 */
function formatEarnings(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

/** 大数字缩写（生涯数据格）。与 /me hero 的口径一致。 */
function formatStat(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 10000).toFixed(1)}w`;
}
