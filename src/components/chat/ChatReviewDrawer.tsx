"use client";

import { Undo2 as RewindIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";

/** 一个 fork 节点 = 你说过的一句话 + 其后那条 AI 回应的纯文本预览。
 *  index = 该用户消息在 ChatRoom messages 数组里的下标(= forkAtMessageAction
 *  的 keepCount)。 */
export interface ReviewNode {
  index: number;
  userText: string;
  replyPreview: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  nodes: ReviewNode[];
  /** 点「回到这里重说」→ 以该节点的 index 作为 keepCount 发起 fork。 */
  onFork: (keepCount: number) => void;
}

/**
 * 对话回顾抽屉 —— 从右滑入，列出你在本对话里说过的每一句话作为 fork 节点。
 * 点任意节点的「回到这里重说」即从那句之前截断(软归档),重新演绎。
 *
 * 形态镜像 ChatSessionsDrawer(portal / backdrop / ESC / 锁滚动 / translate-x),
 * 但从右侧入,且不限 md(回顾是核心操作,各尺寸都给)。selector 契约:
 *   #nj_review_drawer        抽屉面板
 *   .nj_review_node          每个回顾节点
 *   .nj_review_node_fork_btn 「回到这里重说」按钮
 *
 * 设计契约: 抽屉/面板保持低装饰密度。空态走普通文案。
 */
export function ChatReviewDrawer({ open, onClose, nodes, onFork }: Props) {
  const { dict } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  const body = (
    <div
      className="fixed inset-0 z-50"
      aria-hidden={!open}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <button
        type="button"
        aria-label={dict.chat.reviewClose}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-[var(--dur-short)] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        id="nj_review_drawer"
        role="dialog"
        aria-modal="true"
        aria-label={dict.chat.reviewTitle}
        className={`absolute inset-y-0 right-0 flex w-[min(420px,90vw)] flex-col border-l border-border-subtle bg-bg-elevated transition-transform duration-[var(--dur-medium)] ${
          open
            ? "translate-x-0 ease-[var(--ease-enter)]"
            : "translate-x-full ease-[var(--ease-exit)]"
        }`}
      >
        <header className="flex shrink-0 flex-col gap-[var(--space-xs)] border-b border-border-subtle px-[var(--space-lg)] py-[var(--space-md)]">
          <div className="flex items-center justify-between gap-[var(--space-sm)]">
            <h2 className="font-display-zh text-xl text-text-primary">
              {dict.chat.reviewTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {dict.chat.reviewClose}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            {dict.chat.reviewSubtitle}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-[var(--space-lg)] py-[var(--space-md)]">
          {nodes.length === 0 ? (
            <p className="py-[var(--space-xl)] text-center text-sm text-text-muted">
              {dict.chat.reviewEmpty}
            </p>
          ) : (
            <ol className="flex flex-col gap-[var(--space-md)]">
              {nodes.map((node) => (
                <li
                  key={node.index}
                  className="nj_review_node flex flex-col gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]"
                >
                  <p className="text-sm leading-relaxed text-text-primary">
                    {node.userText}
                  </p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-text-muted">
                    {node.replyPreview
                      ? `${dict.chat.reviewReplyPrefix}${node.replyPreview}`
                      : dict.chat.reviewNoReply}
                  </p>
                  <button
                    type="button"
                    onClick={() => onFork(node.index)}
                    className="nj_review_node_fork_btn inline-flex items-center gap-[var(--space-xs)] self-start rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:border-accent-primary hover:text-accent-primary"
                  >
                    <RewindIcon
                      width={13}
                      height={13}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                    {dict.chat.reviewForkBtn}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
