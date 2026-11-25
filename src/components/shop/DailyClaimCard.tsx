"use client";

import { ArrowUp } from "lucide-react";
import { useI18n } from "@/i18n/client";
import {
  FREE_DAILY_SILVER,
  MAX_DAILY_SILVER_WITH_MEMBERSHIP,
  type MembershipTier,
  TIER_SPECS,
} from "@/lib/membership/constants";

interface Props {
  activeTier: MembershipTier | null;
  canClaimToday: boolean;
  onBoostClick: () => void;
}

/**
 * 每日银币卡：大号数字 + 月卡领取上限提示 + 月卡入口。
 *
 * 数字逻辑：
 *   - 无有效月卡 → 显示 FREE_DAILY_SILVER（20）
 *   - 有有效月卡 → 显示该 tier 的 dailySilver
 *
 * 月卡上限提示仅在「无月卡」或「当前档 daily < 全档最大值」
 * 时显示 —— 已经吃到顶配的玩家看到这行没意义。
 *
 * 按钮把页面滚动到月卡购买区（PlanRecharger），不导航。
 */
export function DailyClaimCard({
  activeTier,
  canClaimToday,
  onBoostClick,
}: Props) {
  const { dict } = useI18n();
  const t = dict.shop;

  const dailyAmount = activeTier
    ? TIER_SPECS[activeTier].benefits.dailySilver
    : FREE_DAILY_SILVER;

  const showBoostHint = dailyAmount < MAX_DAILY_SILVER_WITH_MEMBERSHIP;

  return (
    <section
      id="nj_shop_daily_claim"
      className="glass-card flex flex-col justify-between gap-[var(--space-md)] p-[var(--space-lg)]"
    >
      <header className="text-sm text-text-muted">{t.dailyCardTitle}</header>

      <div className="flex flex-col items-center gap-[var(--space-xs)]">
        <div className="flex items-baseline gap-[6px]">
          <span className="font-display-zh text-5xl text-text-primary">
            {dailyAmount}
          </span>
          <span className="text-sm text-text-muted">{t.dailyCardUnit}</span>
        </div>
        {!canClaimToday && (
          <span className="text-[10px] uppercase tracking-wide text-text-disabled">
            {t.dailyClaimedToday}
          </span>
        )}
      </div>

      {showBoostHint && (
        <p className="text-center text-xs text-accent-secondary">
          {t.dailyCardHintWithMembership.replace(
            "{max}",
            String(MAX_DAILY_SILVER_WITH_MEMBERSHIP),
          )}
        </p>
      )}

      <button
        type="button"
        onClick={onBoostClick}
        className="inline-flex items-center justify-center gap-[6px] rounded-[var(--radius-pill)] border border-semantic-success/40 bg-semantic-success/10 px-[var(--space-md)] py-[var(--space-sm)] text-sm font-medium text-semantic-success transition-colors hover:border-semantic-success/70 hover:bg-semantic-success/20"
      >
        <ArrowUp size={14} strokeWidth={2} />
        {t.dailyCardCta}
      </button>
    </section>
  );
}
