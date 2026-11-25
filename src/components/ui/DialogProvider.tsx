"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/i18n/client";

/**
 * Dearm 风格的 confirm / alert 弹窗。替换原生 window.confirm / window.alert,
 * 让所有交互式询问统一走暗紫黑底 + 衬线标题 + 紫色 / 红色按钮的设计语言。
 *
 * 用法:
 *   const { confirm, alert } = useDialog();
 *   if (!(await confirm({ body: "确定要删除?" }))) return;
 *   await alert({ body: "操作完成" });
 *
 * 风格约束:
 *   - 标题用 display-zh,正文用 body-zh
 *   - danger 走 semantic-error,普通确认走 accent-primary
 */

interface ConfirmOptions {
  title?: ReactNode;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true 时确认按钮渲染为红色危险样式 */
  danger?: boolean;
}

interface AlertOptions {
  title?: ReactNode;
  body: ReactNode;
  okLabel?: string;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

type PendingState =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  const { dict } = useI18n();
  const [pending, setPending] = useState<PendingState | null>(null);
  // Pending refs so a second call before user dismissed the first doesn't
  // strand the previous promise. Resolve the old one as "cancel" before
  // replacing.
  const pendingRef = useRef<PendingState | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const open = useCallback((next: PendingState) => {
    const prev = pendingRef.current;
    if (prev) {
      if (prev.kind === "confirm") prev.resolve(false);
      else prev.resolve();
    }
    setPending(next);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        open({ kind: "confirm", opts, resolve });
      }),
    [open],
  );

  const alert = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        open({ kind: "alert", opts, resolve });
      }),
    [open],
  );

  const value = useMemo<DialogContextValue>(
    () => ({ confirm, alert }),
    [confirm, alert],
  );

  function close(result: boolean) {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(result);
    else pending.resolve();
    setPending(null);
    // Radix Dialog 1.1.x 的 DismissableLayer 偶发漏还原 body[pointer-events:none]
    // —— 用户报"删一条 AI 消息后整页失活，必须刷新才能再删"。下一帧兜底
    // 把 body 还原一次：保留 Radix 自己的清理路径，只在确实卡住时纠偏。
    requestAnimationFrame(() => {
      if (document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
    });
  }

  const isOpen = pending !== null;
  const isConfirm = pending?.kind === "confirm";
  const opts = pending?.opts;
  const danger = isConfirm && (pending.opts as ConfirmOptions).danger === true;

  const confirmLabel = isConfirm
    ? ((pending.opts as ConfirmOptions).confirmLabel ?? dict.dialog.confirm)
    : ((pending?.opts as AlertOptions | undefined)?.okLabel ?? dict.dialog.ok);
  const cancelLabel =
    (isConfirm && (pending.opts as ConfirmOptions).cancelLabel) ||
    dict.dialog.cancel;

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Dialog.Root
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) close(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-bg-base/85 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[101] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-lg)] shadow-[0_30px_90px_rgba(0,0,0,0.5)] focus:outline-none"
            onEscapeKeyDown={() => close(false)}
          >
            {opts?.title && (
              <Dialog.Title className="font-display-zh text-xl text-text-primary">
                {opts.title}
              </Dialog.Title>
            )}
            {!opts?.title && (
              <Dialog.Title className="sr-only">
                {isConfirm ? dict.dialog.confirm : dict.dialog.ok}
              </Dialog.Title>
            )}
            <Dialog.Description asChild>
              <div
                className={`${opts?.title ? "mt-[var(--space-sm)]" : ""} font-body-zh text-base leading-relaxed text-text-secondary`}
              >
                {opts?.body}
              </div>
            </Dialog.Description>
            <div className="mt-[var(--space-lg)] flex justify-end gap-[var(--space-sm)]">
              {isConfirm && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => close(true)}
                className={
                  danger
                    ? "rounded-[var(--radius-sm)] bg-semantic-error px-[var(--space-md)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-opacity hover:opacity-90"
                    : "rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
                }
              >
                {confirmLabel}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used inside <DialogProvider>");
  }
  return ctx;
}
