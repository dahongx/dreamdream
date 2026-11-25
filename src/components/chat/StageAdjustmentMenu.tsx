"use client";

import * as Popover from "@radix-ui/react-popover";
import { Activity } from "lucide-react";
import { useI18n } from "@/i18n/client";

interface Props {
  /** 0-100, 直接作用到 #nj_background_image 的 filter: brightness() */
  brightness: number;
  /** 0-100, 直接作用到 #nj_background_image 的 opacity */
  clarity: number;
  onChange: (next: { brightness: number; clarity: number }) => void;
}

/**
 * 顶栏「波形」按钮:开启立绘亮度 / 清晰度调节面板。
 *
 * 视觉契约:
 *   - 按钮尺寸 / 边框沿用 ChatHeaderMenu 的 32x32 + border-subtle 同款
 *   - Popover 用 surface-solid 暗面板
 *   - 紫色 slider 用 linear-gradient 拼成「filled / unfilled」两段背景,
 *     thumb 是 bg-base 暗圆 + accent-primary 细边
 *
 * selector:
 *   #nj_stage_adjust_btn        触发按钮
 *   #nj_stage_adjust_popover    Popover 面板
 *   .nj_stage_adjust_brightness 亮度 slider
 *   .nj_stage_adjust_clarity    清晰度 slider
 */
export function StageAdjustmentMenu({ brightness, clarity, onChange }: Props) {
  const { dict } = useI18n();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          id="nj_stage_adjust_btn"
          type="button"
          aria-label={dict.chat.stageAdjustTriggerAria}
          className="relative z-[110] flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <Activity
            width={16}
            height={16}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          id="nj_stage_adjust_popover"
          sideOffset={6}
          align="end"
          collisionPadding={12}
          className="z-[80] w-[280px] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-md)] shadow-(--shadow-overlay) focus:outline-none"
        >
          <SliderRow
            label={dict.chat.stageAdjustBrightness}
            value={brightness}
            selectorClass="nj_stage_adjust_brightness"
            onChange={(v) => onChange({ brightness: v, clarity })}
          />
          <div className="mt-[var(--space-md)]">
            <SliderRow
              label={dict.chat.stageAdjustClarity}
              value={clarity}
              selectorClass="nj_stage_adjust_clarity"
              onChange={(v) => onChange({ brightness, clarity: v })}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  selectorClass: string;
  onChange: (next: number) => void;
}

function SliderRow({ label, value, selectorClass, onChange }: SliderRowProps) {
  const pct = Math.max(0, Math.min(100, value));
  const trackBg = `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${pct}%, color-mix(in oklch, var(--bg-base), transparent 50%) ${pct}%, color-mix(in oklch, var(--bg-base), transparent 50%) 100%)`;

  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      <div className="flex items-center justify-between">
        <span className="font-body-zh text-sm text-text-secondary">
          {label}
        </span>
        <span className="font-mono text-xs text-text-muted">{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: trackBg }}
        className={`${selectorClass} nj_stage_adjust_slider h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-accent-primary [&::-moz-range-thumb]:bg-bg-base [&::-moz-range-thumb]:shadow-[0_0_0_2px_rgba(0,0,0,0.4)] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-accent-primary [&::-webkit-slider-thumb]:bg-bg-base [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(0,0,0,0.4)]`}
      />
    </div>
  );
}
