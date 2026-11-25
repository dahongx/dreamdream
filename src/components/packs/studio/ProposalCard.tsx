"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type {
  ProposalAddOpening,
  ProposalAddRule,
  ProposalSetGlobalCss,
} from "@/lib/packs/assistant-parser";

/**
 * 渲染 LLM 输出里的 <proposal> 块。creator 点 [应用] → 纯客户端 state
 * 同步（preview 立即反映），但**不写库**。要把改动落地，去顶部 [保存]。
 * 这样 creator 可以试探性应用多个 proposal 再统一保存或取消。
 */

type CardState = "pending" | "applied" | "dismissed";

interface AddRuleProps {
  payload: ProposalAddRule;
  onApplied: (payload: ProposalAddRule) => void;
  /** 若 true，标题显示「更新草稿」而非「新增组件」—— 用于多轮迭代场景 */
  iteration?: boolean;
  /** proposal 类型与当前会话类型不匹配 —— 禁用应用并提示 */
  mismatch?: boolean;
}

export function AddRuleCard({
  payload,
  onApplied,
  iteration,
  mismatch,
}: AddRuleProps) {
  const { dict } = useI18n();
  const t = dict.packs;
  const [state, setState] = useState<CardState>("pending");

  function onApply() {
    onApplied(payload);
    setState("applied");
  }

  return (
    <ProposalShell
      title={iteration ? t.proposalUpdateDraftTitle : t.proposalAddRuleTitle}
      subtitle={payload.name}
      state={state}
      mismatch={mismatch}
      onApply={onApply}
      onDismiss={() => setState("dismissed")}
    >
      {payload.description && (
        <p className="text-sm leading-relaxed text-text-secondary">
          {payload.description}
        </p>
      )}
      <details className="mt-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle/30 px-[var(--space-sm)] py-[var(--space-xs)]">
        <summary className="cursor-pointer select-none font-mono text-xs uppercase tracking-[0.15em] text-text-muted hover:text-text-secondary">
          {t.proposalTechDetails}
        </summary>
        <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-xs)]">
          <DetailRow
            label={t.proposalRulePattern}
            value={payload.pattern}
            mono
          />
          {payload.targetText && (
            <DetailRow
              label={t.proposalRuleTargetText}
              value={payload.targetText}
              mono
              truncate
            />
          )}
          <DetailRow
            label={t.proposalRuleReplacement}
            value={payload.replacement}
            mono
            truncate
          />
          {payload.outputGuidance && (
            <DetailRow
              label={t.proposalRuleGuidance}
              value={payload.outputGuidance}
            />
          )}
          <div className="flex gap-[var(--space-md)] text-xs text-text-muted">
            <span>
              {payload.visible ? t.proposalRuleVisible : t.proposalRuleHidden}
            </span>
          </div>
        </div>
      </details>
    </ProposalShell>
  );
}

interface AddOpeningProps {
  payload: ProposalAddOpening;
  onApplied: (payload: ProposalAddOpening) => void;
  iteration?: boolean;
  mismatch?: boolean;
}

export function AddOpeningCard({
  payload,
  onApplied,
  iteration,
  mismatch,
}: AddOpeningProps) {
  const { dict } = useI18n();
  const t = dict.packs;
  const [state, setState] = useState<CardState>("pending");

  function onApply() {
    onApplied(payload);
    setState("applied");
  }

  return (
    <ProposalShell
      title={iteration ? t.proposalUpdateDraftTitle : t.proposalAddOpeningTitle}
      subtitle={payload.name}
      state={state}
      mismatch={mismatch}
      onApply={onApply}
      onDismiss={() => setState("dismissed")}
    >
      {payload.description && (
        <p className="text-sm leading-relaxed text-text-secondary">
          {payload.description}
        </p>
      )}
      <details className="mt-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle/30 px-[var(--space-sm)] py-[var(--space-xs)]">
        <summary className="cursor-pointer select-none font-mono text-xs uppercase tracking-[0.15em] text-text-muted hover:text-text-secondary">
          {t.proposalTechDetails}
        </summary>
        <pre className="mt-[var(--space-sm)] max-h-48 overflow-auto rounded-[var(--radius-sm)] bg-bg-base/60 p-[var(--space-sm)] font-mono text-xs text-text-secondary">
          {payload.content}
        </pre>
      </details>
    </ProposalShell>
  );
}

interface SetGlobalCssProps {
  payload: ProposalSetGlobalCss;
  onApplied: (css: string) => void;
  mismatch?: boolean;
}

export function SetGlobalCssCard({
  payload,
  onApplied,
  mismatch,
}: SetGlobalCssProps) {
  const { dict } = useI18n();
  const t = dict.packs;
  const [state, setState] = useState<CardState>("pending");

  function onApply() {
    onApplied(payload.css);
    setState("applied");
  }

  return (
    <ProposalShell
      title={t.proposalSetCssTitle}
      subtitle={t.proposalSetCssSubtitle}
      state={state}
      mismatch={mismatch}
      onApply={onApply}
      onDismiss={() => setState("dismissed")}
    >
      <pre className="max-h-48 overflow-auto rounded-[var(--radius-sm)] bg-bg-base/60 p-[var(--space-sm)] font-mono text-xs text-text-secondary">
        {payload.css}
      </pre>
    </ProposalShell>
  );
}

export function ProposalErrorCard() {
  const { dict } = useI18n();
  return (
    <div className="rounded-[var(--radius-md)] border border-semantic-error/40 bg-semantic-error/10 p-[var(--space-md)] text-sm text-semantic-error">
      <p className="font-mono text-xs uppercase tracking-[0.2em]">
        {dict.packs.proposalErrorTitle}
      </p>
      <p className="mt-[var(--space-xs)]">{dict.packs.studioOperationFailed}</p>
    </div>
  );
}

interface ShellProps {
  title: string;
  subtitle?: string;
  state: CardState;
  mismatch?: boolean;
  onApply: () => void;
  onDismiss: () => void;
  children: React.ReactNode;
}

function ProposalShell({
  title,
  subtitle,
  state,
  mismatch,
  onApply,
  onDismiss,
  children,
}: ShellProps) {
  const { dict } = useI18n();
  const t = dict.packs;

  if (state === "dismissed") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-subtle/40 bg-bg-base/30 px-[var(--space-md)] py-[var(--space-xs)] text-xs italic text-text-muted">
        {t.proposalDismissed} · {title}
      </div>
    );
  }

  return (
    <div
      className={`rounded-[var(--radius-md)] border p-[var(--space-md)] ${
        state === "applied"
          ? "border-semantic-success/40 bg-semantic-success/5"
          : mismatch
            ? "border-semantic-error/30 bg-semantic-error/5"
            : "border-accent-primary/30 bg-accent-primary/5"
      }`}
    >
      <div className="flex items-start justify-between gap-[var(--space-md)]">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-primary">
            {title}
          </p>
          {subtitle && (
            <p className="mt-[var(--space-xs)] font-display-zh text-base text-text-primary">
              {subtitle}
            </p>
          )}
        </div>
        {state === "applied" && (
          <span className="shrink-0 rounded-[var(--radius-pill)] bg-semantic-success/20 px-[var(--space-sm)] py-[2px] text-xs text-semantic-success">
            ✓ {t.proposalStaged}
          </span>
        )}
      </div>
      <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-xs)]">
        {children}
      </div>
      {state !== "applied" && mismatch && (
        <p className="mt-[var(--space-md)] rounded-[var(--radius-sm)] border border-semantic-error/30 bg-semantic-error/10 px-[var(--space-sm)] py-[var(--space-xs)] text-xs leading-relaxed text-semantic-error">
          {t.proposalMismatch}
        </p>
      )}
      {state !== "applied" && !mismatch && (
        <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={onApply}
            className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
          >
            {t.proposalApply}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            {t.proposalDismiss}
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.15em] text-text-muted">
        {label}
      </p>
      <p
        className={`mt-[2px] text-sm text-text-secondary ${
          mono ? "font-mono" : "font-body-zh"
        } ${truncate ? "line-clamp-3" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
