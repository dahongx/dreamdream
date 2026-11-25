"use client";

import * as Popover from "@radix-ui/react-popover";
import { Menu } from "lucide-react";
import { NsfwToggle } from "@/components/explore/NsfwToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n/client";
import { SFW_MODE } from "@/lib/config/site";

interface Props {
  defaultNsfw: boolean;
  variant?: "solid" | "ghost";
}

/**
 * 手机端 topbar 右侧的偏好菜单。把 LanguageToggle + NsfwToggle 收进 popover，
 * 右上只留三横线 + 头像，腾出顶栏空间。桌面（md+）走 Shell.tsx 里的原始 inline
 * 布局，不挂这个组件。
 */
export function TopbarMobileMenu({ defaultNsfw, variant = "solid" }: Props) {
  const { dict } = useI18n();
  const triggerClassName =
    variant === "ghost"
      ? "flex h-9 w-9 shrink-0 items-center justify-center border-0 bg-transparent text-text-muted transition-colors hover:text-accent-gold-soft"
      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-solid text-text-muted transition-colors hover:border-border-strong hover:text-text-primary";

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={dict.shell.menuAria}
        className={triggerClassName}
      >
        <Menu width={18} height={18} strokeWidth={1.5} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 flex w-fit flex-col items-start gap-[var(--space-md)] rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated p-[var(--space-md)] shadow-2xl"
        >
          <LanguageToggle />
          {!SFW_MODE && <NsfwToggle defaultOn={defaultNsfw} />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
