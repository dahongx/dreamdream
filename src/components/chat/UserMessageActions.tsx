"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Copy as CopyIcon,
  Trash2 as DeleteIcon,
  Pencil as EditIcon,
  Ellipsis as EllipsisIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { useI18n } from "@/i18n/client";
import { copyTextToClipboard } from "@/lib/util/clipboard";

/**
 * 用户气泡下方的「⋯」操作菜单：修改 / 删除 / 复制。
 *
 * 与 AI 气泡的 MessageActionsMenu 对称 —— 同样的 Radix DropdownMenu pattern、
 * 同样的 hover-reveal 触发器视觉。删除走 confirm dialog 整轮成对删（用户消息
 * + 紧随其后的 AI 回复一起 hard-delete，见 deleteUserMessagePair）。修改进
 * 内联 textarea 编辑模式（原地替换气泡，不弹 modal）；保存后写回 DB。
 *
 * onEdit / onDelete 为 null 时不渲染对应菜单项；菜单里只剩"复制"也仍然出菜
 * 单按钮（与 AI 侧一致：复制始终可用）。
 */

interface Props {
  text: string;
  onEdit?: ((newContent: string) => Promise<void>) | null;
  onDelete?: (() => Promise<void>) | null;
  children: ReactNode;
}

export function UserMessageActions({
  text,
  onEdit,
  onDelete,
  children,
}: Props) {
  const { dict } = useI18n();
  const { confirm } = useDialog();
  const { success, error } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  function handleStartEdit() {
    setEditValue(text);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!onEdit) return;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === text) {
      setEditing(false);
      return;
    }
    try {
      await onEdit(trimmed);
      setEditing(false);
    } catch {
      window.alert(dict.chat.userMsgActionsEditFailed);
    }
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditValue(text);
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = await confirm({
      title: dict.chat.userMsgActionsDelete,
      body: dict.chat.userMsgActionsDeleteConfirm,
      confirmLabel: dict.chat.userMsgActionsDelete,
      cancelLabel: dict.dialog.cancel,
      danger: true,
    });
    if (!ok) return;
    try {
      await onDelete();
    } catch {
      window.alert(dict.chat.userMsgActionsDeleteFailed);
    }
  }

  async function handleCopy() {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      success(dict.chat.userMsgActionsCopySuccess);
    } else {
      error(dict.chat.userMsgActionsCopyFailed);
    }
  }

  if (editing) {
    return (
      <div className="flex w-full max-w-[80%] flex-col gap-[var(--space-xs)] self-end">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSaveEdit();
            }
            if (e.key === "Escape") {
              handleCancelEdit();
            }
          }}
          placeholder={dict.chat.userMsgActionsEditPlaceholder}
          rows={3}
          className="w-full resize-none rounded-[var(--radius-md)] border border-border-strong bg-surface-solid px-[var(--space-md)] py-[var(--space-sm)] text-base leading-relaxed text-text-primary outline-none focus:border-accent-primary"
        />
        <div className="flex justify-end gap-[var(--space-xs)]">
          <button
            type="button"
            onClick={handleCancelEdit}
            className="rounded-[var(--radius-sm)] px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            {dict.chat.userMsgActionsEditCancel}
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            className="rounded-[var(--radius-sm)] bg-accent-primary/20 px-[var(--space-md)] py-[var(--space-xs)] text-xs text-accent-primary transition-colors hover:bg-accent-primary/30"
          >
            {dict.chat.userMsgActionsEditSave}
          </button>
        </div>
      </div>
    );
  }

  // 没有任何 callback 时（流式 / fork 后被禁用），不挂触发器
  const hasAnyAction = !!onEdit || !!onDelete;

  return (
    <div className="flex w-fit max-w-[80%] flex-col items-end gap-[var(--space-2xs)]">
      {children}
      {hasAnyAction && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={dict.chat.userMsgActionsTriggerAria}
              className="nj_user_message_actions_btn inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-all hover:bg-surface-glass hover:text-text-primary"
            >
              <EllipsisIcon
                width={16}
                height={16}
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              align="end"
              className="nj_user_message_actions_box z-[80] flex items-center gap-[var(--space-xs)] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-xs)] shadow-(--shadow-overlay) focus:outline-none"
            >
              {onEdit && (
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
                  onSelect={() => {
                    // 不 preventDefault —— 让 Radix 同步关菜单。setTimeout 推到
                    // 下一 tick，确保 DropdownMenu Portal 卸载后再切到编辑态，
                    // 避免 portal 焦点陷阱与 textarea autofocus 冲突。
                    setTimeout(handleStartEdit, 0);
                  }}
                >
                  <EditIcon width={13} height={13} strokeWidth={1.5} />
                  {dict.chat.userMsgActionsEdit}
                </DropdownMenu.Item>
              )}
              {onDelete && (
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-semantic-error outline-none transition-colors data-[highlighted]:bg-semantic-error/10"
                  onSelect={() => {
                    // 见 MessageActionsMenu 同款注释：让 portal 卸载后再挂 confirm
                    // dialog，否则 body[pointer-events:none] 不复位会整页失活。
                    setTimeout(handleDelete, 0);
                  }}
                >
                  <DeleteIcon width={13} height={13} strokeWidth={1.5} />
                  {dict.chat.userMsgActionsDelete}
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
                onSelect={() => {
                  void handleCopy();
                }}
              >
                <CopyIcon width={13} height={13} strokeWidth={1.5} />
                {dict.chat.userMsgActionsCopy}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}
