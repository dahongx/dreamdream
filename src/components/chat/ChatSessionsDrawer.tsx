"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChatSidebarContent } from "@/components/chat/ChatSidebarContent";
import { useI18n } from "@/i18n/client";
import type { RecentSessionListItem } from "@/lib/sessions/queries";

interface Props {
  open: boolean;
  onClose: () => void;
  sessions: RecentSessionListItem[];
  activeCharacterId: string;
  titleText: string;
  emptyText: string;
  unavailableText: string;
}

/**
 * 手机端会话抽屉 —— 从左滑入，宽 min(320px, 85vw)。
 *
 * - backdrop 点击 / ESC 关闭
 * - 列表内任一行被点都自动 onClose（navigate 后立刻收抽屉，不挂在屏上）
 * - DOM 始终挂在那里（不 unmount），靠 translate-x + visibility 切换；这样
 *   transition 出场动画完整，scroll position 在多次开关间保留
 * - `md:hidden` —— 桌面用 ChatSidebar
 */
export function ChatSessionsDrawer({
  open,
  onClose,
  sessions,
  activeCharacterId,
  titleText,
  emptyText,
  unavailableText,
}: Props) {
  const { dict } = useI18n();
  // SSR 期间没有 document，hydration 之前不 mount portal。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 抽屉打开时锁背景滚动
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
      className="fixed inset-0 z-50 md:hidden"
      aria-hidden={!open}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label={dict.chat.sidebarClose}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-[var(--dur-short)] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute inset-y-0 left-0 flex w-[min(320px,85vw)] flex-col border-r border-border-subtle bg-bg-elevated transition-transform duration-[var(--dur-medium)] ${
          open
            ? "translate-x-0 ease-[var(--ease-enter)]"
            : "-translate-x-full ease-[var(--ease-exit)]"
        }`}
      >
        <ChatSidebarContent
          sessions={sessions}
          activeCharacterId={activeCharacterId}
          titleText={titleText}
          emptyText={emptyText}
          unavailableText={unavailableText}
          onItemClick={onClose}
        />
      </div>
    </div>
  );

  // Portal 到 body —— 否则 drawer 被 <main> 的 stacking context 锁住，
  // Shell topbar (z-10) 会画在 drawer (z-50 但嵌在 main 的 z-3 context 里) 之上。
  return createPortal(body, document.body);
}
