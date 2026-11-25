"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { RegexRule } from "@/lib/db/schema";

/**
 * 「新建会话」三卡选择器。决定当前 session 锁定的产物类型 + 可选目标 rule。
 *
 *   皮肤      → 迭代 pack.globalCss
 *   互动块    → 新建一个 regex_rule
 *   编辑已有  → 多轮打磨某条已有 rule
 *
 * 提交后回调 onPick，由 StudioLayout 真正调用 createStudioSessionAction。
 */

export type ChooserPick =
  | { type: "css" }
  | { type: "component" }
  | { type: "component"; targetRuleId: string }
  | { type: "opening" }
  | { type: "opening"; targetOpeningComponentId: string };

interface Props {
  open: boolean;
  rules: RegexRule[];
  onCancel: () => void;
  onPick: (pick: ChooserPick) => void;
  hasActiveSession: boolean;
}

type Mode = "menu" | "pick-rule";

export function NewSessionChooser({
  open,
  rules,
  onCancel,
  onPick,
  hasActiveSession,
}: Props) {
  const { dict } = useI18n();
  const t = dict.packs;
  const [mode, setMode] = useState<Mode>("menu");
  const [pickedRule, setPickedRule] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setMode("menu");
    setPickedRule(null);
  }

  function close() {
    reset();
    onCancel();
  }

  function pickCss() {
    reset();
    onPick({ type: "css" });
  }
  function pickBlock() {
    reset();
    onPick({ type: "component" });
  }
  function pickOpening() {
    reset();
    onPick({ type: "opening" });
  }
  function confirmEditPick() {
    if (!pickedRule) return;
    const targetRuleId = pickedRule;
    reset();
    onPick({ type: "component", targetRuleId });
  }

  return (
    <div
      id="nj_pack_studio_session_chooser"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-base/80 p-[var(--space-md)] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nj_pack_studio_session_chooser_title"
    >
      <div className="flex w-full max-w-3xl flex-col gap-[var(--space-lg)] rounded-[var(--radius-lg)] border border-border-subtle bg-bg-elevated p-[var(--space-xl)] shadow-2xl">
        <div className="flex flex-col gap-[var(--space-xs)]">
          <h2
            id="nj_pack_studio_session_chooser_title"
            className="font-display-zh text-2xl text-text-primary"
          >
            {t.studioSessionChooserTitle}
          </h2>
          {hasActiveSession && (
            <p className="mt-[var(--space-xs)] rounded-[var(--radius-sm)] border border-accent-amber/40 bg-accent-amber/10 px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-accent-amber">
              {t.studioSessionAutoDiscardWarn}
            </p>
          )}
        </div>

        {mode === "menu" ? (
          <div className="grid grid-cols-1 gap-[var(--space-md)] md:grid-cols-2">
            <ChooserCard
              dataType="css"
              title={t.studioSessionChooserSkinTitle}
              desc={t.studioSessionChooserSkinDesc}
              onClick={pickCss}
            />
            <ChooserCard
              dataType="component"
              title={t.studioSessionChooserBlockTitle}
              desc={t.studioSessionChooserBlockDesc}
              onClick={pickBlock}
            />
            <ChooserCard
              dataType="opening"
              title={dict.opening.chooserTitle}
              desc={dict.opening.chooserDesc}
              onClick={pickOpening}
            />
            <ChooserCard
              dataType="edit"
              title={t.studioSessionChooserEditTitle}
              desc={t.studioSessionChooserEditDesc}
              onClick={() => setMode("pick-rule")}
              disabled={rules.length === 0}
              disabledReason={t.studioSessionChooserPickRuleEmpty}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--space-md)]">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
              {t.studioSessionChooserPickRule}
            </p>
            <ul className="flex max-h-[40vh] flex-col gap-[var(--space-xs)] overflow-y-auto">
              {rules.map((rule) => (
                <li key={rule.id}>
                  <button
                    type="button"
                    onClick={() => setPickedRule(rule.id)}
                    className={`flex w-full items-center justify-between gap-[var(--space-sm)] rounded-[var(--radius-sm)] border px-[var(--space-md)] py-[var(--space-sm)] text-left text-sm transition-colors ${
                      pickedRule === rule.id
                        ? "border-accent-primary bg-accent-primary/10 text-text-primary"
                        : "border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                    }`}
                  >
                    <span className="truncate font-display-zh">
                      {rule.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {rule.visible
                        ? t.proposalRuleVisible
                        : t.proposalRuleHidden}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={mode === "pick-rule" ? () => setMode("menu") : close}
            className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            {mode === "pick-rule"
              ? t.studioSessionChooserBack
              : t.studioSessionChooserCancel}
          </button>
          {mode === "pick-rule" && (
            <button
              type="button"
              onClick={confirmEditPick}
              disabled={!pickedRule}
              className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-40"
            >
              {t.studioSessionChooserCreate}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChooserCard({
  dataType,
  title,
  desc,
  onClick,
  disabled,
  disabledReason,
}: {
  dataType: "css" | "component" | "edit" | "opening";
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      data-type={dataType}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className="nj_pack_studio_session_card flex h-full flex-col items-start gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/40 p-[var(--space-lg)] text-left transition-all hover:border-accent-primary hover:bg-accent-primary/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle disabled:hover:bg-surface-glass/40"
    >
      <h3 className="font-display-zh text-xl text-text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-text-muted">{desc}</p>
      {disabled && disabledReason && (
        <p className="mt-auto text-xs italic text-text-muted">
          {disabledReason}
        </p>
      )}
    </button>
  );
}
