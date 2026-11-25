import { TabNavLink } from "@/components/ui/TabNav";

/**
 * /sessions 顶部「最近会话 / 我的收藏」tab。靠 ?tab= 切换,纯链接无 JS。
 * 视觉走全站统一的短线式 TabNav(原 border-b-2 文字变色式已收敛)。
 */
interface Props {
  active: "recent" | "favorites";
  recentLabel: string;
  favoritesLabel: string;
  ariaLabel: string;
}

export function SessionsTabs({
  active,
  recentLabel,
  favoritesLabel,
  ariaLabel,
}: Props) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center gap-[var(--space-lg)] border-b border-border-subtle"
    >
      <TabNavLink href="/sessions?tab=recent" active={active === "recent"}>
        {recentLabel}
      </TabNavLink>
      <TabNavLink
        href="/sessions?tab=favorites"
        active={active === "favorites"}
      >
        {favoritesLabel}
      </TabNavLink>
    </nav>
  );
}
