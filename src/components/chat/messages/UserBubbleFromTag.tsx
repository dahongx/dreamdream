"use client";

import { createContext, type PropsWithChildren, useContext } from "react";

/**
 * <user> / <usr> — 玩家视角台词气泡。
 *
 * 出现场景：
 *   1. 作者写开场白时把玩家的预设台词包进 <user>（典型："谢谢老公"这种
 *      玩家身份的初始反应），渲染时就走 user 气泡 + 玩家头像，不会被
 *      错认成角色发言。
 *   2. LLM 偶尔会"代入"地说一句玩家视角的话（"我说：xxx"），如果它学会
 *      用 <user> 包，host 同样路由到这里 —— 避免出现"玩家头像挂在角色
 *      气泡上"或"角色头像挂在玩家气泡上"。
 *
 * 与 MessageBubble（assistant message 外层 / user message 整条）的区别：
 *   - MessageBubble 处理 messages 表里 role=user/assistant 的整条消息
 *   - 本组件处理 assistant 消息体内嵌的 <user> 段
 *   - 都共用 .nj_user_message_bubble class（默认皮肤一致），但本组件
 *     额外包了头像 row（chat-render-spec.md §3.2 没要求 inline 头像，
 *     但既然要跟 AIBubble 视觉对仗这里也加，保证读者一眼看出"对面在说"
 *     和"我自己之前说过的"）
 *
 * 头像通过 Context 注入而不是 props —— react-markdown 的 components map
 * 拿不到外层 props。MessageBubble 在 MessageRenderer 之上挂
 * UserAvatarContext.Provider。其他 MessageRenderer 调用点（pack studio /
 * regex form 测试面板等）不挂 provider，UserBubbleFromTag 会退到无头像
 * 形态，保持向后兼容。
 *
 * 视觉契约见 docs/contracts/chat-render-spec.md §2.4 / §3.2
 */

export interface UserAvatar {
  src: string | null;
  fallback: string;
  alt: string;
}

export const UserAvatarContext = createContext<UserAvatar | null>(null);

export function UserBubbleFromTag({ children }: PropsWithChildren) {
  const avatar = useContext(UserAvatarContext);

  if (!avatar) {
    return <div className="nj_user_message_bubble">{children}</div>;
  }

  return (
    <div className="nj_user_message_bubble_row flex items-end justify-end gap-[var(--space-sm)]">
      <span className="nj_user_message_bubble w-fit rounded-[var(--radius-md)] rounded-br-[var(--radius-sm)] bg-accent-primary/15 px-[var(--space-md)] py-[var(--space-sm)] text-base leading-relaxed text-text-primary">
        {children}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid">
        {avatar.src ? (
          // biome-ignore lint/performance/noImgElement: external avatar URLs, no remote-host pattern set yet
          <img
            src={avatar.src}
            alt={avatar.alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-display-zh text-base text-text-muted">
            {avatar.fallback}
          </span>
        )}
      </span>
    </div>
  );
}
