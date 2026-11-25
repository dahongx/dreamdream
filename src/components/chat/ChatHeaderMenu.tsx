"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  History as HistoryIcon,
  MessageSquare,
  SquarePen as NewIcon,
  Save as SaveIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { SavedSessionsDialog } from "@/components/chat/SavedSessionsDialog";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import {
  discardAndStartNewAction,
  saveAndStartNewAction,
} from "@/lib/sessions/actions";

interface Props {
  characterId: string;
  characterName: string;
  /**
   * Whether the current session has any user-authored messages. If it's
   * pristine (only opening assistant message), "保存并新建" is a no-op so
   * we surface a small alert instead.
   */
  currentHasUserMessages: boolean;
}

/**
 * 顶栏「⋯」对话操作菜单 — 三项:
 *   1) 保存并开启新对话 → 把当前临时对话归档到 saved,创建新 current 并跳转
 *   2) 开启新对话(不保存) → 销毁当前临时对话再创建,confirm dialog 兜底
 *   3) 历史保存对话 → 打开 SavedSessionsDialog
 *
 * 视觉:跟 debug toggle 共用 border-subtle / radius-sm token,菜单本身用
 * surface-solid 暗面板 + scanline。
 */
export function ChatHeaderMenu({
  characterId,
  characterName,
  currentHasUserMessages,
}: Props) {
  const { dict } = useI18n();
  const { confirm, alert } = useDialog();
  const [, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleSaveAndNew() {
    if (!currentHasUserMessages) {
      await alert({ body: dict.chat.saveCurrentEmptyAlert });
      return;
    }
    startTransition(async () => {
      const res = await saveAndStartNewAction(characterId);
      if (res.ok) {
        // router.push 到相同 URL 不会触发 RSC 重新 fetch (Next 16 client
        // router cache),用 window.location 强刷拉到新 session 的 opening。
        window.location.assign(`/chat/${characterId}`);
      }
    });
  }

  async function handleDiscardAndNew() {
    const ok = await confirm({
      title: dict.chat.discardCurrentConfirmTitle,
      body: dict.chat.discardCurrentConfirmBody,
      confirmLabel: dict.chat.discardCurrentConfirmOk,
      cancelLabel: dict.chat.discardCurrentConfirmCancel,
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await discardAndStartNewAction(characterId);
      if (res.ok) {
        window.location.assign(`/chat/${characterId}`);
      }
    });
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            id="nj_header_more_btn"
            type="button"
            aria-label={dict.chat.menuTriggerAria}
            className="nj_header_more_btn flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <MessageSquare
              width={16}
              height={16}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            id="nj_header_more_menu"
            sideOffset={6}
            align="end"
            className="nj_header_more_menu z-[80] min-w-[200px] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-xs)] shadow-(--shadow-overlay) focus:outline-none"
          >
            <DropdownMenu.Item
              className="nj_header_menu_item flex cursor-pointer items-center gap-[var(--space-sm)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
              onSelect={(e) => {
                e.preventDefault();
                handleSaveAndNew();
              }}
            >
              <SaveIcon width={15} height={15} strokeWidth={1.5} />
              {dict.chat.menuSaveAndNew}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="nj_header_menu_item flex cursor-pointer items-center gap-[var(--space-sm)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
              onSelect={(e) => {
                e.preventDefault();
                handleDiscardAndNew();
              }}
            >
              <NewIcon width={15} height={15} strokeWidth={1.5} />
              {dict.chat.menuNewWithoutSave}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="nj_header_menu_item flex cursor-pointer items-center gap-[var(--space-sm)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
              onSelect={(e) => {
                e.preventDefault();
                setHistoryOpen(true);
              }}
            >
              <HistoryIcon width={15} height={15} strokeWidth={1.5} />
              {dict.chat.menuHistory}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <SavedSessionsDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        characterId={characterId}
        characterName={characterName}
      />
    </>
  );
}
