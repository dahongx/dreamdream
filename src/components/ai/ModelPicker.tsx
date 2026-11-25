"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { NIMIR_VISIBLE_MODELS, type NimirModelId } from "@/lib/ai/models";

interface ModelCosts {
  [modelId: string]: { gold: number; silver: number };
}

type StabilityStatus = "smooth" | "congested" | "interrupted" | "unknown";

interface ModelStatus {
  modelId: string;
  firstCharTimeAvg: number | null;
  recentSuccessRate: number | null;
  stabilityStatus: StabilityStatus;
  sampleCount: number;
  windowMinutes: number;
}

interface ModelStatuses {
  [modelId: string]: ModelStatus;
}

const STATUS_COLORS: Record<StabilityStatus, string> = {
  smooth: "var(--semantic-success)",
  congested: "var(--semantic-warning)",
  interrupted: "var(--semantic-error)",
  unknown: "var(--text-muted)",
};

let cachedCosts: ModelCosts | null = null;
let pendingCosts: Promise<ModelCosts> | null = null;
let cachedStatuses: ModelStatuses | null = null;
let cachedStatusesAt = 0;
let pendingStatuses: Promise<ModelStatuses> | null = null;

async function loadModelCosts(): Promise<ModelCosts> {
  if (cachedCosts) return cachedCosts;
  if (pendingCosts) return pendingCosts;
  pendingCosts = fetch("/api/currency/model-costs")
    .then((res) => (res.ok ? res.json() : { costs: {} }))
    .then((data) => {
      cachedCosts = (data.costs as ModelCosts) ?? {};
      return cachedCosts;
    })
    .catch(() => {
      cachedCosts = {};
      return cachedCosts;
    })
    .finally(() => {
      pendingCosts = null;
    });
  return pendingCosts;
}

async function loadModelStatuses(force = false): Promise<ModelStatuses> {
  if (!force && cachedStatuses && Date.now() - cachedStatusesAt < 30_000) {
    return cachedStatuses;
  }
  if (pendingStatuses) return pendingStatuses;
  pendingStatuses = fetch("/api/models/status")
    .then((res) => (res.ok ? res.json() : { models: [] }))
    .then((data) => {
      const statuses = Object.fromEntries(
        ((data.models as ModelStatus[] | undefined) ?? []).map((status) => [
          status.modelId,
          status,
        ]),
      );
      cachedStatuses = statuses;
      cachedStatusesAt = Date.now();
      return statuses;
    })
    .catch(() => cachedStatuses ?? {})
    .finally(() => {
      pendingStatuses = null;
    });
  return pendingStatuses;
}

/**
 * Per-call 模型档位下拉。
 *
 * 组件本身无状态、不持久化 —— 调用方用 useState 持有并决定是否回写
 * localStorage / DB（ChatRoom 走 per-session localStorage，
 * key=`nj_model_<sessionId>`；AIGenerateButton modal 一次性，不存）。
 * 视觉沿用 debug toggle / studio reset 同调（border-subtle + mono uppercase）。
 *
 * size:
 *   sm   给 chat / studio header
 *   xs   给 AIGenerateButton modal（更紧凑）
 */

interface Props {
  value: NimirModelId;
  onChange: (id: NimirModelId) => void;
  size?: "sm" | "xs";
  disabled?: boolean;
  /**
   * 透传到内部 trigger <button> 的 id。
   * ChatRoom 需要挂 `nj_chat_input_model_btn`，让 creator 写的 pack CSS
   * 能精确命中真正的按钮元素（而不是外层包装 div）。
   */
  triggerId?: string;
}

export function ModelPicker({
  value,
  onChange,
  size = "sm",
  disabled,
  triggerId,
}: Props) {
  const { dict } = useI18n();
  const t = dict.modelPicker;
  const [costs, setCosts] = useState<ModelCosts>(() => cachedCosts ?? {});
  const [statuses, setStatuses] = useState<ModelStatuses>(
    () => cachedStatuses ?? {},
  );

  useEffect(() => {
    if (cachedCosts) return;
    let alive = true;
    loadModelCosts().then((c) => {
      if (alive) setCosts(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = (force = false) => {
      loadModelStatuses(force).then((next) => {
        if (alive) setStatuses(next);
      });
    };
    refresh();
    const timer = window.setInterval(() => refresh(true), 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const padding =
    size === "xs"
      ? "px-[var(--space-sm)] py-[1px]"
      : "h-8 px-[var(--space-sm)]";

  const tracking =
    size === "xs"
      ? "tracking-[0.1em]"
      : "tracking-[0.12em] sm:tracking-[0.18em]";

  const sizing = size === "xs" ? "text-[10px] leading-none" : "text-xs";

  const currentLabel = t.labels[value] ?? value;
  const currentStatus = statuses[value]?.stabilityStatus ?? "unknown";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          id={triggerId}
          type="button"
          aria-label={t.triggerAria}
          className={`flex items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass ${padding} font-mono ${sizing} uppercase ${tracking} text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[currentStatus] }}
          />
          <span>{currentLabel}</span>
          <span aria-hidden className="text-[0.7em]">
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-h-[min(320px,var(--radix-dropdown-menu-content-available-height))] w-[min(19rem,calc(100vw-var(--space-xl)))] overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated p-[var(--space-xs)] shadow-[var(--shadow-overlay)] sm:w-80"
        >
          {NIMIR_VISIBLE_MODELS.map((m) => {
            const selected = m.id === value;
            const label = t.labels[m.id] ?? m.label;
            const hint = t.hints[m.id] ?? m.hint;
            const cost = costs[m.id];
            const status = statuses[m.id];
            const stabilityStatus = status?.stabilityStatus ?? "unknown";
            const statusLabel = t.health[stabilityStatus];
            return (
              <DropdownMenu.Item
                key={m.id}
                onSelect={() => onChange(m.id)}
                className={`flex cursor-pointer flex-col gap-[var(--space-2xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-sm)] outline-none transition-colors hover:bg-accent-primary/10 focus:bg-accent-primary/10 ${
                  selected ? "text-accent-primary" : "text-text-primary"
                }`}
              >
                <span className="flex w-full items-center gap-[var(--space-xs)] text-sm">
                  <span className="flex min-w-0 flex-1 items-center gap-[var(--space-xs)]">
                    <span
                      aria-hidden
                      className={selected ? "opacity-100" : "opacity-0"}
                    >
                      ▸
                    </span>
                    <span className="truncate">{label}</span>
                  </span>
                  <span
                    className="inline-flex shrink-0 items-center gap-[var(--space-xs)] text-[10px] font-medium"
                    style={{ color: STATUS_COLORS[stabilityStatus] }}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{
                        backgroundColor: STATUS_COLORS[stabilityStatus],
                      }}
                    />
                    {statusLabel}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-[var(--space-xs)] pl-[var(--space-md)] text-xs text-text-muted">
                  <span className="min-w-0 truncate">{hint}</span>
                  {cost && (
                    <>
                      <span aria-hidden className="opacity-50">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-[3px] text-amber-400">
                        <Image
                          src="/icons/coin-gold.svg"
                          alt=""
                          width={14}
                          height={14}
                          className="shrink-0"
                        />
                        {cost.gold}
                        <span className="sr-only">
                          {dict.quota.currencyGoldLabel}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-[3px] text-slate-300">
                        <Image
                          src="/icons/coin-silver.svg"
                          alt=""
                          width={14}
                          height={14}
                          className="shrink-0"
                        />
                        {cost.silver}
                        <span className="sr-only">
                          {dict.quota.currencySilverLabel}
                        </span>
                      </span>
                    </>
                  )}
                </span>
                <span className="flex items-center gap-[var(--space-sm)] pl-[var(--space-md)] text-[10px] leading-tight text-text-muted">
                  <span className="inline-flex items-center gap-[var(--space-2xs)]">
                    <span aria-hidden>◷</span>
                    {t.health.responseTime}{" "}
                    {status?.firstCharTimeAvg == null
                      ? "--"
                      : `${status.firstCharTimeAvg.toFixed(2)}s`}
                  </span>
                  <span aria-hidden className="opacity-40">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-[var(--space-2xs)]">
                    <span aria-hidden>✓</span>
                    {t.health.successRate}{" "}
                    {status?.recentSuccessRate == null
                      ? "--"
                      : `${status.recentSuccessRate.toFixed(2)}%`}
                  </span>
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
