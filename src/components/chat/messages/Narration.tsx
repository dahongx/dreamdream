import type { PropsWithChildren } from "react";

/**
 * <narration> / <nar> — 第三人称叙述。
 * 默认皮肤：无气泡、muted 色、无斜体无渐变（06-21 决议：读小说叙事感，
 * 原「紫→暖白→金」渐变已废弃，creator 可在 global_css 恢复）。
 * 视觉契约见 docs/contracts/chat-render-spec.md §3.3
 */
export function Narration({ children }: PropsWithChildren) {
  return <div className="nj_message_narration">{children}</div>;
}
