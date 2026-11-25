"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AIGenerateButton } from "@/components/ai/AIGenerateButton";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { useI18n } from "@/i18n/client";
import type { RegexRule } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/regex/actions";
import { buildRegExp } from "@/lib/regex/apply";
import { derivePatternFromTarget } from "@/lib/regex/derive";
import { applyRegexToSegments, type Segment } from "@/lib/regex/segments";
import { getRegexTemplates, type RegexTemplate } from "@/lib/regex/templates";

/**
 * Universal regex-rule form. Single path: creator gives an optional sample
 * of LLM output, the form auto-derives `pattern` + `variableMapping`, the
 * creator writes the replacement HTML and (optionally) outputGuidance.
 *
 * Layout: left column = editor (meta, pattern, replacement, guidance,
 * visibility), right column = live test panel that runs the chat
 * pipeline (applyRegexToSegments → MessageRenderer) against the single
 * rule the creator is currently editing.
 */

interface FormState {
  name: string;
  targetText: string;
  pattern: string;
  replacement: string;
  variableMapping: Array<{ index: number; name: string; sample?: string }>;
  outputGuidance: string;
  enabled: boolean;
  visible: boolean;
  orderIndex: number;
}

type ServerAction = (
  prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) => Promise<ActionResult<{ id: string }>>;

interface Props {
  action: ServerAction;
  initial?: RegexRule | null;
  submitLabel: string;
  cancelHref?: string;
  embedded?: boolean;
}

const labelCls = "block text-sm text-text-secondary mb-[var(--space-xs)]";
const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-sm)] text-base text-text-primary outline-none focus:border-border-strong";
const textareaCls = `${inputCls} font-mono text-sm leading-relaxed min-h-20 md:min-h-32`;
const sectionCls =
  "glass-card flex flex-col gap-[var(--space-sm)] p-[var(--space-md)] md:gap-[var(--space-md)] md:p-[var(--space-lg)]";

function FieldError({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return <p className="text-xs text-semantic-error">{message}</p>;
}

export function RegexForm({
  action,
  initial,
  submitLabel,
  cancelHref,
  embedded = false,
}: Props) {
  const { dict } = useI18n();
  const t = dict.regex;
  const templates = useMemo(() => getRegexTemplates(dict), [dict]);
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);
  const errs = state && !state.ok ? state.fieldErrors : undefined;
  const formFailed = state?.ok === false;

  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? "",
    targetText: initial?.targetText ?? "",
    pattern: initial?.pattern ?? "",
    replacement: initial?.replacement ?? "",
    variableMapping: initial?.variableMapping ?? [],
    outputGuidance: initial?.outputGuidance ?? "",
    enabled: initial?.enabled ?? true,
    visible: initial?.visible ?? false,
    orderIndex: initial?.orderIndex ?? 0,
  });

  const [testInput, setTestInput] = useState(initial?.targetText ?? "");
  const [showTemplates, setShowTemplates] = useState(false);

  // Replacement textarea ref — used by the variable-pill click-to-insert.
  const replacementRef = useRef<HTMLTextAreaElement | null>(null);

  function insertIntoReplacement(snippet: string) {
    const el = replacementRef.current;
    if (!el) {
      set("replacement", form.replacement + snippet);
      return;
    }
    const start = el.selectionStart ?? form.replacement.length;
    const end = el.selectionEnd ?? form.replacement.length;
    const next =
      form.replacement.slice(0, start) + snippet + form.replacement.slice(end);
    set("replacement", next);
    // Restore caret after React re-renders.
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  // Auto-derive pattern + variableMapping from `targetText` whenever the
  // creator hasn't typed a pattern manually. The derived pair stays in sync;
  // once the creator edits `pattern`, we leave both fields alone so the $1/$2
  // pills always match what's running.
  useEffect(() => {
    if (!form.targetText) return;
    const derived = derivePatternFromTarget(form.targetText);
    if (!derived) return;
    setForm((f) => {
      if (f.pattern) return f;
      return {
        ...f,
        pattern: derived.pattern,
        variableMapping: derived.variableMapping,
      };
    });
  }, [form.targetText]);

  // Live test-panel evaluation — mirrors the chat pipeline:
  //   applyRegexToSegments → MessageRenderer
  // (iframe segments are shown as a clear "iframe sandbox" placeholder
  // since we can't safely mount a real iframe inside the editor without
  // a full host bridge — and the bridge wouldn't have history / character
  // context to feed in any meaningful way here).
  const testResult = useMemo(() => {
    const emptyMatched: Array<{ id: string; name: string; count: number }> = [];
    const emptyUnmatched: Array<{ id: string; name: string; reason: string }> =
      [];

    if (!form.pattern || !testInput) {
      return {
        segments: [{ type: "html", content: testInput }] as Segment[],
        matchedRules: emptyMatched,
        unmatchedRules: emptyUnmatched,
      };
    }
    try {
      buildRegExp(form.pattern);
    } catch (err) {
      return {
        segments: [{ type: "html", content: testInput }] as Segment[],
        matchedRules: emptyMatched,
        unmatchedRules: [
          {
            id: "_form",
            name: t.currentRuleLabel,
            reason: (err as Error).message,
          },
        ],
      };
    }
    const ruleStub: RegexRule = {
      id: initial?.id ?? "_draft",
      packId: initial?.packId ?? "_draft",
      name: form.name || t.draftNameFallback,
      targetText: form.targetText || null,
      pattern: form.pattern,
      replacement: form.replacement,
      variableMapping: form.variableMapping,
      outputGuidance: form.outputGuidance || null,
      enabled: true,
      visible: form.visible,
      orderIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return applyRegexToSegments(testInput, [ruleStub]);
  }, [
    form.pattern,
    form.replacement,
    form.targetText,
    form.variableMapping,
    form.outputGuidance,
    form.name,
    form.visible,
    testInput,
    initial?.id,
    initial?.packId,
    t.currentRuleLabel,
    t.draftNameFallback,
  ]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyTemplate(id: string) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setForm({ ...tpl.preset });
    setTestInput(tpl.preset.targetText);
    setShowTemplates(false);
  }

  return (
    <form
      action={formAction}
      className={
        embedded
          ? "grid w-full grid-cols-1 gap-[var(--space-md)] md:gap-[var(--space-lg)] xl:grid-cols-[1.35fr_1fr]"
          : "mx-auto grid w-full max-w-[var(--content-max-width)] grid-cols-1 gap-[var(--space-md)] p-0 md:gap-[var(--space-lg)] md:p-[var(--space-xl)] lg:grid-cols-[1.4fr_1fr]"
      }
    >
      {/* hidden mirror inputs so the form posts the same state as our React mirror */}
      <input
        type="hidden"
        name="variableMapping"
        value={JSON.stringify(form.variableMapping)}
      />
      <input type="hidden" name="enabled" value={form.enabled ? "true" : ""} />
      <input type="hidden" name="visible" value={form.visible ? "true" : ""} />

      <div className="flex flex-col gap-[var(--space-md)] md:gap-[var(--space-lg)]">
        {/* Meta */}
        <fieldset className={sectionCls}>
          <legend className="font-display-zh text-base text-text-primary md:text-lg">
            {t.sectionMetaLegend}
          </legend>

          <div>
            <label className={labelCls} htmlFor="name">
              {t.nameLabel}
            </label>
            <input
              id="name"
              name="name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputCls}
            />
            <FieldError
              show={Boolean(errs?.name?.length)}
              message={t.formFieldInvalid}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
            <p className="text-xs text-text-muted">{t.targetTextHint}</p>
            <div className="flex flex-wrap gap-[var(--space-xs)]">
              <AIGenerateButton
                type="target-text"
                onApply={(out) => {
                  set("targetText", out);
                  setTestInput(out);
                }}
                label={t.aiTargetTextButton}
                modalTitle={t.aiTargetTextModalTitle}
              />
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[2px] text-xs text-text-muted hover:border-border-strong hover:text-text-primary"
              >
                {t.loadTemplateButton}
              </button>
            </div>
          </div>
          {showTemplates && (
            <TemplatePicker
              templates={templates}
              onPick={applyTemplate}
              onClose={() => setShowTemplates(false)}
            />
          )}
          <div>
            <label className={labelCls} htmlFor="targetText">
              {t.targetTextLabel}
            </label>
            <textarea
              id="targetText"
              name="targetText"
              value={form.targetText}
              onChange={(e) => {
                set("targetText", e.target.value);
                if (!testInput) setTestInput(e.target.value);
              }}
              rows={4}
              className={textareaCls}
            />
          </div>
        </fieldset>

        {/* Pattern + Replacement */}
        <fieldset className={sectionCls}>
          <legend className="font-display-zh text-base text-text-primary md:text-lg">
            {t.sectionPatternLegend}
          </legend>

          <div>
            <label className={labelCls} htmlFor="pattern">
              {t.patternLabel}
            </label>
            <textarea
              id="pattern"
              name="pattern"
              required
              value={form.pattern}
              onChange={(e) => set("pattern", e.target.value)}
              rows={3}
              className={textareaCls}
            />
            <p className="mt-[var(--space-xs)] text-xs text-text-muted">
              {t.patternHint}
            </p>
            <FieldError
              show={Boolean(errs?.pattern?.length)}
              message={t.formFieldInvalid}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
              <label className={labelCls} htmlFor="replacement">
                {t.replacementLabel}
              </label>
              <AIGenerateButton
                type="replacement-html"
                context={{
                  targetText: form.targetText,
                  variableMapping: form.variableMapping,
                }}
                onApply={(out) => set("replacement", out)}
                label={t.aiReplacementButton}
                modalTitle={t.aiReplacementModalTitle}
              />
            </div>
            {form.variableMapping && form.variableMapping.length > 0 && (
              <div className="mb-[var(--space-xs)] flex flex-wrap gap-[var(--space-xs)]">
                {form.variableMapping.map((v) => (
                  <button
                    key={v.index}
                    type="button"
                    onClick={() => insertIntoReplacement(`$${v.index}`)}
                    title={
                      v.sample ? `${t.samplePrefix}${v.sample}` : undefined
                    }
                    className="rounded-[var(--radius-pill)] bg-accent-primary/15 px-[var(--space-sm)] py-[2px] font-mono text-xs text-accent-primary transition-colors hover:bg-accent-primary/30"
                  >
                    ${v.index} {v.name}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={replacementRef}
              id="replacement"
              name="replacement"
              value={form.replacement}
              onChange={(e) => set("replacement", e.target.value)}
              rows={6}
              className={textareaCls}
            />
            <p className="mt-[var(--space-xs)] text-xs text-text-muted">
              {t.replacementHint}
            </p>
          </div>
        </fieldset>

        {/* Guidance */}
        <fieldset className={sectionCls}>
          <legend className="font-display-zh text-base text-text-primary md:text-lg">
            {t.sectionGuidanceLegend}
          </legend>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
              <label className={labelCls} htmlFor="outputGuidance">
                {t.outputGuidanceLabel}
              </label>
              <AIGenerateButton
                type="output-guidance"
                context={{
                  targetText: form.targetText,
                  replacementHint: form.replacement.slice(0, 400),
                }}
                onApply={(out) => set("outputGuidance", out)}
                label={t.aiGuidanceButton}
                modalTitle={t.aiGuidanceModalTitle}
              />
            </div>
            <textarea
              id="outputGuidance"
              name="outputGuidance"
              value={form.outputGuidance}
              onChange={(e) => set("outputGuidance", e.target.value)}
              rows={4}
              className={textareaCls}
            />
            <p className="mt-[var(--space-xs)] text-xs text-text-muted">
              {t.outputGuidanceHint}
            </p>
          </div>
        </fieldset>

        {/* Visibility + order */}
        <fieldset className={sectionCls}>
          <legend className="font-display-zh text-base text-text-primary md:text-lg">
            {t.sectionVisibilityLegend}
          </legend>
          <div className="flex flex-wrap items-center gap-[var(--space-lg)]">
            <label className="flex items-center gap-[var(--space-xs)] text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
              />
              {t.enabledLabel}
            </label>
            <label className="flex items-center gap-[var(--space-xs)] text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) => set("visible", e.target.checked)}
              />
              {t.visibleLabel}
            </label>
            <div className="flex items-center gap-[var(--space-xs)]">
              <span className="text-sm text-text-secondary">
                {t.orderLabel}
              </span>
              <input
                type="number"
                name="orderIndex"
                min={0}
                max={9999}
                value={form.orderIndex}
                onChange={(e) => set("orderIndex", Number(e.target.value) || 0)}
                className={`${inputCls} w-24`}
              />
            </div>
          </div>
        </fieldset>

        {formFailed && (
          <p className="text-sm text-semantic-error">{t.formSaveFailed}</p>
        )}
        <div className="flex flex-wrap justify-end gap-[var(--space-sm)]">
          {cancelHref && (
            <a
              href={cancelHref}
              className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-lg)] py-[var(--space-sm)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {t.cancelEdit}
            </a>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
          >
            {isPending ? t.submitting : submitLabel}
          </button>
        </div>
      </div>

      {/* Test panel */}
      <aside className="flex flex-col gap-[var(--space-md)]">
        <div className={sectionCls}>
          <h2 className="font-display-zh text-base text-text-primary md:text-lg">
            {t.testPanelTitle}
          </h2>
          <div>
            <label className={labelCls} htmlFor="testInput">
              {t.testPanelInputLabel}
            </label>
            <textarea
              id="testInput"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={6}
              className={textareaCls}
            />
          </div>
          <div>
            <p className={labelCls}>{t.testPanelOutputLabel}</p>
            <div className="flex min-h-32 flex-col gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle bg-bg-elevated p-[var(--space-md)] text-sm text-text-primary">
              {testResult.segments.map((seg, i) => {
                if (seg.type === "html") {
                  // Mirror the chat pipeline: MessageRenderer is the same
                  // sanitize + react-markdown + components-map boundary the
                  // production chat surface uses, so the preview catches the
                  // same drift / typos a creator would see in real chat.
                  return (
                    <MessageRenderer
                      // biome-ignore lint/suspicious/noArrayIndexKey: segment order is stable per preview render
                      key={i}
                      source={seg.content}
                    />
                  );
                }
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: segment order is stable per preview render
                    key={i}
                    className="rounded-[var(--radius-sm)] border border-dashed border-accent-primary/40 bg-accent-primary/5 p-[var(--space-sm)] font-mono text-xs text-text-muted"
                  >
                    <p className="font-display-zh text-accent-primary">
                      {t.iframeSandboxLabel}
                      {seg.ruleName}
                    </p>
                    <p className="mt-[var(--space-xs)]">
                      {t.iframeSandboxHint} {t.captureGroupsLabel}：[
                      {seg.captureGroups
                        .map((g) => JSON.stringify(g))
                        .join(", ")}
                      ]
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-md)] text-xs text-text-muted">
            <div>
              <p className="text-text-secondary">{t.testPanelMatchedLabel}</p>
              {testResult.matchedRules.length === 0 ? (
                <p>—</p>
              ) : (
                <ul>
                  {testResult.matchedRules.map((m) => (
                    <li key={m.id}>
                      ✓ {m.name} × {m.count}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-text-secondary">{t.testPanelUnmatchedLabel}</p>
              {testResult.unmatchedRules.length === 0 ? (
                <p>—</p>
              ) : (
                <ul>
                  {testResult.unmatchedRules.map((m) => (
                    <li key={m.id}>
                      ✗ {m.name}: {m.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}

function TemplatePicker({
  templates,
  onPick,
  onClose,
}: {
  templates: RegexTemplate[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.regex;
  return (
    <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-bg-elevated p-[var(--space-md)]">
      <div className="mb-[var(--space-sm)] flex items-center justify-between">
        <p className="font-display-zh text-sm text-text-primary">
          {t.templatePickerTitle}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          {t.templateClose}
        </button>
      </div>
      <div className="grid gap-[var(--space-sm)]">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onPick(tpl.id)}
            className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass p-[var(--space-md)] text-left transition-colors hover:border-border-strong"
          >
            <p className="font-display-zh text-sm text-text-primary">
              {tpl.label}
            </p>
            <p className="mt-[var(--space-xs)] text-xs text-text-muted">
              {tpl.hint}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
