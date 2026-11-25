"use client";

import type { UIMessage } from "ai";
import { useMemo, useState } from "react";
import { ChatStage } from "@/components/chat/ChatStage";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { RegexIframe } from "@/components/regex/RegexIframe";
import { useI18n } from "@/i18n/client";
import type { OpeningComponent, RegexRule } from "@/lib/db/schema";
import { routeOpeningContent } from "@/lib/opening/content";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

/**
 * Pack 详情页的实时预览面板。
 *
 * 跟 studio PreviewCanvas 同源(都走 ChatStage + MessageBubble 让视觉跟真实
 * 聊天页 100% 一致),但这里是非作者视角:无法编辑样本、无法管理规则,只能
 * 勾选哪些规则 / CSS 生效来对比效果——给订阅前的访客直观感受 pack 能做什么。
 */

interface SampleEntry {
  role: "user" | "assistant";
  text: string;
}

const DEFAULT_SAMPLE_ROLES: SampleEntry["role"][] = [
  "assistant",
  "assistant",
  "assistant",
  "user",
  "assistant",
  "assistant",
];

interface Props {
  packId: string;
  packName: string;
  globalCss: string;
  rules: RegexRule[];
  openingComponents?: OpeningComponent[];
}

export function PackPreview({
  packId,
  packName,
  globalCss,
  rules,
  openingComponents = [],
}: Props) {
  const { dict } = useI18n();
  const hasCss = globalCss.trim().length > 0;

  const [cssOn, setCssOn] = useState(hasCss);
  // Default: every rule on. Map keyed by rule id; missing key = on.
  const [ruleOff, setRuleOff] = useState<Set<string>>(new Set());

  const enabledOpenings = useMemo(
    () => openingComponents.filter((c) => c.enabled),
    [openingComponents],
  );
  const [openingOn, setOpeningOn] = useState(true);

  function toggleRule(ruleId: string) {
    setRuleOff((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  }

  const activeRules = useMemo(
    () => rules.filter((r) => !ruleOff.has(r.id)),
    [rules, ruleOff],
  );

  // Rules with a targetText sample get appended so the visitor sees what
  // the rule actually does. Mirrors PreviewCanvas's logic minus the editor.
  const sampleMessages: UIMessage[] = useMemo(() => {
    const defaultSamples: SampleEntry[] =
      dict.packs.studioPreviewDefaultSampleTexts.map((text, index) => ({
        role: DEFAULT_SAMPLE_ROLES[index] ?? "assistant",
        text,
      }));
    const ruleSamples: SampleEntry[] = activeRules
      .filter((r) => r.targetText?.trim())
      .map((r) => ({
        role: "assistant" as const,
        text: r.targetText as string,
      }));
    const all = [...defaultSamples, ...ruleSamples];
    return all.map((sample, i) => ({
      id: `preview-${i}`,
      role: sample.role,
      parts: [{ type: "text", text: sample.text }],
    }));
  }, [activeRules, dict.packs.studioPreviewDefaultSampleTexts]);

  const scopeKey = `pack-preview-${packId}`;
  const scopedCss = useMemo(() => {
    if (!cssOn || !hasCss) return "";
    return sanitizeAndScopeCss(globalCss, scopeKey).css;
  }, [cssOn, hasCss, globalCss, scopeKey]);

  const mockCharacter = useMemo(
    () => ({
      id: packId,
      name: packName,
      avatarUrl: null,
      tags: [] as string[],
      bio: null,
    }),
    [packId, packName],
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-[var(--space-lg)] lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-[var(--space-md)]">
        {hasCss && (
          <div className="glass-card flex flex-col gap-[var(--space-sm)] p-[var(--space-md)]">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
              {dict.packs.detailPreviewCssLegend}
            </p>
            <label className="flex cursor-pointer items-center gap-[var(--space-sm)] text-sm text-text-primary">
              <input
                type="checkbox"
                checked={cssOn}
                onChange={(e) => setCssOn(e.target.checked)}
                className="accent-accent-primary"
              />
              {dict.packs.detailPreviewCssLabel}
            </label>
          </div>
        )}

        <div className="glass-card flex flex-col gap-[var(--space-sm)] p-[var(--space-md)]">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            {dict.packs.detailPreviewRulesLegend}
          </p>
          {rules.length === 0 ? (
            <p className="text-xs text-text-muted">
              {dict.packs.detailPreviewRulesEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-[var(--space-xs)]">
              {rules.map((rule) => {
                const checked = !ruleOff.has(rule.id);
                return (
                  <li key={rule.id}>
                    <label className="flex cursor-pointer items-start gap-[var(--space-sm)] text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRule(rule.id)}
                        className="mt-[3px] accent-accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{rule.name}</span>
                        {rule.outputGuidance && (
                          <span className="mt-[2px] block truncate text-xs text-text-muted">
                            {rule.outputGuidance}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {enabledOpenings.length > 0 && (
          <div className="glass-card flex flex-col gap-[var(--space-sm)] p-[var(--space-md)]">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
              {dict.opening.sectionTitle}
            </p>
            <label className="flex cursor-pointer items-center gap-[var(--space-sm)] text-sm text-text-primary">
              <input
                type="checkbox"
                checked={openingOn}
                onChange={(e) => setOpeningOn(e.target.checked)}
                className="accent-accent-primary"
              />
              {dict.packs.packPreviewShownCount.replace(
                "{n}",
                String(enabledOpenings.length),
              )}
            </label>
          </div>
        )}
      </aside>

      <div
        data-character-css={scopeKey}
        className="glass-card flex min-h-[520px] min-w-0 flex-col overflow-hidden"
      >
        {scopedCss && (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-sanitized + scope-prefixed
          <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
        )}
        <ChatStage
          stageBg={null}
          header={
            <>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-solid font-display-zh text-lg text-text-muted">
                {packName.slice(0, 1)}
              </span>
              <div className="flex flex-1 flex-col gap-[2px]">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-text-muted">
                  {dict.packs.detailPreviewTitle}
                </p>
                <h2 className="font-display-zh text-xl text-text-primary">
                  {packName}
                </h2>
              </div>
            </>
          }
          messages={[
            ...(openingOn && enabledOpenings.length > 0
              ? [
                  <div
                    key="opening-slot"
                    id="nj_opening_slot"
                    className="nj_opening_slot flex flex-col gap-[var(--space-md)]"
                  >
                    {enabledOpenings.map((c) => {
                      const route = routeOpeningContent(c.content);
                      if (route.kind === "html") {
                        return (
                          <MessageRenderer key={c.id} source={route.html} />
                        );
                      }
                      const srcdocs =
                        route.kind === "iframe"
                          ? [route.srcdoc]
                          : route.srcdocs;
                      return srcdocs.map((srcdoc, i) => (
                        <RegexIframe
                          key={`${c.id}-${i}`}
                          ruleId={`opening-${c.id}-${i}`}
                          ruleName={c.name}
                          // iframe 是独立 document，父文档的皮肤 <style> 进不去：
                          // 皮肤要拼进 srcdoc，宿主属性由 cssScope 挂到 iframe
                          // <body>（与生产 OpeningSlot 同一套修复，此前 no-op）。
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
                    })}
                  </div>,
                ]
              : []),
            ...sampleMessages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                rules={activeRules}
                isStreaming={false}
                history={[]}
                character={mockCharacter}
                userName="preview-user"
                userAvatarUrl={null}
                onSendMessage={() => {}}
              />
            )),
          ]}
          input={
            <div
              id="nj_chat_input_container"
              className="relative z-20 border-t border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-md)] md:px-[var(--space-xl)]"
            >
              <div className="mx-auto flex w-full max-w-[640px] items-end gap-[var(--space-sm)]">
                <textarea
                  disabled
                  rows={2}
                  placeholder={dict.packs.studioPreviewDisclaimer}
                  className="flex-1 resize-none rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-sm)] font-body-zh text-base leading-relaxed text-text-muted opacity-60"
                />
                <button
                  type="button"
                  disabled
                  className="rounded-[var(--radius-md)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent opacity-50"
                >
                  {dict.chat.sendButton}
                </button>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
