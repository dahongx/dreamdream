"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import { deleteCharacterAction } from "@/lib/characters/actions";

interface Props {
  characterId: string;
  characterName: string;
  /**
   * "danger-zone" (default): full card with title + hint, used at the
   * bottom of the edit page.
   * "topbar": just the button itself, sized to live next to Edit/Save
   * in a page header row.
   */
  variant?: "danger-zone" | "topbar";
}

export function DeleteCharacterButton({
  characterId,
  characterName,
  variant = "danger-zone",
}: Props) {
  const { dict } = useI18n();
  const router = useRouter();
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();
  const t = dict.characterDelete;

  async function onClick() {
    if (
      !(await dialog.confirm({
        body: t.confirm.replace("{name}", characterName),
        danger: true,
      }))
    )
      return;
    startTransition(async () => {
      const result = await deleteCharacterAction(characterId);
      if (!result.ok) {
        await dialog.alert({ body: dict.errors.generic });
        return;
      }
      router.push("/mine");
    });
  }

  if (variant === "topbar") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-[var(--radius-sm)] border border-semantic-error/40 px-[var(--space-lg)] py-[var(--space-sm)] text-sm text-semantic-error transition-colors hover:bg-semantic-error/10 disabled:opacity-60"
      >
        {pending ? t.deleting : t.action}
      </button>
    );
  }

  return (
    <section className="glass-card flex items-center justify-between gap-[var(--space-md)] p-[var(--space-xl)]">
      <div>
        <p className="font-display-zh text-lg text-semantic-error">{t.title}</p>
        <p className="mt-[var(--space-xs)] text-sm text-text-muted">{t.hint}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-[var(--radius-sm)] border border-semantic-error/40 px-[var(--space-md)] py-[var(--space-sm)] text-sm text-semantic-error transition-colors hover:bg-semantic-error/10 disabled:opacity-60"
      >
        {pending ? t.deleting : t.action}
      </button>
    </section>
  );
}
