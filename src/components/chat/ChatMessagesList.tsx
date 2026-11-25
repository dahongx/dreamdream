"use client";
import type { ChatStreamErrorTaxonomy } from "@/lib/chat/chat-stream-error-taxonomy";
import type {HostSendHandler} from "@/lib/opening/host-composer-send-candidate";

import {MessageCircleMore} from 'lucide-react';
import type {BoundNoteHeader} from '@/lib/opening/public-note-header';
import { memo, useCallback, useMemo } from "react";
import { mufySidebarOwnerIndex } from "@/lib/chat/mufy-sidebar-owner";
import { collectMufySharedComponentStyle } from "@/lib/import/mufy-shared-component-style";
import { hasMufyAdaptedComponent, hasMufyRenderedOpening } from "@/lib/import/mufy-native-table";
import { MufyNativeSourceContext, MufySharedComponentStyleContext, MufyOriginalTitleFontContext } from "./mufy-shared-component-context";
import { usesMufyOriginalTitleFont, MUFY_ORIGINAL_TITLE_FONT_CSS } from "@/lib/import/mufy-original-title-font";
import { ThinkingDots } from "@/components/ai/ThinkingDots";
import { DebugPanel } from "@/components/chat/DebugPanel";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { OpeningSlot } from "@/components/chat/OpeningSlot";
import type { HostCharacterMeta } from "@/components/regex/RegexIframe";
import { useI18n } from "@/i18n/client";
import type { ChatUIMessage, DebugMeta } from "@/lib/chat/debug-meta";
import {
  safetyTruncationNoticePlacement,
  stateTruncationRenderSuffix,
} from "@/lib/chat/truncation-notice";
import type { RegexRule } from "@/lib/db/schema";
import type { OpeningComponentWithSlots } from "@/lib/opening/queries";

/**
 * 聊天页消息列（从 ChatRoom 的 messagesNode 提取）。
 *
 * 存在的唯一理由是性能隔离：ChatRoom 持有输入框 state，用户每敲一个字整个
 * ChatRoom 重渲染。消息列是 ChatRoom 里唯一随会话长度线性膨胀的子树 ——
 * 不隔离的话「打字卡」和「聊得越多越卡」互相放大。提成 memo 组件后，输入
 * 只要不改变本组件的任何 prop（ChatRoom 侧全部 useMemo/useCallback 稳定化），
 * 整棵列表在敲字时零重渲染。
 *
 * 第二层隔离在 ChatMessageRow：流式期间 messages 数组每个 chunk 变引用，
 * 列表本体必须重渲染，但除正在生成的那条外，其余行的 props 全部稳定 ——
 * memo 让历史行整棵跳过（含 regex 分段 + markdown + iframe 子树）。
 *
 * iframe Host API 需要的实时 history 不从这里过 —— 走 ChatHistoryContext
 * 的 ref 通道（见 chat-history-context.ts），否则每个 chunk 都会击穿上述
 * 两层 memo。
 */

type ChatStreamStatus = "submitted" | "streaming" | "ready" | "error";

interface RowProps {
  message: ChatUIMessage;
  index: number;
  isStreamingMsg: boolean;
  isLastAssistant: boolean;
  ownsMufySidebar: boolean;
  submitting: boolean;
  meta: DebugMeta | undefined;
  showDebug: boolean;
  showTruncationNotice: boolean;
  showStoppedNotice: boolean;
  stateTruncationSuffix: string | undefined;
  rules: RegexRule[];
  userPrefs: Map<string, boolean>;
  character: HostCharacterMeta;
  userName: string;
  userAvatarUrl: string | null;
  onSendMessage: HostSendHandler;
  onFillComposer?: (text: string) => void;
  onForkToMessage: (index: number) => void;
  onDeleteMessage: (id: string) => Promise<void>;
  onContinueMessage: (id: string) => void;
  onEditUserMessage: (id: string, content: string) => Promise<void>;
  onDeleteUserMessage: (id: string) => Promise<void>;
  onEditAssistantMessage: (id: string, content: string) => Promise<void>;
}

const ChatMessageRow = memo(function ChatMessageRow({
  message: m,
  index,
  isStreamingMsg,
  isLastAssistant,
  ownsMufySidebar,
  submitting,
  meta,
  showDebug,
  showTruncationNotice,
  showStoppedNotice,
  stateTruncationSuffix,
  rules,
  userPrefs,
  character,
  userName,
  userAvatarUrl,
  onSendMessage,
  onFillComposer,
  onForkToMessage,
  onDeleteMessage,
  onContinueMessage,
  onEditUserMessage,
  onDeleteUserMessage,
  onEditAssistantMessage,
}: RowProps) {
  const { dict } = useI18n();
  const isUser = m.role === "user";
  const isAssistant = m.role === "assistant";

  // id/index 闭包在行内收口成稳定引用，MessageBubble 的 memo 才咬得住。
  const handleFork = useCallback(
    () => onForkToMessage(index),
    [onForkToMessage, index],
  );
  const handleDelete = useCallback(
    () => onDeleteMessage(m.id),
    [onDeleteMessage, m.id],
  );
  const handleContinue = useCallback(
    () => onContinueMessage(m.id),
    [onContinueMessage, m.id],
  );
  const handleEditUser = useCallback(
    (newContent: string) => onEditUserMessage(m.id, newContent),
    [onEditUserMessage, m.id],
  );
  const handleDeleteUser = useCallback(
    () => onDeleteUserMessage(m.id),
    [onDeleteUserMessage, m.id],
  );
  const handleEditAssistant = useCallback(
    (newContent: string) => onEditAssistantMessage(m.id, newContent),
    [onEditAssistantMessage, m.id],
  );

  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      <MessageBubble
        message={m}
        rules={rules}
        isStreaming={isStreamingMsg}
        renderOnlySuffix={stateTruncationSuffix}
        isOpening={isAssistant && index === 0}
        isLatestAssistant={ownsMufySidebar}
        userPrefs={userPrefs}
        character={character}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        onSendMessage={onSendMessage}
        onFillComposer={onFillComposer}
        onFork={isUser && !submitting ? handleFork : null}
        onDelete={isAssistant && !submitting && index > 0 ? handleDelete : null}
        deleteDisabledReason={
          isAssistant && index === 0
            ? dict.chat.msgActionsDeleteDisabledOpening
            : null
        }
        onContinue={
          isAssistant && !submitting && isLastAssistant ? handleContinue : null
        }
        onEditUserMessage={isUser && !submitting ? handleEditUser : null}
        onDeleteUserMessage={isUser && !submitting ? handleDeleteUser : null}
        onEditAssistantMessage={
          isAssistant && !submitting && !isStreamingMsg
            ? handleEditAssistant
            : null
        }
      />
      {isAssistant && showTruncationNotice && (
        <p
          className="mx-[var(--space-md)] rounded-[var(--radius-sm)] border border-semantic-warning/40 bg-semantic-warning/10 px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-semantic-warning"
          role="note"
        >
          {dict.chat.truncatedBySafetyNotice}
        </p>
      )}
      {isAssistant && showStoppedNotice && (
        <output className="block px-[var(--space-md)] text-xs text-text-muted">
          {dict.chat.stoppedNotice}
        </output>
      )}
      {showDebug &&
        isAssistant &&
        (meta?.debug ? (
          <DebugPanel
            debug={meta.debug}
            model={meta.model}
            tokensIn={meta.tokensIn}
            tokensOut={meta.tokensOut}
            cacheReadTokens={meta.cacheReadTokens}
            cacheWriteTokens={meta.cacheWriteTokens}
            reasoningTokens={meta.reasoningTokens}
            costMillicents={meta.costMillicents}
            costCnyMillicents={meta.costCnyMillicents}
            latencyMs={meta.latencyMs}
          />
        ) : (
          <p className="px-[var(--space-md)] text-xs italic text-text-muted">
            {dict.chat.debugEmpty}
          </p>
        ))}
    </div>
  );
});

export interface ChatMessagesListProps {
  messages: ChatUIMessage[];
  status: ChatStreamStatus;
  continuingMessageId: string | null;
  lastAssistantIdx: number;
  submitting: boolean;
  rules: RegexRule[];
  userPrefs: Map<string, boolean>;
  characterMeta: HostCharacterMeta;
  characterName: string;
  creatorNote: string | null;
  publicNoteHeader?: BoundNoteHeader | null;
  userName: string;
  userAvatarUrl: string | null;
  canDebug: boolean;
  debugMode: boolean;
  debugMetaMap: Record<string, DebugMeta>;
  truncatedBySafetySet: Set<string>;
  openingComponents: OpeningComponentWithSlots[];
  openingGlobalCss?: string;
  /** 非 quota/currency 的流式错误文案；null = 不显示。 */
  errorText: string | null;
  /** Finite metadata on the existing alert, only for the existing canDebug gate. */
  errorDiagnosticKind?: ChatStreamErrorTaxonomy;
  onSendMessage: HostSendHandler;
  onFillComposer?: (text: string) => void;
  onForkToMessage: (index: number) => void;
  onDeleteMessage: (id: string) => Promise<void>;
  onContinueMessage: (id: string) => void;
  onEditUserMessage: (id: string, content: string) => Promise<void>;
  onDeleteUserMessage: (id: string) => Promise<void>;
  onEditAssistantMessage: (id: string, content: string) => Promise<void>;
}

export const ChatMessagesList = memo(function ChatMessagesList({
  messages,
  status,
  continuingMessageId,
  lastAssistantIdx,
  submitting,
  rules,
  userPrefs,
  characterMeta,
  characterName,
  creatorNote,
  publicNoteHeader,
  userName,
  userAvatarUrl,
  canDebug,
  debugMode,
  debugMetaMap,
  truncatedBySafetySet,
  openingComponents,
  openingGlobalCss,
  errorText,
  errorDiagnosticKind,
  onSendMessage,
  onFillComposer,
  onForkToMessage,
  onDeleteMessage,
  onContinueMessage,
  onEditUserMessage,
  onDeleteUserMessage,
  onEditAssistantMessage,
}: ChatMessagesListProps) {
  const { dict } = useI18n();
  const nativeSource=useMemo(()=>hasMufyRenderedOpening(rules)||hasMufyAdaptedComponent(openingComponents),[rules,openingComponents]);
  const sourceComponentStyle=useMemo(()=>nativeSource?collectMufySharedComponentStyle(openingComponents):'', [nativeSource,openingComponents]);
  const originalTitleFont=useMemo(()=>nativeSource&&usesMufyOriginalTitleFont(openingComponents),[nativeSource,openingComponents]);

  // 流式开始后但 assistant bubble 尚未出现内容时，仍显示 thinking。
  // 内容一旦开始流出，BreathingDots 让位给 streaming 文本。
  const lastMsg = messages[messages.length - 1];
  const sidebarOwnerIdx = mufySidebarOwnerIndex(messages, status, continuingMessageId);
  const lastAssistantHasContent =
    lastMsg?.role === "assistant" &&
    lastMsg.parts.some((p) => p.type === "text" && p.text && p.text.length > 0);
  const showThinking =
    (status === "submitted" || status === "streaming") &&
    !lastAssistantHasContent;

  return (
    <MufyNativeSourceContext.Provider value={nativeSource}>
    <MufySharedComponentStyleContext.Provider value={sourceComponentStyle}>
    <MufyOriginalTitleFontContext.Provider value={originalTitleFont}>
      {originalTitleFont && <style data-mufy-original-title-font-face>{MUFY_ORIGINAL_TITLE_FONT_CSS}</style>}
      {creatorNote ? (
        <aside
          id="nj_author_note"
          data-nj-public-note-header={publicNoteHeader?.originalNote===creatorNote?"v1":undefined}
          data-nj-note-body-gap={publicNoteHeader?.originalNote===creatorNote&&publicNoteHeader.bodyGap===12?"12":undefined}
          className="nj_author_note mx-[var(--space-md)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/60 px-[var(--space-md)] py-[var(--space-sm)] text-sm leading-relaxed text-text-secondary"
        >
          {publicNoteHeader?.originalNote===creatorNote ? <>
            <div data-nj-note-header className="flex w-full justify-between">
              <span data-nj-note-title><MessageCircleMore size={18} aria-hidden="true"/><span>{publicNoteHeader.title}</span></span>
              <img src={publicNoteHeader.avatarUrl} alt="" width={24} height={24}/>
            </div>
            <p className="whitespace-pre-wrap">{publicNoteHeader.body}</p>
          </> : <>
          <p className="mb-[var(--space-2xs)] font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            {dict.chat.authorNoteLabel}
          </p>
          <p className="whitespace-pre-wrap">{creatorNote}</p>
          </>}
        </aside>
      ) : null}
      <OpeningSlot
        components={openingComponents}
        character={characterMeta}
        userName={userName}
        globalCss={openingGlobalCss}
        onSendMessage={onSendMessage}
        onFillComposer={onFillComposer}
      />
      {messages.map((m, i) => {
        const isStreamingMsg =
          m.role === "assistant" &&
          ((status === "streaming" && i === lastAssistantIdx) ||
            m.id === continuingMessageId);
        // Fresh streamed turns carry DebugMeta on m.metadata (useChat
        // message-metadata channel); history loaded via RSC carries it in
        // debugMetaMap keyed by id. Prefer the live metadata so the panel
        // shows without a page refresh, fall back to the RSC map.
        const meta =
          m.role === "assistant"
            ? (m.metadata ?? debugMetaMap[m.id])
            : undefined;
        const truncationPlacement = truncatedBySafetySet.has(m.id)
          ? safetyTruncationNoticePlacement(m.parts)
          : null;
        const showTruncationNotice = truncationPlacement === "external";
        const stateTruncationSuffix =
          truncationPlacement === "inside-state"
            ? stateTruncationRenderSuffix(dict.chat.truncatedStateSectionNotice)
            : undefined;
        return (
          <ChatMessageRow
            key={m.id}
            message={m}
            index={i}
            isStreamingMsg={isStreamingMsg}
            isLastAssistant={i === lastAssistantIdx}
            ownsMufySidebar={i === sidebarOwnerIdx}
            submitting={submitting}
            meta={meta}
            showDebug={canDebug && debugMode}
            showTruncationNotice={showTruncationNotice}
            showStoppedNotice={meta?.stoppedByUser === true}
            stateTruncationSuffix={stateTruncationSuffix}
            rules={rules}
            userPrefs={userPrefs}
            character={characterMeta}
            userName={userName}
            userAvatarUrl={userAvatarUrl}
            onSendMessage={onSendMessage}
            onFillComposer={onFillComposer}
            onForkToMessage={onForkToMessage}
            onDeleteMessage={onDeleteMessage}
            onContinueMessage={onContinueMessage}
            onEditUserMessage={onEditUserMessage}
            onDeleteUserMessage={onDeleteUserMessage}
            onEditAssistantMessage={onEditAssistantMessage}
          />
        );
      })}
      {showThinking && (
        <ThinkingDots
          label={dict.chat.thinkingFmt.replace("{name}", characterName)}
          align="row"
        />
      )}
      {errorText && (
        <p
          role="alert"
          data-nj-stream-error-kind={canDebug ? errorDiagnosticKind : undefined}
          className="rounded-[var(--radius-sm)] border border-semantic-error/40 bg-semantic-error/10 p-[var(--space-md)] text-sm text-semantic-error"
        >
          {errorText}
        </p>
      )}
      <div
        aria-hidden
        className="h-[calc(var(--space-xl)+var(--space-sm))] shrink-0"
      />
    </MufyOriginalTitleFontContext.Provider>
    </MufySharedComponentStyleContext.Provider>
    </MufyNativeSourceContext.Provider>
  );
});
