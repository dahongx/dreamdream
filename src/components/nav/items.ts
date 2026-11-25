import { Compass, Feather, MessageSquare, UserCircle2 } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * 桌面左侧 rail 和移动端底部 Tab Bar 同源数据，避免两边漂移。
 * labelKey 索引到 dict.nav 上，server 用 getRequestDict，client 用 useI18n。
 */
export type NavLabelKey = "explore" | "sessions" | "create" | "profile";

export interface NavItem {
  href: string;
  labelKey: NavLabelKey;
  Icon: IconCmp;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/explore", labelKey: "explore", Icon: Compass },
  // 「会话」是高频回访入口（登录用户日常都是回到这里找上次聊到一半的角色），
  // 紧靠探索之后，让用户从「找新卡 → 进会话」一条直线。
  { href: "/sessions", labelKey: "sessions", Icon: MessageSquare },
  // 「创建」合并了角色库和美化包管理，tab 内切换。
  { href: "/create", labelKey: "create", Icon: Feather },
  { href: "/me", labelKey: "profile", Icon: UserCircle2 },
];
