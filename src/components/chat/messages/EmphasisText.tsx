import type { PropsWithChildren } from "react";

/**
 * **xxx** (markdown bold) → inline 强调短语。
 * 默认皮肤：纯白加粗（06-21 决议剥掉渐变彩字）；仅 <details> 状态栏内
 * 恢复渐变（globals.css 有专门规则）。
 * 视觉契约见 docs/contracts/chat-render-spec.md §3.6
 */
export function EmphasisText({ children }: PropsWithChildren) {
  return <strong className="nj_emphasis_text">{children}</strong>;
}
