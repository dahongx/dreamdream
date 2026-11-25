"use client";

import { type ReactNode, useState } from "react";
import { TransitionLink } from "@/components/explore/ExploreTransition";

interface TagOption {
  label: string;
  href: string;
  active: boolean;
}

interface Props {
  options: TagOption[];
  expandLabel: string;
  collapseLabel: string;
  /**
   * "positive"（默认）= 正向筛选,选中态高亮主色。
   * "exclude"        = 屏蔽筛选,选中态红色虚线 + 删除线,提示「已屏蔽」。
   */
  variant?: "positive" | "exclude";
  /**
   * 可选前缀（如「屏蔽:」），不挂在 chips 里,单独成块占第一格。
   */
  prefix?: string;
  /**
   * 行末操作区（「更多/收起」按钮之后）追加的元素,如「屏蔽标签」弹窗触发按钮。
   * 跟标签、「更多」在同一个 flex-wrap 流里,自然内联跟在最后一个可见标签之后。
   */
  trailing?: ReactNode;
  /**
   * 收起状态下平铺显示的标签数量(含「全部」)。默认 8 —— 手机上约铺满两行、
   * 桌面一行;点「更多」展开全部。
   *
   * 关键:标签、「更多」、trailing(屏蔽) 全在同一个 `flex-wrap` 里平铺,标签用满
   * 整行宽度、「更多/屏蔽」内联跟在末尾 —— 不再把控件拆成右侧固定一列(那会把
   * 标签挤进左半屏、右半屏留白,即展开时那个「占半页」的丑布局)。
   */
  collapsedCount?: number;
}

export function TagFilterRow({
  options,
  expandLabel,
  collapseLabel,
  variant = "positive",
  prefix,
  trailing,
  collapsedCount = 8,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isExclude = variant === "exclude";
  const hasMore = options.length > collapsedCount;

  // 收起时只平铺前 collapsedCount 个;但若当前选中的标签在折叠区之外,把它补进
  // 可见区,避免「选了个靠后的标签、收起后自己却看不见」。
  let visible = options;
  if (!expanded && hasMore) {
    visible = options.slice(0, collapsedCount);
    const activeIdx = options.findIndex((o) => o.active);
    if (activeIdx >= collapsedCount) visible = [...visible, options[activeIdx]];
  }

  return (
    <div className="tag-filter-row mb-[var(--space-lg)] flex flex-wrap items-center gap-[var(--space-xs)]">
      {prefix && (
        <span className="shrink-0 px-[var(--space-xs)] py-[4px] text-sm text-text-muted">
          {prefix}
        </span>
      )}
      {visible.map((opt) => {
        const baseShape =
          "tag-chip shrink-0 rounded-[var(--radius-pill)] px-[var(--space-md)] py-[4px] text-sm transition-colors";
        let stateClass: string;
        if (opt.active) {
          stateClass = isExclude
            ? "border border-dashed border-semantic-error text-semantic-error line-through"
            : // v2 Wave 5「夜青银」：选中态从冷银淡底改成金色 hairline +
              // 淡金底 + 金色文字。金色作为 90/10 里的 10 点睛，用在
              // "用户主动选择"的语义上（tag 是用户表达偏好的动作）。
              "border border-accent-gold/50 bg-accent-gold/10 text-accent-gold";
        } else {
          stateClass =
            "border border-border-subtle text-text-muted hover:text-text-primary";
        }
        return (
          <TransitionLink
            key={opt.label}
            href={opt.href}
            ariaCurrent={opt.active ? "page" : undefined}
            className={`${baseShape} ${stateClass}`}
          >
            {opt.label}
          </TransitionLink>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="tag-chip tag-chip-more shrink-0 rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-md)] py-[4px] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
      {trailing}
    </div>
  );
}
