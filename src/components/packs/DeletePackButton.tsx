"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import { deletePackAction } from "@/lib/packs/actions";

interface Props {
  packId: string;
  packName: string;
}

export function DeletePackButton({ packId, packName }: Props) {
  const { dict } = useI18n();
  const router = useRouter();
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();
  const t = dict.packDelete;

  async function onClick() {
    if (
      !(await dialog.confirm({
        body: t.confirm.replace("{name}", packName),
        danger: true,
      }))
    )
      return;
    startTransition(async () => {
      const result = await deletePackAction(packId);
      if (!result.ok) {
        await dialog.alert({ body: dict.errors.generic });
        return;
      }
      router.push("/packs");
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-[var(--radius-sm)] border border-semantic-error/40 px-[var(--space-md)] py-[var(--space-xs)] text-base text-semantic-error transition-colors hover:bg-semantic-error/10 disabled:opacity-60"
    >
      {pending ? t.deleting : t.action}
    </button>
  );
}
