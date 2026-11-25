"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

export type CurrencyType = "gold" | "silver";

interface Props {
  /** localStorage 持久化 key。chat 走 `nj_currency_${sessionId}`，
   *  studio 走 `nj_currency_pack_assistant`，外部各自管理唯一性。 */
  storageKey: string;
  modelId: string;
  onChange: (currency: CurrencyType) => void;
  disabled?: boolean;
  /** 不走 modelPrices 表的固定单价（图片生成 3 金 / 6 银 等场景）。 */
  fixedCost?: { gold: number; silver: number };
}

interface ModelCosts {
  [modelId: string]: {
    gold: number;
    silver: number;
  };
}

/**
 * Currency switcher button for chat input area. Toggles between gold/silver
 * payment mode. State persists per-session in localStorage.
 * Displays the cost amount for the currently selected model and currency type.
 */
export function CurrencySwitcher({
  storageKey,
  modelId,
  onChange,
  disabled,
  fixedCost,
}: Props) {
  const { dict } = useI18n();
  const [currency, setCurrency] = useState<CurrencyType>("silver");
  const [modelCosts, setModelCosts] = useState<ModelCosts>({});
  const [loading, setLoading] = useState(!fixedCost);

  // 有 fixedCost 时直接走传入价，不必再 fetch 表
  useEffect(() => {
    if (fixedCost) return;
    async function fetchCosts() {
      try {
        const res = await fetch("/api/currency/model-costs");
        if (res.ok) {
          const data = await res.json();
          setModelCosts(data.costs || {});
        }
      } catch (error) {
        console.error("Failed to fetch model costs:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCosts();
  }, [fixedCost]);

  // Restore from localStorage on mount (SSR-safe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "gold" || raw === "silver") {
        setCurrency(raw);
        onChange(raw);
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey, onChange]);

  function handleToggle() {
    if (disabled) return;
    const next: CurrencyType = currency === "gold" ? "silver" : "gold";
    setCurrency(next);
    onChange(next);

    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Ignore storage quota/permission errors
    }
  }

  const isGold = currency === "gold";
  const currentCost = fixedCost ?? modelCosts[modelId];
  const costAmount = currentCost
    ? isGold
      ? currentCost.gold
      : currentCost.silver
    : 0;

  const label = isGold
    ? dict.me.walletUsageColGold
    : dict.me.walletUsageColSilver;
  const ariaLabel = dict.chat.currencySwitcherAriaFmt
    .replace("{currency}", label)
    .replace("{cost}", String(costAmount));

  return (
    <button
      id="nj_currency_switcher"
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={handleToggle}
      disabled={disabled || loading}
      className={`flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border bg-surface-glass px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        isGold
          ? "border-amber-500 text-amber-500 hover:border-amber-400 hover:text-amber-400"
          : "border-slate-400 text-slate-400 hover:border-slate-300 hover:text-slate-300"
      }`}
    >
      <Image
        src={isGold ? "/icons/coin-gold.svg" : "/icons/coin-silver.svg"}
        alt=""
        width={16}
        height={16}
        aria-hidden="true"
        className="shrink-0"
      />
      {!loading && <span className="text-xs font-medium">{costAmount}</span>}
    </button>
  );
}
