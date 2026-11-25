"use client";

import { useState, useTransition } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import type { StudioSession } from "@/lib/db/schema";

interface Props {
  session: StudioSession;
  hasDraft: boolean;
  onConfirm: () => Promise<void> | void;
  onDiscard: () => Promise<void> | void;
}

/**
 * 会话「丢弃 / 确认应用」按钮组。被 AssistantTab 当作输入行右侧的
 * trailingActions 渲染，与发送按钮共占一行。
 *
 * 仅当 session.status === "active" 时由 StudioLayout 注入。
 */
export function SessionFooter({
  session: _session,
  hasDraft,
  onConfirm,
  onDiscard,
}: Props) {
  const { dict } = useI18n();
  const t = dict.packs;
  const dialog = useDialog();
  const [confirming, startConfirm] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startConfirm(async () => {
      try {
        await onConfirm();
      } catch (e) {
        setError(
          t.studioSessionCommitFail.replace(
            "{reason}",
            e instanceof Error ? e.message : t.studioSessionUnknownError,
          ),
        );
      }
    });
  }

  function handleDiscard() {
    void (async () => {
      const ok = await dialog.confirm({
        body: t.studioSessionDiscardConfirm,
        danger: true,
      });
      if (!ok) return;
      startDiscard(async () => {
        try {
          await onDiscard();
        } catch (e) {
          setError(e instanceof Error ? e.message : t.studioSessionDiscardFail);
        }
      });
    })();
  }

  return (
    <div
      id="nj_pack_studio_session_footer"
      className="flex shrink-0 items-center gap-[var(--space-xs)] self-end"
    >
      {error && (
        <span
          title={error}
          className="max-w-[160px] truncate text-[10px] text-semantic-error"
        >
          {error}
        </span>
      )}
      <button
        type="button"
        id="nj_pack_studio_session_discard"
        onClick={handleDiscard}
        disabled={discarding || confirming}
        className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-border-subtle px-[var(--space-md)] text-sm text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
      >
        {t.studioSessionDiscard}
      </button>
      <button
        type="button"
        id="nj_pack_studio_session_confirm"
        onClick={handleConfirm}
        disabled={!hasDraft || confirming || discarding}
        title={hasDraft ? undefined : t.studioSessionFooterClean}
        className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-accent-primary px-[var(--space-md)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-40"
      >
        {confirming ? t.studioSessionConfirming : t.studioSessionConfirm}
      </button>
    </div>
  );
}
