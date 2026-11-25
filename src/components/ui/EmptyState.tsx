import Link from "next/link";
import type { ComponentType } from "react";
import { btnPrimary } from "@/components/ui/button";

/**
 * 空状态 —— 全站统一词汇。
 *
 * 此前三套并存：/create 的 glass-card + 图标圆环 + 衬线标题 + CTA（质量
 * 最好，定为标准）、sessions 的虚线框、shop 直购的纯文字居中。统一后
 * 空状态在任何页面都是同一种「安静的邀请」。
 *
 * server / client 组件皆可用（无 hook）。
 */

interface Props {
  title: string;
  hint?: string;
  ctaHref?: string;
  ctaLabel?: string;
  Icon?: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
}

export function EmptyState({ title, hint, ctaHref, ctaLabel, Icon }: Props) {
  return (
    <div className="glass-card relative flex flex-col items-center justify-center gap-[var(--space-sm)] overflow-hidden p-[var(--space-2xl)] text-center">
      {/* 品牌粉紫底光 —— 空状态不再是一块冷玻璃，带一点梦幻氛围 */}
      <div
        aria-hidden="true"
        className="brand-aura pointer-events-none absolute inset-0"
      />
      <div className="relative flex flex-col items-center gap-[var(--space-sm)]">
        {Icon && (
          <div className="mb-[var(--space-xs)] flex h-14 w-14 items-center justify-center rounded-full border border-border-subtle bg-surface-solid/40 text-accent-primary/70">
            <Icon size={22} strokeWidth={1.5} />
          </div>
        )}
        <p className="font-display-zh text-xl leading-tight tracking-wide text-text-primary">
          {title}
        </p>
        {hint && (
          <p className="max-w-md text-xs leading-relaxed text-text-muted">
            {hint}
          </p>
        )}
        {ctaHref && ctaLabel && (
          <Link href={ctaHref} className={`mt-[var(--space-sm)] ${btnPrimary}`}>
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
