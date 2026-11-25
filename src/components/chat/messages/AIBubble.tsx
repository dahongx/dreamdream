/**
 * <message> / <mes> — AI 角色台词气泡。
 *
 * 不挂角色卡头像 —— 整条 LLM 回复由多个语义 segment 组成，每段独立呼吸，
 * 在台词旁重复贴角色头像会制造"角色对一段纯叙述说话"的语义噪声，且与
 * 立绘 / 舞台层信息重复。message 段只渲染气泡本体。
 *
 * 视觉契约见 docs/contracts/chat-render-spec.md §2.4 / §3.1 / §2.5
 */

import type { PropsWithChildren } from "react";

export function AIBubble({ children }: PropsWithChildren) {
  return <div className="nj_ai_message_bubble">{children}</div>;
}
