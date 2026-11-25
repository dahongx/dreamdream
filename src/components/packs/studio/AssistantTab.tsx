"use client";

import { Send as SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { ModelPicker } from "@/components/ai/ModelPicker";
import { ThinkingDots } from "@/components/ai/ThinkingDots";
import {
  CurrencySwitcher,
  type CurrencyType,
} from "@/components/chat/CurrencySwitcher";
import {
  AddOpeningCard,
  AddRuleCard,
  ProposalErrorCard,
  SetGlobalCssCard,
} from "@/components/packs/studio/ProposalCard";
import { InsufficientCurrencyModal } from "@/components/quota/InsufficientCurrencyModal";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import { DEFAULT_MODEL_ID, type NimirModelId } from "@/lib/ai/models";
import type {
  MessageAttachment,
  RegexRule,
  StudioSession,
} from "@/lib/db/schema";
import {
  type ProposalAddOpening,
  type ProposalAddRule,
  parseAssistantMessage,
} from "@/lib/packs/assistant-parser";

/**
 * Canvas-style assistant：聊天 + 流式 + LLM 输出里的 <proposal> 块直接
 * 渲染成可一键应用的卡片。应用成功 → onRuleAdded / onCssChanged 回调
 * 同步 StudioLayout 中的 session draftPayload → preview 立刻反映。
 *
 * 多轮持久化：initialMessages 由 RSC 从 DB 加载（按 sessionId），每轮发送
 * 时后端会自动拼上完整历史 + 当前 user prompt 一起喂给 LLM；流结束后
 * 后端把本轮 (user + assistant) 持久化。点 ⟲ 调 server action 清空 DB +
 * 本地 state。
 *
 * 当 session.status !== "active" 时进入只读态：禁用输入框，隐藏发送按钮。
 *
 * 图片附件：textarea 旁的 📎 按钮 / 拖拽 / 粘贴都可上传；单轮最多 4 张。
 * 上传走 /api/uploads/image scope=studio_ref，拿到 R2 publicUrl 后跟随
 * 本轮 prompt 一起 POST。后端用 vision content array 喂给 Claude。
 */

const MAX_ATTACHMENTS = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
}

type PendingAttachment = {
  localId: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "ready" | "error";
  // 仅 ready 时有
  url?: string;
  mimeType: MessageAttachment["mimeType"];
  size: number;
  error?: string;
};

interface Props {
  session: StudioSession;
  initialMessages: Message[];
  rules: RegexRule[];
  globalCss: string;
  readOnly?: boolean;
  /** 编辑模式下被编辑组件的名字 —— 用于空状态的「正在编辑 xxx」提示。 */
  editingTargetName?: string | null;
  onRuleAdded: (payload: ProposalAddRule) => void;
  onCssChanged: (css: string) => void;
  onOpeningAdded: (payload: ProposalAddOpening) => void;
}

async function uploadAttachment(file: File): Promise<{
  url: string;
  mimeType: MessageAttachment["mimeType"];
  size: number;
}> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("scope", "studio_ref");
  const res = await fetch("/api/uploads/image", { method: "POST", body: fd });
  if (!res.ok) {
    throw new Error(`upload failed (${res.status})`);
  }
  const { publicUrl } = (await res.json()) as { publicUrl: string };
  return {
    url: publicUrl,
    mimeType: file.type as MessageAttachment["mimeType"],
    size: file.size,
  };
}

export function AssistantTab({
  session,
  initialMessages,
  rules,
  globalCss,
  readOnly,
  editingTargetName,
  onRuleAdded,
  onCssChanged,
  onOpeningAdded,
}: Props) {
  const { dict } = useI18n();
  const dialog = useDialog();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [modelId, setModelId] = useState<NimirModelId>(DEFAULT_MODEL_ID);
  const [currencyType, setCurrencyType] = useState<CurrencyType>("silver");
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientInfo, setInsufficientInfo] = useState<{
    currencyType: CurrencyType;
    required: number | null;
    balance: number | null;
  } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 是否贴底：用户在底部或刚发消息时为 true，上滑看历史时为 false。 */
  const stickToBottomRef = useRef(true);

  // session 切换时同步 history（StudioLayout 切 active 后 initialMessages
  // 只在挂载时给一次，组件实例不变 → 我们要手动 reset 内部 state）。
  // 故意只依赖 session.id：切到新 session 才走 reset，使用当时的 props。
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only re-init on session id change
  useEffect(() => {
    setMessages(initialMessages);
    stickToBottomRef.current = true;
    setInput("");
    // revoke 本会话所有 pending 的 objectURL，再清空
    setPendingAttachments((prev) => {
      for (const a of prev) URL.revokeObjectURL(a.previewUrl);
      return [];
    });
    setIsDragOver(false);
    dragDepthRef.current = 0;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
  }, [session.id]);

  // 卸载时清理残留 objectURL
  useEffect(() => {
    return () => {
      setPendingAttachments((prev) => {
        for (const a of prev) URL.revokeObjectURL(a.previewUrl);
        return [];
      });
    };
  }, []);

  // 贴底跟随：用户在底部(或刚发消息)时，流式输出 / 新消息自动滚到最新；
  // 用户手动上滑看历史时(stickToBottomRef=false)不打断。
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: 故意依赖 messages —— 每次流式追加/新消息都要触发贴底滚动，即便 body 未直接读取它
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function uploadOne(localId: string, file: File) {
    try {
      const result = await uploadAttachment(file);
      setPendingAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId ? { ...a, ...result, status: "ready" } : a,
        ),
      );
    } catch {
      setPendingAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId
            ? {
                ...a,
                status: "error",
                error: dict.packs.studioAssistantAttachUploadFailed,
              }
            : a,
        ),
      );
    }
  }

  const VISION_FALLBACK_MODEL: NimirModelId = "claude-sonnet-4-6";

  function addFiles(files: File[] | FileList) {
    if (readOnly) return;
    const list = Array.from(files);
    const accepted: File[] = [];
    const errors: string[] = [];
    for (const f of list) {
      if (!ALLOWED_MIME.has(f.type)) {
        errors.push(dict.packs.studioAssistantAttachBadType);
        continue;
      }
      if (f.size > MAX_BYTES) {
        errors.push(dict.packs.studioAssistantAttachTooLarge);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0 && modelId.startsWith("deepseek-ai/")) {
      setModelId(VISION_FALLBACK_MODEL);
    }
    if (errors.length > 0) {
      // 简单合并去重；errors 通常是同类
      const unique = Array.from(new Set(errors));
      void dialog.alert({ body: unique.join("\n") });
    }
    setPendingAttachments((prev) => {
      const room = MAX_ATTACHMENTS - prev.length;
      if (room <= 0) {
        void dialog.alert({ body: dict.packs.studioAssistantAttachTooMany });
        return prev;
      }
      const take = accepted.slice(0, room);
      if (accepted.length > room) {
        void dialog.alert({ body: dict.packs.studioAssistantAttachTooMany });
      }
      const newOnes: PendingAttachment[] = take.map((file) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
        mimeType: file.type as MessageAttachment["mimeType"],
        size: file.size,
      }));
      // 启动上传
      for (const a of newOnes) {
        void uploadOne(a.localId, a.file);
      }
      return [...prev, ...newOnes];
    });
  }

  function removeAttachment(localId: string) {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.localId !== localId);
    });
  }

  function retryAttachment(localId: string) {
    setPendingAttachments((prev) =>
      prev.map((a) =>
        a.localId === localId
          ? { ...a, status: "uploading", error: undefined }
          : a,
      ),
    );
    const target = pendingAttachments.find((a) => a.localId === localId);
    if (target) void uploadOne(localId, target.file);
  }

  async function send() {
    const text = input.trim();
    const ready = pendingAttachments.filter((a) => a.status === "ready");
    if (readOnly || streaming) return;
    if (text.length === 0 && ready.length === 0) return;
    if (pendingAttachments.some((a) => a.status !== "ready")) return;
    setInput("");

    const attachmentsForMsg: MessageAttachment[] = ready.map((a) => ({
      url: a.url as string,
      mimeType: a.mimeType,
      size: a.size,
    }));
    // 立刻 revoke + 清空，optimistic userMsg 用持久 R2 URL
    for (const a of pendingAttachments) URL.revokeObjectURL(a.previewUrl);
    setPendingAttachments([]);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      attachments: attachmentsForMsg.length > 0 ? attachmentsForMsg : undefined,
    };
    const assistantId = `a-${Date.now()}`;
    stickToBottomRef.current = true;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);

    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pack-assistant",
          sessionId: session.id,
          prompt: text || dict.packs.studioAssistantImageOnlyPrompt,
          model: modelId,
          currencyType,
          attachments:
            attachmentsForMsg.length > 0 ? attachmentsForMsg : undefined,
          context: {
            currentRules: rules.map((r) => ({
              id: r.id,
              name: r.name,
              pattern: r.pattern,
              replacement: r.replacement,
              visible: r.visible,
              enabled: r.enabled,
            })),
            currentGlobalCss: globalCss,
          },
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        // 4xx：把 JSON body 摘出来，余额弹窗优先处理；其它进 alert。
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          currencyType?: CurrencyType;
          required?: number;
          balance?: number;
        };
        if (errBody.error === "insufficient_currency") {
          setInsufficientInfo({
            currencyType: errBody.currencyType ?? currencyType,
            required: errBody.required ?? null,
            balance: errBody.balance ?? null,
          });
          setInsufficientOpen(true);
        } else {
          void dialog.alert({
            body: dict.packs.studioOperationFailed,
          });
        }
        // 撤掉 optimistic 空 assistant 占位
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: buf } : m)),
        );
      }
    } catch {
      // aborted or error — leave partial content
    } finally {
      setStreaming(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    let hasText = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      } else if (item.kind === "string") {
        hasText = true;
      }
    }
    if (imageFiles.length > 0) {
      addFiles(imageFiles);
      // 纯图（无文本）→ 阻止默认避免空字符串进 textarea；
      // 混合（图 + 文本）→ 让文本正常粘贴
      if (!hasText) {
        e.preventDefault();
      }
    }
  }

  function onContainerDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }
  function onContainerDragLeave(_e: React.DragEvent<HTMLDivElement>) {
    if (readOnly) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }
  function onContainerDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault(); // 必须 preventDefault 才能触发 drop
    }
  }
  function onContainerDrop(e: React.DragEvent<HTMLDivElement>) {
    if (readOnly) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
  }

  const allReady = pendingAttachments.every((a) => a.status === "ready");
  const canSend =
    !streaming &&
    !readOnly &&
    allReady &&
    (input.trim().length > 0 || pendingAttachments.length > 0);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag/drop on container is the standard pattern; no semantic role fits
    <div
      className="relative flex h-full flex-col"
      onDragEnter={onContainerDragEnter}
      onDragLeave={onContainerDragLeave}
      onDragOver={onContainerDragOver}
      onDrop={onContainerDrop}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border-subtle px-[var(--space-md)] py-[var(--space-sm)]">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          {dict.packs.studioAssistantHeader}
        </span>
        <div className="flex items-center gap-[var(--space-xs)]">
          <ModelPicker
            value={modelId}
            onChange={setModelId}
            size="xs"
            disabled={streaming || readOnly}
          />
          <CurrencySwitcher
            storageKey="nj_currency_pack_assistant"
            modelId={modelId}
            onChange={setCurrencyType}
            disabled={streaming || readOnly}
          />
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-[var(--space-md)]"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-[var(--space-sm)] px-[var(--space-md)] text-center">
            <p className="max-w-sm text-xs leading-relaxed text-text-muted">
              {editingTargetName
                ? dict.packs.studioAssistantHintEditing.replace(
                    "{name}",
                    editingTargetName,
                  )
                : pickHint(session, dict.packs)}
            </p>
            {!readOnly && (
              <div className="mt-[var(--space-xs)] flex w-full max-w-md flex-col gap-[var(--space-xs)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  {dict.packs.studioAssistantExamplesHeading}
                </p>
                <div className="flex flex-col gap-[2px]">
                  {pickExamples(session, dict.packs).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setInput(ex)}
                      className="rounded-[var(--radius-sm)] border border-border-subtle/60 bg-surface-glass/30 px-[var(--space-sm)] py-[4px] text-left text-[11px] leading-snug text-text-secondary transition-colors hover:border-accent-primary/60 hover:bg-accent-primary/5 hover:text-text-primary"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-[var(--space-md)]">
            {(() => {
              const isEditMode = !!session.targetRuleId;
              const isOpeningEditMode = !!session.targetOpeningComponentId;
              let priorAddRules = 0;
              let priorAddOpenings = 0;
              return messages.map((m) => {
                if (m.role === "user") {
                  return (
                    <div
                      key={m.id}
                      className="ml-auto max-w-[80%] rounded-[var(--radius-md)] bg-accent-primary/15 p-[var(--space-sm)] text-sm leading-relaxed text-text-primary"
                    >
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-[var(--space-xs)] flex flex-wrap gap-[var(--space-xs)]">
                          {m.attachments.map((a) => (
                            <a
                              key={a.url}
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              {/* biome-ignore lint/performance/noImgElement: 用户上传的 R2 图，体积已限 5MB，无需 next/image 优化 */}
                              <img
                                src={a.url}
                                alt=""
                                className="h-20 w-20 rounded-[var(--radius-sm)] border border-border-subtle/60 object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      {m.content && (
                        <pre className="whitespace-pre-wrap break-words font-body-zh">
                          {m.content}
                        </pre>
                      )}
                    </div>
                  );
                }
                const thisHasAddRule = countAddRules(m.content) > 0;
                const isIteration =
                  thisHasAddRule && (isEditMode || priorAddRules >= 1);
                const thisHasAddOpening = countAddOpenings(m.content) > 0;
                const isOpeningIteration =
                  thisHasAddOpening &&
                  (isOpeningEditMode || priorAddOpenings >= 1);
                const node = (
                  <AssistantMessage
                    key={m.id}
                    content={m.content}
                    sessionType={session.type}
                    readOnly={readOnly}
                    iteration={isIteration}
                    openingIteration={isOpeningIteration}
                    onRuleAdded={onRuleAdded}
                    onCssChanged={onCssChanged}
                    onOpeningAdded={onOpeningAdded}
                  />
                );
                if (thisHasAddRule) priorAddRules += 1;
                if (thisHasAddOpening) priorAddOpenings += 1;
                return node;
              });
            })()}
            {streaming && (
              <ThinkingDots
                label={dict.packs.studioAssistantThinking}
                align="row"
                tone="creative"
              />
            )}
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="border-t border-border-subtle">
          {pendingAttachments.length > 0 && (
            <div
              id="nj_pack_studio_assistant_attachments"
              className="flex flex-wrap gap-[var(--space-xs)] px-[var(--space-md)] pt-[var(--space-sm)]"
            >
              {pendingAttachments.map((a) => (
                <PendingThumb
                  key={a.localId}
                  attachment={a}
                  onRemove={() => removeAttachment(a.localId)}
                  onRetry={() => retryAttachment(a.localId)}
                />
              ))}
            </div>
          )}
          <div className="px-[var(--space-md)] py-[var(--space-sm)]">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = ""; // 允许同名文件再次触发
              }}
            />
            <div className="flex h-10 items-stretch rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass transition-colors focus-within:border-border-strong">
              <button
                type="button"
                aria-label={dict.packs.studioAssistantAttachButton}
                title={`${dict.packs.studioAssistantAttachButton} ${dict.packs.studioAssistantAttachCounter.replace("{n}", String(pendingAttachments.length))}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={pendingAttachments.length >= MAX_ATTACHMENTS}
                className="inline-flex shrink-0 items-center justify-center px-[var(--space-md)] text-text-muted transition-colors hover:text-accent-primary disabled:opacity-40"
              >
                <span aria-hidden>📎</span>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                onPaste={onPaste}
                rows={1}
                placeholder={dict.packs.studioAssistantPlaceholder}
                className="flex-1 resize-none border-0 bg-transparent px-[var(--space-sm)] py-[var(--space-sm)] font-body-zh text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted disabled:opacity-60"
              />
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                aria-label={dict.packs.studioAssistantSend}
                className="inline-flex shrink-0 items-center justify-center px-[var(--space-md)] text-text-muted transition-colors hover:text-accent-primary disabled:opacity-40"
              >
                <SendIcon
                  width={18}
                  height={18}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 拖拽 overlay */}
      {isDragOver && !readOnly && (
        <div
          id="nj_pack_studio_attachment_dropzone"
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-accent-primary/10 backdrop-blur-sm"
        >
          <div className="rounded-[var(--radius-md)] border-2 border-dashed border-accent-primary bg-bg-elevated/90 px-[var(--space-xl)] py-[var(--space-lg)] text-center">
            <p className="font-display-zh text-xl text-accent-primary">
              {dict.packs.studioAssistantAttachHint}
            </p>
            <p className="mt-[var(--space-xs)] font-mono text-xs text-text-muted">
              {dict.packs.studioAssistantAttachCounter.replace(
                "{n}",
                String(pendingAttachments.length),
              )}
            </p>
          </div>
        </div>
      )}

      <InsufficientCurrencyModal
        open={insufficientOpen}
        onOpenChange={setInsufficientOpen}
        currencyType={insufficientInfo?.currencyType ?? null}
        required={insufficientInfo?.required ?? null}
        balance={insufficientInfo?.balance ?? null}
      />
    </div>
  );
}

function PendingThumb({
  attachment,
  onRemove,
  onRetry,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.packs;
  const borderClass =
    attachment.status === "error"
      ? "border-semantic-error"
      : attachment.status === "uploading"
        ? "border-accent-primary/60"
        : "border-border-subtle";
  return (
    <div
      data-status={attachment.status}
      className={`nj_pack_studio_attachment_thumb group relative h-14 w-14 overflow-hidden rounded-[var(--radius-sm)] border ${borderClass}`}
    >
      {/* biome-ignore lint/performance/noImgElement: 本地 blob URL 预览图，next/image 不适用 */}
      <img
        src={attachment.previewUrl}
        alt=""
        className="h-full w-full object-cover"
      />
      {attachment.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-base/50">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-primary" />
        </div>
      )}
      {attachment.status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          title={attachment.error ?? t.studioAssistantAttachUploadFailed}
          className="absolute inset-0 flex items-center justify-center bg-semantic-error/30 text-[10px] font-semibold text-text-on-accent"
        >
          {t.studioAssistantAttachRetry}
        </button>
      )}
      <button
        type="button"
        aria-label={t.studioAssistantAttachRemove}
        onClick={onRemove}
        className="absolute right-[2px] top-[2px] flex h-4 w-4 items-center justify-center rounded-full bg-bg-base/80 text-[10px] text-text-primary opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

/** 按 session 类型给出对应的空状态引导语。 */
function pickHint(
  session: StudioSession,
  dict: {
    studioAssistantHint: string;
    studioAssistantHintComponent: string;
    studioAssistantHintOpening: string;
    studioAssistantHintCss: string;
  },
): string {
  if (session.type === "css") return dict.studioAssistantHintCss;
  if (session.type === "opening") return dict.studioAssistantHintOpening;
  if (session.type === "component") return dict.studioAssistantHintComponent;
  return dict.studioAssistantHint;
}

/** 按 session 类型给出对应的起手式样本。
 *  - css 会话 → 皮肤类提示
 *  - opening 新建 → 开场组件类提示
 *  - opening 编辑（绑定 targetOpeningComponentId）→ 开场微调类提示
 *  - component 新建 → 新组件类提示
 *  - component 编辑（绑定 targetRuleId）→ 微调类提示 */
function pickExamples(
  session: StudioSession,
  dict: {
    studioAssistantExamplesSkin: string[];
    studioAssistantExamplesBlockNew: string[];
    studioAssistantExamplesBlockEdit: string[];
    studioAssistantExamplesOpeningNew: string[];
    studioAssistantExamplesOpeningEdit: string[];
  },
): string[] {
  if (session.type === "css") return dict.studioAssistantExamplesSkin;
  if (session.type === "opening") {
    return session.targetOpeningComponentId
      ? dict.studioAssistantExamplesOpeningEdit
      : dict.studioAssistantExamplesOpeningNew;
  }
  if (session.targetRuleId) return dict.studioAssistantExamplesBlockEdit;
  return dict.studioAssistantExamplesBlockNew;
}

/** 数一条 assistant message 里有多少个 add-rule proposal。 */
function countAddRules(content: string): number {
  return content.match(/<proposal\s+type="add-rule">/g)?.length ?? 0;
}

/** 数一条 assistant message 里有多少个 add-opening proposal。 */
function countAddOpenings(content: string): number {
  return content.match(/<proposal\s+type="add-opening">/g)?.length ?? 0;
}

function AssistantMessage({
  content,
  sessionType,
  readOnly,
  iteration,
  openingIteration,
  onRuleAdded,
  onCssChanged,
  onOpeningAdded,
}: {
  content: string;
  sessionType: StudioSession["type"];
  readOnly?: boolean;
  iteration?: boolean;
  openingIteration?: boolean;
  onRuleAdded: (payload: ProposalAddRule) => void;
  onCssChanged: (css: string) => void;
  onOpeningAdded: (payload: ProposalAddOpening) => void;
}) {
  const segments = parseAssistantMessage(content);
  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      {segments.map((seg) => {
        if (seg.kind === "text") {
          return (
            <div
              key={`text-${seg.content.slice(0, 10)}`}
              className="min-w-0 max-w-full break-words rounded-[var(--radius-md)] bg-surface-glass p-[var(--space-sm)] text-sm leading-relaxed text-text-primary [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
            >
              <Markdown>{seg.content}</Markdown>
            </div>
          );
        }
        if (seg.kind === "proposal-add-rule") {
          return (
            <AddRuleCard
              key={`add-rule-${seg.index}`}
              payload={seg.payload}
              iteration={iteration}
              mismatch={sessionType !== "component"}
              onApplied={readOnly ? () => {} : onRuleAdded}
            />
          );
        }
        if (seg.kind === "proposal-set-global-css") {
          return (
            <SetGlobalCssCard
              key={`set-css-${seg.index}`}
              payload={seg.payload}
              mismatch={sessionType !== "css"}
              onApplied={readOnly ? () => {} : onCssChanged}
            />
          );
        }
        if (seg.kind === "proposal-add-opening") {
          return (
            <AddOpeningCard
              key={`add-opening-${seg.index}`}
              payload={seg.payload}
              iteration={openingIteration}
              mismatch={sessionType !== "opening"}
              onApplied={readOnly ? () => {} : onOpeningAdded}
            />
          );
        }
        return <ProposalErrorCard key={`err-${seg.index}`} />;
      })}
    </div>
  );
}
