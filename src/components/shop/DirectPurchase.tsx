"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import { createGoldPayment } from "@/lib/payments/checkout";
import {
  formatUnitPrice,
  GOLD_PACKAGES,
  type GoldPackage,
} from "@/lib/shop/direct-purchase-constants";

/**
 * 直购金币包主体：4 档金币包卡片 + 选中档的购买按钮。
 *
 * UI 风格对齐月卡页面：
 *   - 4 个金币包以网格卡片形式展示
 *   - 推荐档（3600 金币）高亮显示
 *   - 点击「立即购买」跳转到当前配置的支付渠道
 */
export function DirectPurchase({ currencySymbol }: { currencySymbol: string }) {
  const { dict } = useI18n();
  const { alert: showAlert } = useDialog();
  const t = dict.shop;

  const [selectedPackage, setSelectedPackage] = useState<GoldPackage>(
    GOLD_PACKAGES.find((p) => p.recommended) ?? GOLD_PACKAGES[1],
  );
  const [isPending, startTransition] = useTransition();

  const handlePurchase = () => {
    startTransition(async () => {
      try {
        const { url } = await createGoldPayment(selectedPackage.id);
        window.location.href = url;
      } catch (error) {
        await showAlert({
          title: t.checkoutStartFailedTitle,
          body:
            error instanceof Error && error.message
              ? error.message
              : t.checkoutStartFailedBody,
          okLabel: t.paymentDialogOk,
        });
      }
    });
  };

  return (
    <section
      id="nj_shop_direct_purchase"
      className="flex flex-col gap-[var(--space-lg)]"
    >
      {/* 金币包网格 */}
      <div className="grid grid-cols-1 gap-[var(--space-md)] sm:grid-cols-2">
        {GOLD_PACKAGES.map((pkg) => (
          <PackageCard
            key={pkg.id}
            package={pkg}
            selected={selectedPackage.id === pkg.id}
            onSelect={() => setSelectedPackage(pkg)}
            currencySymbol={currencySymbol}
          />
        ))}
      </div>

      {/* 购买按钮 */}
      <button
        type="button"
        onClick={handlePurchase}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-[6px] rounded-[var(--radius-pill)] bg-gradient-to-r from-accent-primary to-accent-secondary px-[var(--space-lg)] py-[var(--space-md)] text-base font-medium text-text-on-accent shadow-[--shadow-cta] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? t.redirectingLabel : t.directPurchaseButton}
      </button>
    </section>
  );
}

function PackageCard({
  package: pkg,
  selected,
  onSelect,
  currencySymbol,
}: {
  package: GoldPackage;
  selected: boolean;
  onSelect: () => void;
  currencySymbol: string;
}) {
  const { dict } = useI18n();
  const t = dict.shop;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        selected
          ? "glass-card relative flex flex-col gap-[var(--space-sm)] p-[var(--space-lg)] text-left transition-all ring-2 ring-accent-primary"
          : "glass-card relative flex flex-col gap-[var(--space-sm)] p-[var(--space-lg)] text-left transition-all hover:ring-1 hover:ring-border-subtle"
      }
    >
      {/* 金币数量 */}
      <div className="flex items-center gap-[6px]">
        <Sparkles
          size={16}
          className={selected ? "text-accent-primary" : "text-accent-secondary"}
        />
        <span
          className={
            selected
              ? "font-display-zh text-2xl text-accent-primary"
              : "font-display-zh text-2xl text-text-primary"
          }
        >
          {pkg.gold.toLocaleString()}
        </span>
        <span className="text-sm text-text-muted">{t.goldCoinUnit}</span>
      </div>

      {/* 价格 */}
      <div className="flex items-baseline gap-[4px]">
        <span className="text-base text-text-secondary">{currencySymbol}</span>
        <span className="font-display-zh text-3xl text-text-primary">
          {formatPrice(pkg.priceHkd)}
        </span>
      </div>

      {/* 单价 */}
      <p className="text-xs text-text-muted">
        {t.directPurchaseUnitPrice.replace(
          "{price}",
          `${currencySymbol}${formatUnitPrice(pkg)}`,
        )}
      </p>
    </button>
  );
}

/**
 * 价格展示：去掉无意义的尾零。
 *   50.0 → "50"   155.5 → "155.5"   260.99 → "260.99"
 */
function formatPrice(p: number): string {
  return p.toFixed(2).replace(/\.?0+$/, "");
}
