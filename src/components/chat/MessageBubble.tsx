"use client";
import type {HostSendHandler} from "@/lib/opening/host-composer-send-candidate";

import type { UIMessage } from "ai";
import { Undo2 as RewindIcon } from "lucide-react";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { withMufySharedComponentStyle } from "@/lib/import/mufy-shared-component-style";
import { MufyNativeSourceContext, MufySharedComponentStyleContext } from "./mufy-shared-component-context";
import { MufyReplySidebar } from "./MufyReplySidebar";
import {
  type HostCharacterMeta,
  type HostHistoryEntry,
  RegexIframe,
} from "@/components/regex/RegexIframe";
import { useToast } from "@/components/ui/ToastProvider";
import { useI18n } from "@/i18n/client";
import { stripEmbeddedUserTurns } from "@/lib/ai/embedded-user-turns";
import { truncateRepeatedStateCycles } from "@/lib/ai/repeated-state-cycles";
import type { RegexRule } from "@/lib/db/schema";
import { hasMufyRenderedOpening } from "@/lib/import/mufy-native-table";
import { applyRegexToSegments, type Segment } from "@/lib/regex/segments";
import { findSafeBoundary, visibleStreamTail } from "@/lib/regex/stream";
import { copyTextToClipboard } from "@/lib/util/clipboard";
import { firstChar } from "@/lib/util/first-char";
import { MessageActionsMenu } from "./MessageActionsMenu";
import { MessageRenderer } from "./MessageRenderer";
import { UserAvatarContext } from "./messages/UserBubbleFromTag";
import { UserMessageActions } from "./UserMessageActions";

/**
 * Rendering pipeline for a single chat message.
 *
 * User messages → plain text bubble + 用户头像 on the right (row-level).
 *
 * Assistant messages → applyRegexToSegments. Returned segments alternate
 * between HtmlSegment (handed to MessageRenderer — sanitize + react-markdown
 * + rehype-raw + semantic tag components) and IframeSegment (mounted via
 * <RegexIframe> with the host-API bridge).
 *
 * AI 消息不挂角色卡头像 —— 整条回复由多个语义 segment 组成，台词旁重复贴
 * 角色头像会与立绘 / 舞台层信息重复，且制造"角色对一段纯叙述说话"的语义
 * 噪声。仅嵌在 assistant 消息体里的 <user> 段会挂玩家头像（见下）。
 *
 * 外层 wrapper 不挂任何气泡 chrome（无 border / 无 bg / 无 padding）—— 每个
 * 语义 segment 按自己的样式独立呼吸：narration 直接浮立绘上、message 走小气泡、
 * system 走居中胶囊。selector 契约：`nj_ai_message_bubble` 只允许出现在 AIBubble
 * 内部，外层 row 用 `nj_ai_message_row` 仅作布局。
 *
 * During streaming we trim the buffer at the last unclosed `<` so partial
 * tags don't trigger half-renders. The streaming tail is rendered as raw
 * text underneath.
 *
 * 渲染契约见 docs/contracts/chat-render-spec.md §2.3 §2.4 §2.5
 */

interface Props {
  message: UIMessage;
  rules: RegexRule[];
  isStreaming: boolean;
  /** Final-render-only HTML appended after the stored text. It is excluded
   * from copy/edit/history and exists only for localized UI annotations. */
  renderOnlySuffix?: string;
  /** 开场白（messages[0] 且 role=assistant）不显示「输出完成」结束标记 —— 它
   *  是静态注入的角色介绍，不算一次 AI 回复。 */
  isOpening?: boolean;
  /** A viewport widget has exactly one owner, never one per historical row. */
  isLatestAssistant?: boolean;
  userPrefs?: Map<string, boolean>;
  /** iframe Host API 的对话历史快照。聊天页由 ChatHistoryContext 提供实时值
   *  （此 prop 可省 —— 传数组会随流式 chunk 变引用，击穿 memo），预览场景
   *  （无 Provider）继续显式传入。 */
  history?: HostHistoryEntry[];
  character: HostCharacterMeta;
  userName: string;
  /** 当前用户头像（users.image）。null 时 BubbleAvatar 退到首字。 */
  userAvatarUrl: string | null;
  onSendMessage: HostSendHandler;
  onFillComposer?: (text: string) => void;
  /** 「回到这里重说」—— 仅用户气泡可用(fork 点只允许在用户输入上)。null /
   *  undefined 时不渲染内联控件(如 AI 气泡、或流式进行中禁用)。 */
  onFork?: (() => void) | null;
  onDelete?: (() => Promise<void>) | null;
  /** 开场白等不可单删的 AI 气泡，传入原因小字解释；其他 onDelete=null 情况
   *  仍然完全不渲染删除项。 */
  deleteDisabledReason?: string | null;
  onContinue?: (() => void) | null;
  onEditUserMessage?: ((newContent: string) => Promise<void>) | null;
  onDeleteUserMessage?: (() => Promise<void>) | null;
  onEditAssistantMessage?: ((newContent: string) => Promise<void>) | null;
}

// memo：ChatRoom 侧所有 props 都已稳定化（rules/userPrefs/characterMeta 用
// useMemo，回调用 useCallback，history 走 context）。流式期间只有正在长的
// 那条气泡 props 变化，历史气泡整棵跳过 —— 不 memo 的话每个 chunk 全列表
// 重跑 regex 分段 + markdown。
export const MessageBubble = memo(function MessageBubble({
  message,
  rules,
  isStreaming,
  renderOnlySuffix,
  isOpening = false,
  isLatestAssistant = false,
  userPrefs,
  history,
  character,
  userName,
  userAvatarUrl,
  onSendMessage,
  onFillComposer,
  onFork,
  onDelete,
  deleteDisabledReason,
  onContinue,
  onEditUserMessage,
  onDeleteUserMessage,
  onEditAssistantMessage,
}: Props) {
  const { dict } = useI18n();
  const sourceComponentStyle=useContext(MufySharedComponentStyleContext);
  const { success, error } = useToast();
  const isUser = message.role === "user";
  const nativeSource=useContext(MufyNativeSourceContext);
  const mufySourceDefaults = useMemo(() => nativeSource||hasMufyRenderedOpening(rules), [nativeSource,rules]);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const text = useMemo(
    () =>
      message.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(""),
    [message.parts],
  );
  // `<user>` is valid in creator-authored openings only. In an ordinary AI
  // reply it repeats a real message already visible above, so hide it during
  // streaming and for historical rows created before the server guard.
  const visibleText = useMemo(() => {
    if (isUser || isOpening) return text;
    return truncateRepeatedStateCycles(stripEmbeddedUserTurns(text)).text;
  }, [isUser, isOpening, text]);
  const renderText = isUser
    ? visibleText
    : `${visibleText}${renderOnlySuffix ?? ""}`;

  const { segments, tail } = useMemo(() => {
    if (isUser) return { segments: [] as Segment[], tail: "" };
    // Stream 期间用 findSafeBoundary 剥离末尾未闭合 tag(如 `<div cla`);
    // final 时 safe = text(cut=text.length,无需剥离)。两条路径合并成同一个
    // applyRegexToSegments 调用,消除 stream→final 切换时因分支差异导致的
    // rendered HTML 高度突变(2026-07-05 zouwuhe@163.com/谢寻的"内容重排"
    // 感知来源):
    //   - 以前:stream 分支只处理 safe,tail 部分显示 raw 文本;final 分支
    //     对完整 text 应用 regex,最新 AI 消息底部内容重排~939px。
    //   - 现在:stream 期间每个 XML 块 close tag 一到就 regex 渲染成 HTML
    //     组件(状态栏折叠、iframe 挂载),final 只增量挂 ◇◇◇ + Menu ≈
    //     100-200px。跳幅从一次大突变分散成 close-tag 到达时的每个小增量,
    //     用户体感近乎无跳。
    // 空 rules 场景:applyRegexToSegments 里 active=[],直接返回
    // [{ type: "html", content: raw }],等价于原 applyRegex 分支(已验证)。
    const cut = isStreaming ? findSafeBoundary(renderText) : renderText.length;
    const safe = renderText.slice(0, cut);
    // visibleStreamTail 隐藏末尾仍在流的半截 tag(`<div cla`),防"爆代码"闪。
    const tail = isStreaming ? visibleStreamTail(renderText.slice(cut)) : "";
    const { segments } = applyRegexToSegments(safe, rules, { userPrefs });
    return { segments, tail };
  }, [isUser, isStreaming, renderText, rules, userPrefs]);

  // 给嵌在 assistant 消息体里的 <user> 段挂玩家头像 / displayName。
  // chat-render-spec.md §11.7：作者开场白把玩家预设台词包进 <user> 时
  // 会走这条路径，避免被错认成角色发言。
  const userAvatarCtx = useMemo(
    () => ({
      src: userAvatarUrl,
      fallback: firstChar(userName),
      alt: userName,
    }),
    [userAvatarUrl, userName],
  );

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(visibleText);
    if (ok) {
      success(dict.chat.msgActionsCopySuccess);
    } else {
      error(dict.chat.msgActionsCopyFailed);
    }
  }, [
    visibleText,
    dict.chat.msgActionsCopySuccess,
    dict.chat.msgActionsCopyFailed,
    success,
    error,
  ]);

  const handleStartEdit = useCallback(() => {
    setEditValue(visibleText);
    setEditing(true);
  }, [visibleText]);

  const handleSaveEdit = useCallback(async () => {
    if (!onEditAssistantMessage) return;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === text) {
      setEditing(false);
      return;
    }
    try {
      await onEditAssistantMessage(trimmed);
      setEditing(false);
    } catch {
      window.alert(dict.chat.msgActionsEditFailed);
    }
  }, [onEditAssistantMessage, editValue, text, dict.chat.msgActionsEditFailed]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(visibleText);
  }, [visibleText]);

  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  if (isUser) {
    return (
      <div className="nj_user_message_row group flex items-start justify-end gap-[var(--space-sm)]">
        {onFork && (
          <button
            type="button"
            onClick={onFork}
            aria-label={dict.chat.forkInline}
            title={dict.chat.forkInline}
            className="nj_user_message_fork_btn mt-[var(--space-xs)] inline-flex shrink-0 items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-muted transition-all hover:border-border-strong hover:text-text-primary"
          >
            <RewindIcon
              width={13}
              height={13}
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span className="hidden md:inline">{dict.chat.forkInline}</span>
          </button>
        )}
        <UserMessageActions
          text={text}
          onEdit={onEditUserMessage}
          onDelete={onDeleteUserMessage}
        >
          <div className="nj_user_message_bubble w-fit rounded-[var(--radius-md)] rounded-br-[var(--radius-sm)] bg-accent-primary/15 px-[var(--space-md)] py-[var(--space-sm)] text-base leading-normal text-text-primary">
            {text || " "}
          </div>
        </UserMessageActions>
        <BubbleAvatar
          src={userAvatarUrl}
          fallback={firstChar(userName)}
          alt={userName}
        />
      </div>
    );
  }

  // AI 消息编辑模式
  if (editing) {
    return (
      <div className="group flex justify-start">
        <div className="nj_ai_message_row flex w-full min-w-0 max-w-[760px] flex-col gap-[var(--space-xs)]">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSaveEdit();
              }
              if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
            placeholder={dict.chat.msgActionsEditPlaceholder}
            rows={8}
            className="w-full resize-y rounded-[var(--radius-md)] border border-border-strong bg-surface-solid px-[var(--space-md)] py-[var(--space-sm)] text-base leading-relaxed text-text-primary outline-none focus:border-accent-primary"
          />
          <div className="flex justify-end gap-[var(--space-xs)]">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-[var(--radius-sm)] px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              {dict.chat.msgActionsEditCancel}
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="rounded-[var(--radius-sm)] bg-accent-primary/20 px-[var(--space-md)] py-[var(--space-xs)] text-xs text-accent-primary transition-colors hover:bg-accent-primary/30"
            >
              {dict.chat.msgActionsEditSave}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-start">
      <div className="nj_ai_message_row flex w-full min-w-0 max-w-[760px] flex-col gap-[var(--space-xs)] font-body-zh text-base leading-normal text-text-primary">
        {isLatestAssistant&&!isOpening&&mufySourceDefaults&&<MufyReplySidebar segments={segments} freeze={isStreaming} css={sourceComponentStyle} character={character} userName={userName} onSendMessage={onSendMessage} onFillComposer={onFillComposer} />}
        <UserAvatarContext.Provider value={userAvatarCtx}>
          {segments.map((seg, i) => {
            if (seg.type === "html") {
              return (
                <MessageRenderer
                  // biome-ignore lint/suspicious/noArrayIndexKey: segment order is stable per message
                  key={i}
                  source={seg.content}
                  mufySourceDefaults={mufySourceDefaults}
                  mufyOpeningPlayerName={isOpening ? userName : undefined}
                  mufyAvatar={character.avatarUrl && sourceComponentStyle.includes('data-mufy-public-speech-avatars') ? {src:character.avatarUrl,name:character.name}:undefined}
                />
              );
            }
            return (
              <RegexIframe
                key={`${seg.ruleId}-${i}`}
                ruleId={seg.ruleId}
                ruleName={seg.ruleName}
                srcdoc={withMufySharedComponentStyle(seg.srcdoc, sourceComponentStyle)}
                incrementalUpdates={mufySourceDefaults&&!isOpening}
                minHeight={seg.minHeight}
                captureGroups={seg.captureGroups}
                history={history}
                character={character}
                userName={userName}
                onSendMessage={onSendMessage}
                onFillComposer={onFillComposer}
              />
            );
          })}
          {tail && (
            // key 用长度: 每个新 chunk 到达时 span 重挂载, 重放 0.18s 淡入
            // (DESIGN.md Motion 签名 #2 —— 不做逐字打字机, 让"正在写"的
            // 尾部以柔和的呼吸感浮现)。类名不带 nj_ 前缀: 平台内部动效,
            // 不进 creator selector 契约。
            <span key={tail.length} className="ai-stream-tail text-text-muted">
              {tail}
            </span>
          )}
        </UserAvatarContext.Provider>
        {!isStreaming && (
          <>
            {!isOpening && (
              <div
                aria-hidden="true"
                className="nj_ai_message_end_marker flex select-none items-center justify-center gap-[var(--space-md)] font-display-zh text-sm text-text-muted"
              >
                <span>◇</span>
                <span>◇</span>
                <span>◇</span>
              </div>
            )}
            <div className="flex items-center">
              <MessageActionsMenu
                onDelete={onDelete}
                deleteDisabledReason={deleteDisabledReason}
                onContinue={onContinue}
                onEdit={onEditAssistantMessage ? handleStartEdit : null}
                onCopy={handleCopy}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

function BubbleAvatar({
  src,
  fallback,
  alt,
}: {
  src: string | null;
  fallback: string;
  alt: string;
}) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid">
      {src ? (
        // biome-ignore lint/performance/noImgElement: external avatar URLs, no remote-host pattern set yet
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="font-display-zh text-base text-text-muted">
          {fallback}
        </span>
      )}
    </span>
  );
}
