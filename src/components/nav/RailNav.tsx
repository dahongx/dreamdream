"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/nav/items";
import { useI18n } from "@/i18n/client";

/**
 * 桌面 rail 导航列 —— 抽成 client 组件只为拿 usePathname 算 active 态。
 * active 行 = 高亮底色 + 一条金色细下划线（Shell docblock 承诺的
 * "thin gold underline on the active row"，金色作为「你在这里」的特别
 * 标记是它在 chrome 上唯一的合法出场）。active 判定与 MobileTabBar
 * 同源对称，避免桌面/移动导航反馈不一致。
 */
export function RailNav() {
  const pathname = usePathname() ?? "";
  const { dict } = useI18n();

  return (
    <nav className="mt-[var(--space-sm)] flex flex-col items-center gap-[var(--space-md)]">
      {NAV_ITEMS.map(({ href, labelKey, Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        const label = dict.nav[labelKey];
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            data-active={active || undefined}
            className="group relative flex w-[var(--rail-width)] flex-col items-center justify-center gap-[4px] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/40 py-[var(--space-sm)] text-[11px] text-text-muted transition-colors hover:border-border-strong hover:bg-surface-glass hover:text-text-primary data-[active]:border-accent-gold/50 data-[active]:bg-accent-gold/10 data-[active]:text-accent-gold"
          >
            <Icon width={22} height={22} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[11px] leading-none tracking-wide">
              {label}
            </span>
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-[var(--space-md)] bottom-[3px] h-[1.5px] rounded-full bg-accent-gold/80"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
