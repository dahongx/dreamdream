"use client";

import type { ReactNode, RefObject } from "react";
import sourceStyles from "./source-stage.module.css";

/**
 * 聊天页布局原语（pure layout）。
 *
 * 提取自 ChatRoom，让 chat 生产页 / pack studio preview / character form
 * sandbox 共用同一份「立绘 + overlay + 640px 内容列 + header + input」结构，
 * 保证三处视觉像素级对齐。所有 nj_* 结构 selector 挂在这里。
 *
 * 视觉契约见 docs/contracts/chat-render-spec.md §2.1 §2.2 §2.7。
 *
 * caller 把 header / messages / input 三个 slot 当 ReactNode 注入，
 * ChatStage 不管内部交互（onSubmit / debug toggle / 流式 streaming 等都由
 * caller 自己实现）。input slot 可以是 `<form>`、disabled 占位、null。
 */
interface Props {
  /** Verified imported source provenance; never inferred from character name. */
  sourcePresentation?: boolean;
  /** 立绘 URL（caller 决定 cover / avatar / mock 优先级）。null 时立绘 div
   *  仍然存在，仅没有 backgroundImage —— 保留供 creator CSS 注入图片。 */
  stageBg: string | null;
  /** Messages scroll container 的 ref（caller 用来自动滚到底等）。 */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Header 内容：返回按钮 / 头像 / 标题 / 右侧 actions 等。 */
  header?: ReactNode;
  /** 消息列内容。caller 自行 map render。 */
  messages: ReactNode;
  /** 输入区。caller 自己包 form / 设置 disabled / 接 onSubmit。 */
  input?: ReactNode;
  /** 悬浮件（灵动岛）。挂在 #nj_chat_app 下的悬浮层里，浮在消息流之上、不随
   *  消息滚动。caller 传入已包好 FloatingLayer + FloatingSlot 的节点。 */
  floating?: ReactNode;
  /** 立绘亮度 0-100,作用到 #nj_background_image 的 filter brightness。
   *  默认 100 = 原样,0 = 全黑。caller 一般从 localStorage 还原。 */
  brightness?: number;
  /** 立绘清晰度 0-100,反向映射到 filter blur:100 = 0px(锐利),
   *  0 = MAX_STAGE_BLUR_PX 模糊。默认 100。 */
  clarity?: number;
}

/** 清晰度 0% 时对应的最大模糊半径(px)。12px 在 640px 立绘上
 *  足以认出轮廓但失去细节,跟参考稿里的「失焦」感觉接近。 */
const MAX_STAGE_BLUR_PX = 12;

export function ChatStage({
  sourcePresentation = false,
  stageBg,
  scrollRef,
  header,
  messages,
  input,
  floating,
  brightness = 100,
  clarity = 100,
}: Props) {
  const blurPx = ((100 - clarity) / 100) * MAX_STAGE_BLUR_PX;
  const filterStr = `brightness(${brightness}%) blur(${blurPx}px)`;
  return (
    <section
      id="nj_chat_app"
      data-source-presentation={sourcePresentation ? "mufy" : undefined}
      className={`relative flex min-w-0 flex-1 flex-col overflow-hidden${sourcePresentation ? ` ${sourceStyles.sourceStage}` : ""}`}
    >
      {/* Stage layer 1 — 立绘，居中宽 640px，mask 左右收边渐变。
          桌面 100px 渐变效果好；手机 100px 占屏宽 1/4 太激进，clamp 到 8% / 60px。
          brightness + blur 由 header 上的 StageAdjustmentMenu 控制,
          没设值时(默认 100/100)是 identity transform。 */}
      <div
        id="nj_background_image"
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-full max-w-[640px] -translate-x-1/2"
        style={
          stageBg
            ? {
                backgroundImage: `url('${stageBg.replace(/'/g, "%27")}')`,
                backgroundPosition: "center top",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                filter: filterStr,
                WebkitMaskImage:
                  "linear-gradient(to right, transparent, black clamp(24px, 8%, 100px), black calc(100% - clamp(24px, 8%, 100px)), transparent)",
                maskImage:
                  "linear-gradient(to right, transparent, black clamp(24px, 8%, 100px), black calc(100% - clamp(24px, 8%, 100px)), transparent)",
              }
            : { filter: filterStr }
        }
      />
      {/* Stage layer 2 — overlay */}
      <div
        id="nj_background_overlay"
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "var(--nj-chat-overlay, color-mix(in oklch, var(--bg-base), transparent 40%))",
        }}
      />

      {header && (
        <header
          id="nj_chat_header"
          className="sticky top-0 z-40 flex items-center gap-[var(--space-sm)] border-b border-border-subtle bg-bg-base/80 px-[var(--space-md)] py-[var(--space-sm)] backdrop-blur-md before:pointer-events-none after:pointer-events-none md:gap-[var(--space-md)] md:px-[var(--space-xl)] md:py-[var(--space-md)]"
        >
          {header}
        </header>
      )}

      {/* overflow-anchor: none —— 浏览器默认 scroll-anchoring 在 DOM 大幅重构
          (流式结束瞬间 tail span → markdown、底部长出 ◇◇◇ + 菜单 + DebugPanel)
          时会重挑锚点,常常把视口扯到前几轮消息。滚动跟随由 stickToBottomRef 全权
          接管,把浏览器自动锚定关掉才能真正做到「用户滑到哪就停在哪」。 */}
      <div
        id="nj_chat_messages"
        ref={scrollRef}
        className="relative z-20 flex-1 overflow-y-auto px-[var(--space-md)] py-[var(--space-lg)] md:px-[var(--space-xl)]"
        style={{ overflowAnchor: "none" }}
      >
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-[var(--space-lg)]">
          {messages}
        </div>
      </div>

      {input}

      {/* 悬浮层 —— 挂在 relative 根 #nj_chat_app 下、消息流之上，absolute 定位
          脱离滚动流。灵动岛的 iframe 由 FloatingSlot 钉在这里的一角。 */}
      {floating}
    </section>
  );
}
