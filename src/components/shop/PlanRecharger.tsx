"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import {
  type MembershipTier,
  TIER_ORDER,
  TIER_SPECS,
} from "@/lib/membership/constants";
import { createMembershipPayment } from "@/lib/payments/checkout";

interface Props {
  activeTier: MembershipTier | null;
  currencySymbol: string;
}

/**
 * 月卡充值区 —— v2「一盏灯」Wave 4 重构：从「二级 tab 切换单档 + 4 列
 * 对比表」改成「三档卡片并排显示」，三个 CTA 同时可见，用户不用点击就能
 * 看到三档差异（转化率天花板打开）。
 *
 * 卡片视觉签名：右上角一枚 `--accent-gold` 内嵌圆点作朱印（章 = 一枚朱印，
 * 克制的圆点，不做齿边邮票——齿边视觉太具象绑定"信封"符号，圆点抽象化
 * 兼容跨题材）。中间那档（platinum = 内部「钻石会员」HK$128）作为推荐档，
 * 卡边框走 `--accent-gold` 实线 + 一个「推荐」小标签。
 *
 * 付款渠道由 PAYMENT_PROVIDER 选择（Stripe 或 PayProo），履约都由对应异步
 * webhook 驱动。这里只负责创建订单并跳转到支付页。
 */
export function PlanRecharger({ activeTier, currencySymbol }: Props) {
  const { dict } = useI18n();
  const { alert: showAlert } = useDialog();
  const t = dict.shop;

  const [pendingTier, setPendingTier] = useState<MembershipTier | null>(null);
  const [, startTransition] = useTransition();

  const tierLabel: Record<MembershipTier, string> = {
    gold: t.tierGoldName,
    platinum: t.tierPlatinumName,
    diamond: t.tierDiamondName,
  };
  const tierTagline: Record<MembershipTier, string> = {
    gold: t.tierGoldTagline,
    platinum: t.tierPlatinumTagline,
    diamond: t.tierDiamondTagline,
  };

  const handleSubscribe = (tier: MembershipTier) => {
    setPendingTier(tier);
    startTransition(async () => {
      try {
        const { url } = await createMembershipPayment(tier);
        window.location.href = url;
      } catch (error) {
        setPendingTier(null);
        await showAlert({
          title: t.checkoutStartFailedTitle,
          body:
            error instanceof Error && error.message
              ? error.message
              : t.checkoutStartFailedBody,
          okLabel: t.subscribeSuccessOk,
        });
      }
    });
  };

  return (
    <section
      id="nj_shop_plan_recharger"
      className="flex flex-col gap-[var(--space-lg)]"
    >
      {/* 三档卡片并排 —— md+ 三列，< md 单列纵向堆叠。
          中间档（platinum = HK$128 最贵）通过 recommended prop 视觉突出。*/}
      <div
        id="nj_shop_plan_grid"
        className="grid grid-cols-1 gap-[var(--space-md)] md:grid-cols-3"
      >
        {TIER_ORDER.map((tier) => (
          <TierCard
            key={tier}
            tier={tier}
            label={tierLabel[tier]}
            tagline={tierTagline[tier]}
            spec={TIER_SPECS[tier]}
            currencySymbol={currencySymbol}
            isActive={activeTier === tier}
            recommended={tier === "platinum"}
            isPending={pendingTier === tier}
            onSubscribe={() => handleSubscribe(tier)}
            t={t}
          />
        ))}
      </div>

      <p className="text-center text-xs text-text-muted">{t.priceFootnote}</p>
    </section>
  );
}

interface TierCardProps {
  tier: MembershipTier;
  label: string;
  tagline: string;
  spec: (typeof TIER_SPECS)[MembershipTier];
  currencySymbol: string;
  isActive: boolean;
  recommended: boolean;
  isPending: boolean;
  onSubscribe: () => void;
  t: ReturnType<typeof useI18n>["dict"]["shop"];
}

function TierCard({
  tier,
  label,
  tagline,
  spec,
  currencySymbol,
  isActive,
  recommended,
  isPending,
  onSubscribe,
  t,
}: TierCardProps) {
  const benefits = spec.benefits;

  return (
    <div
      id={`nj_shop_plan_card_${tier}`}
      className={
        recommended
          ? "glass-card relative flex flex-col gap-[var(--space-md)] border-accent-gold/50 p-[var(--space-lg)] md:scale-[1.02]"
          : "glass-card relative flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]"
      }
    >
      {/* 「朱印」印章 —— v2 商店签名视觉。--accent-gold 圆点嵌在圆环内，
          克制、不喧宾，替代原方案的齿边邮票（太具象绑定"信封"符号）。
          推荐档配一个「推荐」小标签，其他档只是空印章。 */}
      <div
        aria-hidden="true"
        className={
          recommended
            ? "absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border border-accent-gold/60 bg-accent-gold/15"
            : "absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-surface-glass/60"
        }
      >
        <span
          className={
            recommended
              ? "h-2 w-2 rounded-full bg-accent-gold"
              : "h-1.5 w-1.5 rounded-full bg-text-muted/40"
          }
        />
      </div>

      {recommended && (
        <span className="absolute -top-3 left-[var(--space-md)] rounded-[var(--radius-pill)] border border-accent-gold/50 bg-bg-elevated px-[var(--space-sm)] py-[2px] font-display-zh text-[11px] text-accent-gold">
          {t.recommendedLabel}
        </span>
      )}

      <header className="flex flex-col gap-[4px]">
        <h3 className="font-display-zh text-lg text-text-primary">{label}</h3>
        <p className="text-xs leading-relaxed text-text-muted">{tagline}</p>
      </header>

      {/* 价格 —— 大衬线数字用 .nums-oldstyle 让 1/2/3 各有升降节奏 */}
      <div className="flex items-baseline gap-[4px]">
        <span className="text-sm text-text-secondary">{currencySymbol}</span>
        <span className="nums-editorial text-4xl text-text-primary">
          {formatPrice(spec.priceHkd)}
        </span>
        <span className="text-xs text-text-muted">{t.pricePerMonth}</span>
      </div>

      {/* 权益列表 —— 4 条最重要的（不放 6 条，卡片会太挤）*/}
      <ul className="flex flex-col gap-[var(--space-xs)] text-xs text-text-secondary">
        <BenefitRow>
          {t.rowInstantSilverFmt.replace(
            "{count}",
            String(benefits.instantGold),
          )}
        </BenefitRow>
        <BenefitRow>
          {t.rowDailySilverFmt.replace("{count}", String(benefits.dailySilver))}
        </BenefitRow>
        {benefits.unlimitedChatArchive && (
          <BenefitRow>{t.rowUnlimitedArchive}</BenefitRow>
        )}
        {benefits.noWaitInPeak && <BenefitRow>{t.rowNoWaitPeak}</BenefitRow>}
        {benefits.unlimitedMasks && (
          <BenefitRow>{t.rowUnlimitedMasks}</BenefitRow>
        )}
        {benefits.extraMemoryBoost && (
          <BenefitRow>{t.rowMemoryBoost}</BenefitRow>
        )}
      </ul>

      {/* CTA —— 推荐档实底 accent-gold，其他档描边 accent-primary。
          isActive（已订阅当前档）显示「续费」，否则「订阅」。*/}
      <button
        type="button"
        onClick={onSubscribe}
        disabled={isPending}
        className={
          recommended
            ? // v2 Wave 5：推荐档 CTA 用金色 gradient + inner-shadow 江诗丹顿
              // 按钮质感 —— 白/黑蒙层做金属反光，inset 顶部 hairline 高光，
              // 外部金色发光晕。跟 btnGold 同思路但保留 shop 布局的 mt-auto
              "mt-auto inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-accent-gold bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(0,0,0,0.15)_100%)] px-[var(--space-lg)] py-[10px] font-display-zh font-bold text-sm tracking-[0.15em] text-text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_rgba(212,175,55,0.32)]"
            : "mt-auto inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-accent-primary/60 px-[var(--space-lg)] py-[var(--space-sm)] font-display-zh text-sm text-accent-primary transition-colors hover:border-accent-primary hover:bg-accent-primary/10 disabled:opacity-60"
        }
      >
        {isPending
          ? t.redirectingLabel
          : isActive
            ? t.subscribeButtonActive
            : t.subscribeButton}
      </button>
    </div>
  );
}

function BenefitRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-[var(--space-xs)]">
      <Check
        size={12}
        strokeWidth={2.4}
        className="mt-[3px] shrink-0 text-accent-primary"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}

/**
 * 价格展示：去掉无意义的尾零。
 *   4.99 → "4.99"   19.9 → "19.9"   9.9 → "9.9"   5.0 → "5"
 */
function formatPrice(p: number): string {
  return p.toFixed(2).replace(/\.?0+$/, "");
}
