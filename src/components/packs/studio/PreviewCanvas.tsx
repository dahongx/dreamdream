"use client";

import type { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { ChatStage } from "@/components/chat/ChatStage";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { RegexIframe } from "@/components/regex/RegexIframe";
import { useI18n } from "@/i18n/client";
import type { RegexRule } from "@/lib/db/schema";
import { routeOpeningContent } from "@/lib/opening/content";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

/**
 * Pack studio 的实时预览面板。
 *
 * 关键设计：复用生产 chat 的 ChatStage + MessageBubble，让 creator 看到的
 * 视觉跟真实聊天页 100% 同源（同一立绘双层 / 同一渐变 narration / 同一 system
 * 胶囊）。规则 + globalCss 在 preview 容器内 scoped 注入，跟生产的
 * `[data-character-css="<charId>"]` scope 机制完全一致。
 *
 * 样本来源：
 *   - DEFAULT_SAMPLES：覆盖 host 渲染协议常用语法（system / narration /
 *     message / 用户 / think / 复合）
 *   - 动态追加：每条 rule (含草稿) 如果有 targetText，自动追加为一条样本，
 *     这样 creator 应用了组件后能立即在 preview 里看到效果，不用自己
 *     去手编辑样本
 *
 * 见 docs/contracts/creator-studio-update.md §4
 */

/**
 * 默认样本：覆盖 chat 渲染协议（spec §2.3）的全量语法。每条样本配
 * caption 告诉 creator 这条在示范什么 —— preview 不是来"试 LLM"的，
 * 是给 creator 一眼看完所有 host 语法在当前 pack 下的渲染效果。
 *
 * 文案来自当前 locale 的词典；标签结构与 markdown 标记跨语言保持一致。
 */
interface SampleEntry {
  role: "user" | "assistant";
  text: string;
  /** 给 creator 看的语法说明，不是给 LLM 的。 */
  caption: string;
}

const DEFAULT_SAMPLE_ROLES: SampleEntry["role"][] = [
  "assistant",
  "assistant",
  "assistant",
  "user",
  "assistant",
  "assistant",
];

function buildDefaultSamples(
  texts: string[],
  captions: string[],
): SampleEntry[] {
  return DEFAULT_SAMPLE_ROLES.map((role, index) => ({
    role,
    text: texts[index] ?? "",
    caption: captions[index] ?? "",
  }));
}

/** 聚焦模式：
 *   'all'  - 全量（无 active session 或 session 已 committed）
 *   'css'  - 当前在迭代皮肤：默认样本全显示让创作者看 CSS 效果，
 *            不附加 rule sample（避免组件卡片分散注意力）
 *   'rule' - 当前在打磨某条互动块：只显示「极简 ctx + 该组件 sample」
 */
export type PreviewFocus =
  | { kind: "all" }
  | { kind: "css" }
  | { kind: "rule"; ruleId: string; label: string }
  | { kind: "opening"; content: string; label: string };

interface Props {
  packId: string;
  rules: RegexRule[];
  globalCss: string;
  focus?: PreviewFocus;
  /** 预览底部右对齐的操作区（如 session 「丢弃 / 确认应用」）。 */
  footerActions?: React.ReactNode;
}

export function PreviewCanvas({
  packId,
  rules,
  globalCss,
  focus = { kind: "all" },
  footerActions,
}: Props) {
  const { dict } = useI18n();
  const defaultSamples = useMemo(
    () =>
      buildDefaultSamples(
        dict.packs.studioPreviewDefaultSampleTexts,
        dict.packs.studioPreviewDefaultSampleCaptions,
      ),
    [
      dict.packs.studioPreviewDefaultSampleCaptions,
      dict.packs.studioPreviewDefaultSampleTexts,
    ],
  );
  const [samples, setSamples] = useState(defaultSamples);
  useEffect(() => setSamples(defaultSamples), [defaultSamples]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  /** Per-rule sample text overrides — let creator tweak the rule preview
   *  sample locally without touching rule.targetText itself. Keyed by rule.id;
   *  drafts use draft-* ids so swapping draft→persisted resets the override
   *  (acceptable: persisted rule gets fresh sample from DB). */
  const [ruleOverrides, setRuleOverrides] = useState<Map<string, string>>(
    new Map(),
  );
  /** Bumped by the "重新预览" button to force-remount the preview iframe so
   *  entrance animations (翻页 / 淡入 / 打字机) replay — creator 常「来不及看」
   *  应用瞬间那一次播放。用作 RegexIframe 的 key 后缀。 */
  const [replayNonce, setReplayNonce] = useState(0);

  const scopeKey = `preview-${packId}`;
  const scopedCss = useMemo(() => {
    if (!globalCss.trim()) return "";
    return sanitizeAndScopeCss(globalCss, scopeKey).css;
  }, [globalCss, scopeKey]);

  // Append each rule's targetText as an additional preview sample. Lets the
  // creator see new panels in preview without having to manually craft the
  // sample LLM output. Drafts get a 草稿 caption, persisted rules show the
  // rule name plainly. Each sample carries its ruleId so the editor can write
  // the override back to ruleOverrides instead of mutating DEFAULT_SAMPLES.
  type ExtendedSample = SampleEntry & { ruleId?: string };

  const focusedDefaults: SampleEntry[] = useMemo(() => {
    if (focus.kind === "rule") {
      // 互动块会话：只留两条最小 context — system 定时空 + 一句角色台词
      // 让创作者看到组件嵌在对话流里的样子，画面不被 5 条干扰
      return [defaultSamples[0], defaultSamples[2]];
    }
    return samples;
  }, [defaultSamples, focus.kind, samples]);

  const allSamples: ExtendedSample[] = useMemo(() => {
    if (focus.kind === "css") {
      // 皮肤会话：默认样本就够看 CSS 效果，不附加 rule sample（避免凌乱）
      return focusedDefaults;
    }
    if (focus.kind === "rule") {
      const target = rules.find((r) => r.id === focus.ruleId);
      if (!target) return [];
      const baseTarget = target.targetText?.trim();
      // 空 targetText:显示提示(避免预览空白 + 开关失效)
      const effectiveTarget =
        baseTarget ||
        dict.packs.studioPreviewRuleNeedsFormatFmt.replace(
          "{pattern}",
          `${target.pattern.slice(0, 50)}${target.pattern.length > 50 ? "..." : ""}`,
        );
      const overridden = ruleOverrides.get(target.id);
      const isDraft = target.id.startsWith("draft-");
      const ruleSample: ExtendedSample = {
        role: "assistant",
        text: overridden ?? effectiveTarget,
        caption: isDraft
          ? `${dict.packs.studioPreviewDraftSample} · ${target.name}`
          : `${dict.packs.studioPreviewRuleSample} · ${target.name}`,
        ruleId: target.id,
      };
      // ctx(system) + 组件 sample + ctx(角色台词)
      return [focusedDefaults[0], ruleSample, focusedDefaults[1]];
    }
    // 'all'：default 示例 + 全部组件 sample(按 orderIndex,不置顶)
    const ruleSamples: ExtendedSample[] = [];
    for (const rule of rules) {
      const baseTarget = rule.targetText?.trim();
      if (!baseTarget) continue;
      const overridden = ruleOverrides.get(rule.id);
      const isDraft = rule.id.startsWith("draft-");
      ruleSamples.push({
        role: "assistant",
        text: overridden ?? baseTarget,
        caption: isDraft
          ? `${dict.packs.studioPreviewDraftSample} · ${rule.name}`
          : `${dict.packs.studioPreviewRuleSample} · ${rule.name}`,
        ruleId: rule.id,
      });
    }
    return [...focusedDefaults, ...ruleSamples];
  }, [focus, focusedDefaults, rules, ruleOverrides, dict.packs]);

  // Construct mock UIMessages from samples so MessageBubble can take over —
  // this guarantees applyRegex → segments → MessageRenderer path is bit-for-bit
  // identical to chat production. Stable preview-{i} ids prevent React key churn.
  const previewMessages: UIMessage[] = useMemo(
    () =>
      allSamples.map((sample, i) => ({
        id: `preview-${i}`,
        role: sample.role,
        parts: [{ type: "text", text: sample.text }],
      })),
    [allSamples],
  );

  const mockCharacter = useMemo(
    () => ({
      id: packId,
      name: dict.packs.studioPreviewMockName,
      avatarUrl: null,
      tags: [] as string[],
      bio: null,
    }),
    [packId, dict.packs.studioPreviewMockName],
  );

  return (
    <div
      id="nj_pack_studio_preview_canvas"
      data-character-css={scopeKey}
      className="flex h-full flex-col"
    >
      {scopedCss && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-sanitized + scope-prefixed
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
      )}

      {/* Custom header — heights aligned with AssistantTab header.
          ChatStage's built-in <header> is shared with chat production (py-md +
          h-12 avatar) which is too tall here; we bypass it and render flat. */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-[var(--space-sm)] border-b border-border-subtle px-[var(--space-md)] py-[var(--space-sm)]">
        <div className="flex min-w-0 items-center gap-[var(--space-sm)]">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            {dict.packs.studioPreviewTitle}
          </span>
          <h2 className="truncate font-display-zh text-sm text-text-primary">
            {mockCharacter.name}
          </h2>
          {focus.kind !== "all" && (
            <span className="hidden shrink-0 rounded-[var(--radius-pill)] border border-accent-primary/40 bg-accent-primary/10 px-[var(--space-sm)] py-[2px] text-[10px] text-accent-primary md:inline">
              {focus.kind === "css"
                ? dict.packs.studioPreviewFocusSkin
                : dict.packs.studioPreviewFocusFmt.replace(
                    "{label}",
                    focus.label,
                  )}
            </span>
          )}
          {focus.kind === "opening" && focus.content.trim() && (
            <button
              type="button"
              onClick={() => setReplayNonce((n) => n + 1)}
              className="shrink-0 rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-[10px] text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary"
              title={dict.packs.studioPreviewReplay}
            >
              ↻ {dict.packs.studioPreviewReplay}
            </button>
          )}
        </div>
      </div>

      {focus.kind === "opening" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-[var(--space-md)] md:p-[var(--space-lg)]">
            {focus.content.trim() ? (
              <div
                id="nj_opening_slot"
                className="nj_opening_slot flex flex-col gap-[var(--space-md)]"
              >
                {(() => {
                  const r = routeOpeningContent(focus.content);
                  if (r.kind === "html") {
                    return <MessageRenderer source={r.html} />;
                  }
                  // 跟生产 chat 的 OpeningSlot 同源：iframe artifact 挂真实
                  // 沙箱组件，creator 看到的就是访客看到的（无 capture group，
                  // history 空，onSendMessage no-op —— preview 不真发消息）。
                  // 多完整文档小剧场: 每段各自一个 iframe 垂直堆叠.
                  const srcdocs = r.kind === "iframe" ? [r.srcdoc] : r.srcdocs;
                  return srcdocs.map((srcdoc, i) => (
                    <RegexIframe
                      // 段由内容静态拆分, 顺序固定不重排 → index key 安全;
                      // replayNonce 变化时整组 remount 重播入场动画.
                      // biome-ignore lint/suspicious/noArrayIndexKey: stable order
                      key={`opening-preview-${replayNonce}-${i}`}
                      ruleId={`opening-preview-${i}`}
                      ruleName={focus.label}
                      // 皮肤拼进 srcdoc + cssScope 挂宿主属性（与生产
                      // OpeningSlot 同一套修复）—— creator 在 studio 里看到
                      // 的开场 iframe 从此真的吃到皮肤。
                      srcdoc={
                        scopedCss
                          ? `<style>${scopedCss}</style>\n${srcdoc}`
                          : srcdoc
                      }
                      cssScope={scopeKey}
                      captureGroups={[]}
                      history={[]}
                      character={mockCharacter}
                      userName="preview-user"
                      onSendMessage={() => {}}
                    />
                  ));
                })()}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                {dict.packs.studioPreviewEmptyCanvas}
              </p>
            )}
          </div>
          {footerActions && (
            <div
              id="nj_pack_studio_preview_footer"
              className="relative z-20 flex items-center justify-end gap-[var(--space-xs)] border-t border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)] md:px-[var(--space-xl)]"
            >
              {footerActions}
            </div>
          )}
        </div>
      ) : allSamples.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-md)] p-[var(--space-xl)] text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-subtle/60 bg-surface-glass/30">
            <span className="font-mono text-2xl text-text-muted/40">+</span>
          </div>
          <p className="max-w-[240px] text-sm leading-relaxed text-text-muted">
            {dict.packs.studioPreviewEmptyCanvas}
          </p>
          {footerActions && (
            <div className="mt-[var(--space-sm)] flex items-center gap-[var(--space-xs)]">
              {footerActions}
            </div>
          )}
        </div>
      ) : (
        <ChatStage
          stageBg={null}
          header={null}
          messages={previewMessages.map((m, i) => {
            const sample = allSamples[i];
            const ruleId = sample?.ruleId;
            const isDefaultSample = !ruleId;
            return (
              <div
                key={m.id}
                className="group relative flex flex-col gap-[var(--space-xs)]"
              >
                {sample?.caption && (
                  <p className="text-xs leading-relaxed text-text-muted/70">
                    <span
                      className={`mr-[var(--space-xs)] inline-block rounded-[var(--radius-sm)] border px-[var(--space-xs)] py-[1px] font-mono text-[10px] uppercase tracking-[0.15em] ${
                        isDefaultSample
                          ? "border-border-subtle/50 text-text-muted"
                          : "border-accent-gold/40 text-accent-gold-soft"
                      }`}
                    >
                      {isDefaultSample
                        ? dict.packs.studioPreviewSampleBadge
                        : dict.packs.studioPreviewOwnBadge}
                    </span>
                    {sample.caption}
                  </p>
                )}
                <MessageBubble
                  message={m}
                  rules={rules}
                  isStreaming={false}
                  history={[]}
                  character={mockCharacter}
                  userName="preview-user"
                  userAvatarUrl={null}
                  onSendMessage={() => {}}
                />
                {editingIdx === i ? (
                  <SampleEditor
                    initialText={sample?.text ?? ""}
                    onCancel={() => setEditingIdx(null)}
                    onApply={(text) => {
                      if (isDefaultSample && focus.kind === "all") {
                        setSamples((prev) =>
                          prev.map((s, j) => (j === i ? { ...s, text } : s)),
                        );
                      } else if (ruleId) {
                        setRuleOverrides((prev) => {
                          const next = new Map(prev);
                          next.set(ruleId, text);
                          return next;
                        });
                      }
                      setEditingIdx(null);
                    }}
                    cancelLabel={dict.packs.previewCancel}
                    applyLabel={dict.packs.previewApply}
                  />
                ) : (
                  !(focus.kind === "rule" && !ruleId) && (
                    <button
                      type="button"
                      onClick={() => setEditingIdx(i)}
                      className="absolute right-0 top-0 hidden rounded-[var(--radius-sm)] border border-border-subtle bg-bg-elevated px-[var(--space-xs)] py-[2px] text-xs text-text-muted group-hover:block"
                    >
                      {dict.packs.previewEditSample}
                    </button>
                  )
                )}
              </div>
            );
          })}
          input={
            footerActions ? (
              <div
                id="nj_pack_studio_preview_footer"
                className="relative z-20 flex items-center justify-end gap-[var(--space-xs)] border-t border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)] md:px-[var(--space-xl)]"
              >
                {footerActions}
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}

function SampleEditor({
  initialText,
  onCancel,
  onApply,
  cancelLabel,
  applyLabel,
}: {
  initialText: string;
  onCancel: () => void;
  onApply: (text: string) => void;
  cancelLabel: string;
  applyLabel: string;
}) {
  const [draft, setDraft] = useState(initialText);
  return (
    <div className="mt-[var(--space-xs)] flex flex-col gap-[var(--space-xs)]">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        className="w-full rounded-[var(--radius-sm)] border border-accent-primary/40 bg-bg-elevated/80 p-[var(--space-sm)] font-mono text-xs text-text-primary focus:outline-none"
      />
      <div className="flex gap-[var(--space-xs)]">
        <button
          type="button"
          onClick={() => onApply(draft)}
          className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-sm)] py-[2px] text-xs text-text-on-accent"
        >
          {applyLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-xs text-text-muted"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
