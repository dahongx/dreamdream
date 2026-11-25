"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useExploreTransition } from "@/components/explore/ExploreTransition";
import type { ExploreSort } from "@/lib/characters/queries";

interface SortOption {
  value: ExploreSort;
  label: string;
}

interface Props {
  value: ExploreSort;
  options: SortOption[];
  ariaLabel: string;
}

/**
 * 探索页角色 tab 的排序下拉。选中即跳转,保留 q / tag / view 等其他参数。
 * 默认值 recommended 通过删除 sort 参数表达,URL 更干净。
 */
export function SortSelect({ value, options, ariaLabel }: Props) {
  const { navigate } = useExploreTransition();
  const pathname = usePathname();
  const params = useSearchParams();
  const featured = value === "recommended";

  function onChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next === "recommended") sp.delete("sort");
    else sp.set("sort", next);
    const qs = sp.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="relative shrink-0">
      <span className="sr-only">{ariaLabel}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        data-featured={featured || undefined}
        className={`explore-sort-select appearance-none rounded-[var(--radius-sm)] border bg-surface-glass py-[var(--space-xs)] pl-[var(--space-md)] pr-[42px] text-base outline-none transition-colors hover:border-border-strong focus:border-border-strong ${
          featured
            ? "border-accent-gold/60 text-accent-gold"
            : "border-border-subtle text-text-primary"
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[0.72em] ${
          featured
            ? "right-[var(--space-lg)] text-accent-gold"
            : "right-[var(--space-sm)] text-text-muted"
        }`}
      >
        {featured ? "✦" : "▾"}
      </span>
      {featured && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-[var(--space-sm)] top-1/2 -translate-y-1/2 text-[0.7em] text-accent-gold/80"
        >
          ▾
        </span>
      )}
      <span
        aria-hidden
        className="explore-sort-glow pointer-events-none absolute inset-0 rounded-[var(--radius-pill)] opacity-0"
      ></span>
    </label>
  );
}
