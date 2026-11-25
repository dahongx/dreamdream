"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { MembershipTier } from "@/lib/membership/constants";
import { DailyClaimCard } from "./DailyClaimCard";
import { DirectPurchase } from "./DirectPurchase";
import { MembershipStatusCard } from "./MembershipStatusCard";
import { PaymentReturnHandler } from "./PaymentReturnHandler";
import { PlanRecharger } from "./PlanRecharger";

interface Props {
  activeTier: MembershipTier | null;
  /** ISO 字符串；null 表示无激活会员。 */
  expiresAt: string | null;
  canClaimToday: boolean;
  currencySymbol: string;
}

type TopTab = "monthly" | "direct";

/**
 * 商城页主客户端容器：管两件事
 *   1. 一级 tab（月卡 / 直购）切换
 *   2. 月卡区的二级 tab 状态由 [[PlanRecharger]] 自管
 *
 * 「提升收益」按钮的点击不导航，只滚动到 [[PlanRecharger]] 锚点；这里
 * 提供 onScrollToPlans 的回调，避免子组件互相穿层调度。
 */
export function ShopPageClient({
  activeTier,
  expiresAt,
  canClaimToday,
  currencySymbol,
}: Props) {
  const { dict } = useI18n();
  const t = dict.shop;
  const [topTab, setTopTab] = useState<TopTab>("monthly");

  const scrollToPlans = () => {
    const el = document.getElementById("nj_shop_plan_recharger");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-lg)]">
      {/* Stripe 付款回跳处理（?pay=success/cancel）—— 渲染 null，只跑副作用 */}
      <PaymentReturnHandler />

      {/* 一级 tab：月卡 / 直购 —— 胶囊切换 */}
      <div
        id="nj_shop_top_tabs"
        className="mx-auto inline-flex items-center rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass/60 p-[3px]"
      >
        <TabPill
          active={topTab === "monthly"}
          onClick={() => setTopTab("monthly")}
          label={t.tabMonthly}
        />
        <TabPill
          active={topTab === "direct"}
          onClick={() => setTopTab("direct")}
          label={t.tabDirect}
        />
      </div>

      {topTab === "monthly" ? (
        <>
          {/* 状态卡 + 每日领取卡 并排 */}
          <div className="grid grid-cols-1 gap-[var(--space-md)] sm:grid-cols-2">
            <MembershipStatusCard
              activeTier={activeTier}
              expiresAt={expiresAt}
            />
            <DailyClaimCard
              activeTier={activeTier}
              canClaimToday={canClaimToday}
              onBoostClick={scrollToPlans}
            />
          </div>

          <PlanRecharger
            activeTier={activeTier}
            currencySymbol={currencySymbol}
          />
        </>
      ) : (
        <DirectPurchase currencySymbol={currencySymbol} />
      )}
    </div>
  );
}

function TabPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[var(--radius-pill)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-xs)] text-sm font-medium text-text-on-accent"
          : "rounded-[var(--radius-pill)] px-[var(--space-lg)] py-[var(--space-xs)] text-sm text-text-muted transition-colors hover:text-text-primary"
      }
    >
      {label}
    </button>
  );
}
