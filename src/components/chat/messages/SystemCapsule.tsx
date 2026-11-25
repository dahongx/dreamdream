import type { PropsWithChildren } from "react";

/**
 * <system> / <sys> — 画外音胶囊（时间 / 地点 / 天气 / 场景切换）。
 * 居中 max-440px 玻璃质感 + 极淡金边。
 * 视觉契约见 docs/contracts/chat-render-spec.md §3.4
 */
export function SystemCapsule({ children }: PropsWithChildren) {
  return <div className="nj_message_system">{children}</div>;
}
