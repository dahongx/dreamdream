"use client";

import { type PropsWithChildren, useState } from "react";
import { useI18n } from "@/i18n/client";

/**
 * <think> — 角色第一人称内心独白。
 * 默认收起，点击后展开思考正文；与外部角色平台的交互习惯一致。
 * 视觉契约见 docs/contracts/chat-render-spec.md §3.5
 */
export function ThinkBlock({ children }: PropsWithChildren) {
  const [collapsed, setCollapsed] = useState(true);
  const { dict } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      data-collapsed={collapsed ? "true" : "false"}
      className="nj_message_think w-full text-left"
      aria-expanded={!collapsed}
    >
      {collapsed ? (
        <span className="opacity-60">{dict.chat.thinkCollapsed}</span>
      ) : (
        children
      )}
    </button>
  );
}
