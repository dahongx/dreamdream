"use client";

import * as Switch from "@radix-ui/react-switch";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { setNsfwPreference } from "@/lib/explore/preferences";

interface Props {
  defaultOn: boolean;
}

/**
 * NSFW preference pill — lives in the global topbar. Default ON per DESIGN.md
 * (platform serves that audience by design). State persists via cookie through
 * a Server Action so RSC re-runs the explore query with the new filter.
 *
 * Style references ui-mock/variant-b.png: amethyst-purple track when on,
 * muted glass when off, white knob slides with a slight glow on active.
 */
export function NsfwToggle({ defaultOn }: Props) {
  const { dict } = useI18n();
  const [pending, start] = useTransition();

  return (
    <span
      className="flex select-none items-center gap-[var(--space-sm)] text-base text-text-secondary"
      title={dict.nsfw.toggleTitle}
    >
      <span
        id="nj-nsfw-toggle-label"
        className="font-mono uppercase tracking-[0.15em]"
      >
        {dict.nsfw.label}
      </span>
      <Switch.Root
        aria-labelledby="nj-nsfw-toggle-label"
        defaultChecked={defaultOn}
        disabled={pending}
        onCheckedChange={(checked) => {
          start(async () => {
            await setNsfwPreference(checked);
          });
        }}
        className="
          group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center
          rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass
          transition-colors duration-[var(--dur-short)]
          data-[state=checked]:border-accent-primary
          data-[state=checked]:bg-accent-primary
          data-[state=checked]:shadow-(--glow-accent)
          disabled:opacity-60
        "
      >
        <Switch.Thumb
          className="
            block h-[18px] w-[18px] translate-x-[3px] rounded-full
            bg-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.5)]
            transition-transform duration-[var(--dur-short)] will-change-transform
            data-[state=checked]:translate-x-[22px]
          "
        />
      </Switch.Root>
    </span>
  );
}
