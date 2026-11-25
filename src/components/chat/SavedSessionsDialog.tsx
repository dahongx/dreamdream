"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import {
  deleteSavedSessionAction,
  listSavedSessionsAction,
  renameSessionAction,
} from "@/lib/sessions/actions";
import type { SavedSessionListItem } from "@/lib/sessions/queries";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  characterId: string;
  characterName: string;
}

/**
 * 历史保存对话弹窗。打开时 fetch saved sessions(server action),展示列表
 * 并支持 inline 重命名 / 删除 / 点击进入(进入后通过 ?session=<id> 加载,
 * 关闭弹窗)。
 *
 * 视觉约束(CLAUDE.md):
 *   - 标题用 display-zh(Noto Serif SC)
 *   - 暗紫黑底,scanline 是全局背景的事,弹窗不重复挂
 */
export function SavedSessionsDialog({
  open,
  onOpenChange,
  characterId,
  characterName,
}: Props) {
  const { dict, locale } = useI18n();
  const { confirm } = useDialog();
  const [items, setItems] = useState<SavedSessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSavedSessionsAction(characterId);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (open) {
      void refresh();
    } else {
      setRenamingId(null);
      setRenameValue("");
    }
  }, [open, refresh]);

  function openSession(id: string) {
    onOpenChange(false);
    // 同 ChatHeaderMenu:同 path / 同 query-key 的 router.push 不会触发 RSC
    // 重新 fetch (Next 16 client router cache),改用 location.assign 强刷
    // 让 chat page 重新走 loadSessionById 路径。
    window.location.assign(`/chat/${characterId}?session=${id}`);
  }

  function beginRename(item: SavedSessionListItem) {
    setRenamingId(item.id);
    setRenameValue(item.title ?? "");
  }

  async function commitRename() {
    const id = renamingId;
    if (!id) return;
    const value = renameValue.trim();
    if (!value) {
      setRenamingId(null);
      return;
    }
    const res = await renameSessionAction(id, value, characterId);
    if (res.ok) {
      setItems((xs) =>
        xs.map((x) => (x.id === id ? { ...x, title: value } : x)),
      );
    }
    setRenamingId(null);
  }

  async function handleDelete(item: SavedSessionListItem) {
    const ok = await confirm({
      body: dict.chat.savedItemDeleteConfirm,
      danger: true,
    });
    if (!ok) return;
    const res = await deleteSavedSessionAction(item.id, characterId);
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.id !== item.id));
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-bg-base/85 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          id="nj_saved_sessions_dialog"
          className="fixed left-1/2 top-1/2 z-[101] flex max-h-[85vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-lg)] shadow-[0_30px_90px_rgba(0,0,0,0.5)] focus:outline-none"
        >
          <div className="flex items-start justify-between gap-[var(--space-md)]">
            <div className="min-w-0">
              <Dialog.Title className="font-display-zh text-xl text-text-primary">
                {dict.chat.savedDialogTitle}
              </Dialog.Title>
              <Dialog.Description className="mt-[var(--space-xs)] truncate font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
                {dict.chat.savedDialogSubtitleFmt
                  .replace("{name}", characterName)
                  .replace("{count}", String(items.length))}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={dict.chat.savedDialogClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-bg-base hover:text-text-primary"
            >
              <X width={16} height={16} strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div
            id="nj_saved_sessions_list"
            className="mt-[var(--space-md)] flex min-h-0 flex-1 flex-col gap-[var(--space-xs)] overflow-y-auto"
          >
            {loading ? (
              <div className="py-[var(--space-xl)] text-center font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
              </div>
            ) : items.length === 0 ? (
              <div className="py-[var(--space-xl)] text-center font-body-zh text-sm text-text-muted">
                {dict.chat.savedEmpty}
              </div>
            ) : (
              items.map((item) => (
                <SavedSessionRow
                  key={item.id}
                  item={item}
                  renaming={renamingId === item.id}
                  renameValue={renameValue}
                  onRenameValueChange={setRenameValue}
                  onBeginRename={() => beginRename(item)}
                  onCommitRename={commitRename}
                  onCancelRename={() => setRenamingId(null)}
                  onOpen={() => openSession(item.id)}
                  onDelete={() => handleDelete(item)}
                  fallbackTitle={dict.chat.autoTitleFallback}
                  messagesFmt={dict.chat.savedItemMessagesFmt}
                  savedAtFmt={dict.chat.savedItemSavedAtFmt}
                  renamePlaceholder={dict.chat.savedItemRenamePlaceholder}
                  renameSaveLabel={dict.chat.savedItemRenameSave}
                  renameCancelLabel={dict.chat.savedItemRenameCancel}
                  renameAria={dict.chat.savedItemRename}
                  deleteAria={dict.chat.savedItemDelete}
                  openAria={dict.chat.savedItemOpen}
                  locale={locale}
                />
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface RowProps {
  item: SavedSessionListItem;
  renaming: boolean;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onBeginRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpen: () => void;
  onDelete: () => void;
  fallbackTitle: string;
  messagesFmt: string;
  savedAtFmt: string;
  renamePlaceholder: string;
  renameSaveLabel: string;
  renameCancelLabel: string;
  renameAria: string;
  deleteAria: string;
  openAria: string;
  locale: Locale;
}

function SavedSessionRow({
  item,
  renaming,
  renameValue,
  onRenameValueChange,
  onBeginRename,
  onCommitRename,
  onCancelRename,
  onOpen,
  onDelete,
  fallbackTitle,
  messagesFmt,
  savedAtFmt,
  renamePlaceholder,
  renameSaveLabel,
  renameCancelLabel,
  renameAria,
  deleteAria,
  openAria,
  locale,
}: RowProps) {
  const title = item.title?.trim() || fallbackTitle;
  const savedDate = new Date(item.savedAt);
  const savedLabel = savedAtFmt.replace(
    "{time}",
    formatRelative(savedDate, locale),
  );
  const msgLabel = messagesFmt.replace("{count}", String(item.messageCount));

  return (
    <div
      className="nj_saved_session_item group flex items-start gap-[var(--space-sm)] rounded-[var(--radius-sm)] border border-border-subtle bg-bg-base/40 px-[var(--space-md)] py-[var(--space-sm)] transition-colors hover:border-border-strong"
      data-session-id={item.id}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-2xs)]">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCommitRename();
            }}
            className="flex items-center gap-[var(--space-xs)]"
          >
            <input
              ref={(el) => el?.focus()}
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelRename();
              }}
              placeholder={renamePlaceholder}
              maxLength={256}
              className="flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] font-body-zh text-sm text-text-primary outline-none focus:border-accent-primary"
            />
            <button
              type="submit"
              className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-sm)] py-[var(--space-xs)] text-xs font-semibold text-text-on-accent transition-opacity hover:opacity-90"
            >
              {renameSaveLabel}
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {renameCancelLabel}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            aria-label={openAria}
            className="nj_saved_session_title text-left font-display-zh text-base text-text-primary transition-colors hover:text-accent-primary"
          >
            {title}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-[var(--space-sm)] font-mono text-xs text-text-muted">
          <span>{savedLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{msgLabel}</span>
        </div>
      </div>
      {!renaming && (
        <div className="nj_saved_session_actions flex shrink-0 items-center gap-[var(--space-2xs)] transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          <button
            type="button"
            aria-label={renameAria}
            onClick={onBeginRename}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-bg-base hover:text-text-primary"
          >
            <Pencil
              width={14}
              height={14}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            aria-label={deleteAria}
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-semantic-error/15 hover:text-semantic-error"
          >
            <Trash2
              width={14}
              height={14}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 简易相对时间格式化(不引日期库)。最近 7 天用 Intl.RelativeTimeFormat，
 * 更早走当前语言的 short date。
 */
function formatRelative(d: Date, locale: Locale): string {
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diff < min) return relative.format(0, "second");
  if (diff < hr) return relative.format(-Math.floor(diff / min), "minute");
  if (diff < day) return relative.format(-Math.floor(diff / hr), "hour");
  if (diff < 7 * day) return relative.format(-Math.floor(diff / day), "day");
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
