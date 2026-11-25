import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 内容 tab —— 全站统一视觉（短线式，源自 /create 的 TabLink）。
 *
 * 此前三种 tab 词汇并存：/create 短线式、/sessions 与 admin 的
 * border-b-2 文字变色式、/me 的胶囊填充式。统一为短线式：衬线 tab
 * 文字（active 保持 text-primary，不变色）+ 2px accent 圆角短线。
 * 胶囊式保留给「筛选」语义（如 sessions 的 FilterPills），不用这个组件。
 *
 * 用法：外层自备 `flex items-center gap-[--space-lg] border-b
 * border-border-subtle` 的 nav。URL 驱动用 TabNavLink（server 可用），
 * 客户端 state 驱动用 TabNavButton。
 */

function tabCls(active: boolean, size: "lg" | "md") {
  const textSize = size === "lg" ? "text-xl" : "text-base";
  return `relative -mb-px pb-[var(--space-xs)] font-display-zh ${textSize} tracking-wide transition-colors ${
    active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
  }`;
}

function ActiveLine({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent-primary"
    />
  );
}

interface LinkProps {
  href: string;
  active: boolean;
  size?: "lg" | "md";
  children: ReactNode;
}

export function TabNavLink({ href, active, size = "lg", children }: LinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={tabCls(active, size)}
    >
      {children}
      <ActiveLine active={active} />
    </Link>
  );
}

interface ButtonProps {
  active: boolean;
  onClick: () => void;
  size?: "lg" | "md";
  children: ReactNode;
}

export function TabNavButton({
  active,
  onClick,
  size = "lg",
  children,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={tabCls(active, size)}
    >
      {children}
      <ActiveLine active={active} />
    </button>
  );
}
