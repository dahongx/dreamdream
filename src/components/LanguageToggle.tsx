"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Globe } from "lucide-react";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { LOCALE_OPTIONS, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/lib/i18n/actions";

/**
 * 语言切换。原本是原生 <select> —— 浏览器把 option 列表画成系统菜单（亮底黑字），
 * 跟暗紫黑主题完全脱节，且 macOS / Windows 各画各的，DESIGN.md 的 token 一个都吃不到。
 * 换成 Radix DropdownMenu 自渲染面板，浮层沿用 chat 顶栏菜单的同一套
 * border-strong + surface-solid + shadow-overlay。
 */
export function LanguageToggle() {
  const { locale, dict } = useI18n();
  const [pending, startTransition] = useTransition();

  const current =
    LOCALE_OPTIONS.find((option) => option.value === locale) ??
    LOCALE_OPTIONS[0];

  function setLocale(nextLocale: Locale) {
    if (nextLocale === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(nextLocale);
      window.location.reload();
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={pending}>
        <button
          type="button"
          aria-label={dict.shell.languageLabel}
          className="flex items-center gap-[var(--space-xs)] rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass/40 px-[var(--space-sm)] py-[3px] text-sm text-text-primary transition-colors hover:border-border-strong focus-visible:border-accent-primary focus-visible:outline-none disabled:opacity-60 data-[state=open]:border-border-strong"
        >
          <Globe
            width={14}
            height={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-text-muted"
          />
          <span>{current?.label}</span>
          <span aria-hidden className="text-[0.7em] text-text-muted">
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[80] min-w-[160px] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-xs)] shadow-(--shadow-overlay) focus:outline-none"
        >
          <DropdownMenu.RadioGroup
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
          >
            {LOCALE_OPTIONS.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="flex cursor-pointer items-center gap-[var(--space-sm)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary data-[state=checked]:text-accent-primary"
              >
                <span className="flex w-[14px] shrink-0 items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <Check width={14} height={14} strokeWidth={2} />
                  </DropdownMenu.ItemIndicator>
                </span>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
