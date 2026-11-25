"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import {
  importExternalCssToPackAction,
  importExternalOpeningToPackAction,
  importExternalRulesToPackAction,
} from "@/lib/packs/import-actions";

/**
 * 「导入外部美化」弹框 —— 两步式：先选要搬哪一块（沿用来源平台的叫法），再上传/粘贴。
 * 导入成功后通过 onImported 回调通知 StudioLayout，由它关弹框 + 把预览切到对应视图
 * （「导入什么就看到什么」）。命名两边不同（正则=对话组件、全局美化=皮肤、
 * 小剧场=开场组件），故每项都标明「→ 寄情的 XX」。
 */
type Kind = "rules" | "css" | "opening";

export interface ExternalImported {
  kind: Kind;
  openingId?: string;
}

interface ImportChoice {
  kind: Kind;
  title: string;
  dest: string;
  desc: string;
}

const taCls =
  "w-full rounded-[var(--radius-sm)] border border-border-subtle bg-bg-base p-[var(--space-sm)] font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none";
const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-border-subtle bg-bg-base px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-primary focus:border-accent-primary focus:outline-none";
const primaryBtn =
  "self-start rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-xs font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-60";

export function ExternalImportDialog({
  packId,
  open,
  onClose,
  onImported,
}: {
  packId: string;
  open: boolean;
  onClose: () => void;
  onImported: (r: ExternalImported) => void;
}) {
  const { dict } = useI18n();
  const t = dict.packs;
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Kind | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const choices: ImportChoice[] = [
    {
      kind: "rules",
      title: t.studioImportRulesSourceName,
      dest: t.studioImportRulesDestinationName,
      desc: t.studioImportRulesDescription,
    },
    {
      kind: "css",
      title: t.studioImportCssSourceName,
      dest: t.studioImportCssDestinationName,
      desc: t.studioImportCssDescription,
    },
    {
      kind: "opening",
      title: t.studioImportOpeningSourceName,
      dest: t.studioImportOpeningDestinationName,
      desc: t.studioImportOpeningDescription,
    },
  ];

  // 每次打开都回到「选择」步骤
  useEffect(() => {
    if (open) {
      setStep(null);
      setText("");
      setName("");
      setErr(null);
    }
  }, [open]);

  if (!open) return null;

  const choice = choices.find((c) => c.kind === step);

  async function runRulesFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await importExternalRulesToPackAction(
        packId,
        await file.text(),
      );
      if (r.ok) onImported({ kind: "rules" });
      else setErr(t.studioImportFailed);
    } catch {
      setErr(t.studioImportFailed);
    }
    setBusy(false);
  }

  async function runPaste() {
    if (!text.trim() || !step) return;
    setBusy(true);
    setErr(null);
    try {
      if (step === "css") {
        const r = await importExternalCssToPackAction(packId, text);
        if (r.ok) onImported({ kind: "css" });
        else setErr(t.studioImportFailed);
      } else if (step === "opening") {
        const r = await importExternalOpeningToPackAction(packId, text, name);
        if (r.ok) onImported({ kind: "opening", openingId: r.data.id });
        else setErr(t.studioImportFailed);
      }
    } catch {
      setErr(t.studioImportFailed);
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-[var(--space-md)]">
      <button
        type="button"
        aria-label={t.studioImportDialogCloseAria}
        onClick={onClose}
        className="absolute inset-0 bg-bg-base/70 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[88vh] w-[min(560px,94vw)] flex-col gap-[var(--space-md)] overflow-y-auto rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated p-[var(--space-lg)] shadow-2xl">
        <div className="flex items-start justify-between gap-[var(--space-md)]">
          <div>
            <h2 className="font-display-zh text-lg text-text-primary">
              {t.studioImportDialogTitle}
            </h2>
            {step === null && (
              <p className="mt-[var(--space-xs)] text-xs leading-relaxed text-text-muted">
                {t.studioImportDialogIntro}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.studioImportDialogCloseAria}
            className="shrink-0 rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
          >
            ×
          </button>
        </div>

        {step === null ? (
          <div className="flex flex-col gap-[var(--space-sm)]">
            {choices.map((c) => (
              <button
                key={c.kind}
                type="button"
                onClick={() => setStep(c.kind)}
                className="flex flex-col gap-[2px] rounded-[var(--radius-sm)] border border-border-subtle p-[var(--space-md)] text-left transition-colors hover:border-accent-primary"
              >
                <span className="text-sm font-semibold text-text-primary">
                  {c.title}{" "}
                  <span className="text-xs font-normal text-accent-gold-soft">
                    {t.studioImportDestinationFmt
                      .replace("{brand}", dict.shell.brand)
                      .replace("{destination}", c.dest)}
                  </span>
                </span>
                <span className="text-[11px] leading-relaxed text-text-muted">
                  {c.desc}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--space-sm)]">
            <p className="text-[11px] leading-relaxed text-text-muted">
              {choice?.desc}
            </p>
            {step === "rules" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className={primaryBtn}
                >
                  {busy ? t.studioImportWorking : t.studioImportChooseJson}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={runRulesFile}
                />
              </>
            ) : (
              <>
                {step === "opening" && (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.studioImportOpeningNamePlaceholder}
                    className={inputCls}
                  />
                )}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder={
                    step === "css"
                      ? t.studioImportCssPastePlaceholder
                      : t.studioImportOpeningPastePlaceholder
                  }
                  className={taCls}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={runPaste}
                  className={primaryBtn}
                >
                  {busy ? t.studioImportWorking : t.studioImportAction}
                </button>
              </>
            )}
            {err && <p className="text-[11px] text-rose-400">{err}</p>}
            <button
              type="button"
              onClick={() => {
                setStep(null);
                setErr(null);
              }}
              className="self-start text-[11px] text-text-muted underline-offset-2 transition-colors hover:text-text-primary hover:underline"
            >
              {t.studioImportBackToChoices}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
