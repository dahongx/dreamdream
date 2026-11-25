"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 悬浮层容器 —— 聊天页 / 角色详情页共用。
 *
 * 存在意义（见 docs/exec-plans/active/floating-widgets.md）：从外部搬来的
 * 「灵动岛」被创作者塞进「开场组件」的 iframe 里，组件内部写 `position:fixed`，
 * 但 iframe 在宿主页是 `#nj_chat_messages`（overflow-y-auto）滚动流里的普通块级
 * 元素，于是整框跟着消息滚、浮不起来。
 *
 * 定位策略（2026-07-09 与用户对齐）：跟外部平台一致 —— 悬浮件浮在**整个浏览器
 * 视口**顶端，不是聊天区/演绎室某个 section 的顶端（浮在中间 section 顶端很怪）。
 * 实现上 **Portal 到 document.body** + `position:fixed`：
 *   - Portal 到 body 才能保证 `fixed` 相对视口 —— 聊天页 `#nj_background_image`
 *     带 `filter`，任何 `transform`/`filter`/`will-change` 祖先都会把后代 fixed
 *     的包含块从视口改成该祖先，灵动岛就又被困住了。挂到 body 彻底规避。
 *   - `inset-0` 铺满视口、`pointer-events:none`（空白区穿透，不挡页面任何交互），
 *     `z-40`（浮在内容之上；低于 Radix Dialog 的 z-50，不盖弹窗）。
 *   - 悬浮件的 iframe 由 FloatingSlot 用 absolute 定位钉在视口一角（默认顶部居中、
 *     避开顶部导航），各自 `pointer-events:auto` 收回自己那块点击。
 *
 * SSR：Portal 需要 document，用 mounted 门控确保只在客户端渲染，避免 hydration
 * 不匹配。
 *
 * selector 契约：`#nj_floating_layer`。
 */
interface Props {
  children: ReactNode;
}

export function FloatingLayer({ children }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // 零尺寸容器：不铺满视口（铺满的 fixed 层在移动端会搅乱 body 滚动上下文、
  // 让 fixed 的底部 tabbar 表现异常）。悬浮件本身各自 `position:fixed` 定位到
  // 视口，容器只作 Portal 落点，不占空间、不拦事件。
  return createPortal(
    <div id="nj_floating_layer" className="nj_floating_layer">
      {children}
    </div>,
    document.body,
  );
}
