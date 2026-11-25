"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { NAV_ITEMS } from "@/components/nav/items";
import { useI18n } from "@/i18n/client";

/**
 * 手机端底部 Tab Bar —— `< md` (768px) 才出现。和桌面左侧 rail 共用 NAV_ITEMS。
 *
 * /chat/* 下整条返回 null（immersive 模式，让输入框 + 立绘吃满垂直空间）。
 * globals.css 里有配套规则在 `main:has(#nj_chat_app)` 上抹掉底部 padding。
 *
 * notched 机型（iPhone X+）走 env(safe-area-inset-bottom) 自动让出 home indicator。
 *
 * v2 Wave 7 交互仪式化：
 * - active icon 有 scale(1.10) 微弹（透过 CSS transform 的 spring easing）
 * - :active（tap 瞬间）触发 icon 0.94 按压反馈
 *
 * v2 Wave 19「月光滑轨」：
 * - 共享金色柔光圆片指示器，active tab 时出现在该 tab 下方
 * - 切换时用 CSS 变量 --active-tab 驱动 translateX，300ms 弹簧滑到
 *   新位置（不再"短线直接消失/出现"）
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? "";
  const { dict } = useI18n();

  if (pathname.startsWith("/chat")) return null;

  const activeIndex = NAV_ITEMS.findIndex(({ href }) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`),
  );
  const hasActiveTab = activeIndex >= 0;

  return (
    <nav
      aria-label={dict.shell.navAria}
      className="mobile-tabbar fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border-subtle bg-bg-elevated/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      style={
        {
          minHeight: "var(--bottombar-height)",
          // Wave 19：--active-tab 驱动月光滑轨位置（0-3），指示器
          // translateX = index × 100%（等宽 tab）
          "--active-tab": hasActiveTab ? activeIndex : 0,
        } as CSSProperties
      }
    >
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
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="group relative flex flex-1 flex-col items-center justify-center gap-[2px] py-[var(--space-xs)] text-[11px] text-text-muted transition-colors duration-[var(--dur-short)] hover:text-text-primary data-[active]:text-accent-gold"
            data-active={active || undefined}
          >
            <Icon
              width={22}
              height={22}
              strokeWidth={1.5}
              aria-hidden="true"
              className="transition-transform duration-[var(--dur-short)] ease-[cubic-bezier(0.2,0,0,1.4)] group-data-[active]:scale-110 group-active:scale-[0.94]"
            />
            <span className="text-[11px] leading-none tracking-wide">
              {label}
            </span>
          </Link>
        );
      })}

      {/* v2 Wave 19「月光滑轨」—— 共享金色柔光圆片，位于 tab 行顶部。
          translateX = --active-tab × 100%，300ms 弹簧滑到新位置。
          指示器在 nav 内、各 Link 之后 —— 绝对定位覆盖全部 tab 宽。 */}
      <span
        aria-hidden="true"
        className={
          hasActiveTab
            ? "moon-slider pointer-events-none absolute inset-x-0 top-0"
            : "hidden"
        }
      />
    </nav>
  );
}
