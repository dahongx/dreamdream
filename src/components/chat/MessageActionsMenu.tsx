"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  StepForward as ContinueIcon,
  Copy as CopyIcon,
  Trash2 as DeleteIcon,
  Pencil as EditIcon,
  Ellipsis as EllipsisIcon,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";

interface Props {
  onDelete?: (() => Promise<void>) | null;
  /** 当 onDelete 为 null 但仍要解释「为什么没法删」时传入，会渲染置灰的删除项 +
   *  原因小字。配合 ChatRoom 用于开场白（i=0）这种语义上不允许单删的场景。 */
  deleteDisabledReason?: string | null;
  onContinue?: (() => void) | null;
  onEdit?: (() => void) | null;
  onCopy: () => void | Promise<void>;
}

export function MessageActionsMenu({
  onDelete,
  deleteDisabledReason,
  onContinue,
  onEdit,
  onCopy,
}: Props) {
  const { dict } = useI18n();
  const { confirm } = useDialog();

  async function handleDelete() {
    if (!onDelete) return;
    const ok = await confirm({
      title: dict.chat.msgActionsDelete,
      body: dict.chat.msgActionsDeleteConfirm,
      confirmLabel: dict.chat.msgActionsDelete,
      cancelLabel: dict.chat.discardCurrentConfirmCancel,
      danger: true,
    });
    if (!ok) return;
    await onDelete();
  }

  return (
    // modal={false} —— 默认 modal=true 时 Radix 会往 body 上加
    // pointer-events:none + RemoveScroll，跟 confirm Dialog 串行起来在
    // 1.1.x 上偶发漏还原（用户报"删一条之后整页失活,需要刷新"）。下拉
    // 菜单本来就不需要 body 锁，关掉最干净。
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={dict.chat.msgActionsTriggerAria}
          id="nj_message_actions_btn"
          className="nj_message_actions_btn inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-all hover:bg-surface-glass hover:text-text-primary"
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
          align="start"
          id="nj_message_actions_box"
          className="nj_message_actions_box z-[80] flex items-center gap-[var(--space-xs)] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-xs)] shadow-(--shadow-overlay) focus:outline-none"
        >
          {onDelete && (
            <DropdownMenu.Item
              id="nj_message_actions_delete"
              className="nj_message_actions_delete flex cursor-pointer items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-semantic-error outline-none transition-colors data-[highlighted]:bg-semantic-error/10"
              onSelect={() => {
                // 不 preventDefault —— 让 Radix 同步关菜单。再用 setTimeout
                // 把 confirm 对话框推到下一 tick，确保 DropdownMenu Portal
                // 完全卸载后才挂 Dialog；否则两个 portal 叠加 + 删除后触发
                // 节点卸载，body[pointer-events:none] 不被恢复，整页失活
                // 直到刷新（用户报 bug 的"删一条之后下一条删不动"）。
                setTimeout(handleDelete, 0);
              }}
            >
              <DeleteIcon width={13} height={13} strokeWidth={1.5} />
              {dict.chat.msgActionsDelete}
            </DropdownMenu.Item>
          )}
          {!onDelete && deleteDisabledReason && (
            <DropdownMenu.Item
              disabled
              id="nj_message_actions_delete"
              className="nj_message_actions_delete flex cursor-not-allowed items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-muted opacity-60 outline-none"
              title={deleteDisabledReason}
              onSelect={(e) => e.preventDefault()}
            >
              <DeleteIcon width={13} height={13} strokeWidth={1.5} />
              {dict.chat.msgActionsDelete}
              <span className="text-[10px] text-text-muted">
                · {deleteDisabledReason}
              </span>
            </DropdownMenu.Item>
          )}
          {onContinue && (
            <DropdownMenu.Item
              id="nj_message_actions_continue"
              className="nj_message_actions_continue flex cursor-pointer items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
              onSelect={() => onContinue()}
            >
              <ContinueIcon width={13} height={13} strokeWidth={1.5} />
              {dict.chat.msgActionsContinue}
            </DropdownMenu.Item>
          )}
          {onEdit && (
            <DropdownMenu.Item
              id="nj_message_actions_edit"
              className="nj_message_actions_edit flex cursor-pointer items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
              onSelect={() => onEdit()}
            >
              <EditIcon width={13} height={13} strokeWidth={1.5} />
              {dict.chat.msgActionsEdit}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            id="nj_message_actions_copy"
            className="nj_message_actions_copy flex cursor-pointer items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary outline-none transition-colors data-[highlighted]:bg-accent-primary/10 data-[highlighted]:text-text-primary"
            onSelect={() => {
              // 不 preventDefault —— 让 Radix 关菜单、释放 portal 焦点陷阱；
              // navigator.clipboard.writeText 必须在用户激活态下同步发起，
              // 否则 Safari 会静默忽略写入。fire-and-forget 即可。
              void onCopy();
            }}
          >
            <CopyIcon width={13} height={13} strokeWidth={1.5} />
            {dict.chat.msgActionsCopy}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
