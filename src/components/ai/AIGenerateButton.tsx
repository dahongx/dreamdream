"use client";

import { useState } from "react";
import { ModelPicker } from "@/components/ai/ModelPicker";
import { ThinkingDots } from "@/components/ai/ThinkingDots";
import {
  CurrencySwitcher,
  type CurrencyType,
} from "@/components/chat/CurrencySwitcher";
import { InsufficientCurrencyModal } from "@/components/quota/InsufficientCurrencyModal";
import { useI18n } from "@/i18n/client";
import type { GeneratorType } from "@/lib/ai/generators/registry";
import { DEFAULT_MODEL_ID, type NimirModelId } from "@/lib/ai/models";

/**
 * Reusable "✨ AI 生成" button — opens a small dialog for a short
 * instruction, streams the response from /api/ai/generate, then exposes
 * "Apply / Regenerate / Close" so creators can refine the result before
 * overwriting their field.
 *
 * Why a custom dialog instead of <dialog>: we want live-updating text
 * during streaming plus rendering below the trigger button.
 */

interface Props {
  type: GeneratorType;
  /** Context passed to the registry resolver. */
  context?: Record<string, unknown>;
  /** Apply the generated text to the target field. */
  onApply: (text: string) => void;
  /** Optional custom button label. */
  label?: string;
  /** Optional custom modal title. */
  modalTitle?: string;
}

export function AIGenerateButton({
  type,
  context,
  onApply,
  label,
  modalTitle,
}: Props) {
  const { dict } = useI18n();
  const t = dict.aiGenerate;
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">(
    "idle",
  );
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<NimirModelId>(DEFAULT_MODEL_ID);
  const [currencyType, setCurrencyType] = useState<CurrencyType>("silver");
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientInfo, setInsufficientInfo] = useState<{
    currencyType: CurrencyType;
    required: number | null;
    balance: number | null;
  } | null>(null);

  async function run() {
    if (!prompt.trim()) return;
    setStatus("streaming");
    setOutput("");
    setError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          prompt,
          context: context ?? {},
          model: modelId,
          currencyType,
        }),
      });
      if (!res.ok) {
        if (res.status === 402) {
          const body = await res.json().catch(() => null);
          if (body?.error === "insufficient_currency") {
            setStatus("idle");
            setInsufficientInfo({
              currencyType: body.currencyType ?? currencyType,
              required: body.required ?? null,
              balance: body.balance ?? null,
            });
            setInsufficientOpen(true);
            return;
          }
        }
        throw new Error();
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("missing response body");
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setOutput(acc);
      }
      setStatus("done");
    } catch {
      setError(t.failed);
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setPrompt("");
    setOutput("");
    setStatus("idle");
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-sm)] border border-accent-primary/40 bg-accent-primary/10 px-[var(--space-md)] py-[2px] text-xs text-accent-primary transition-colors hover:bg-accent-primary/20"
      >
        {label ?? t.button}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-sm">
          <div className="flex w-full max-w-2xl flex-col gap-[var(--space-md)] rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated p-[var(--space-xl)]">
            <div className="flex items-start justify-between gap-[var(--space-md)]">
              <h3 className="font-display-zh text-lg text-text-primary">
                {modalTitle ?? t.modalTitle}
              </h3>
              <button
                type="button"
                onClick={close}
                className="text-sm text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={status === "streaming"}
              placeholder={t.promptPlaceholder}
              className="w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-sm)] text-base text-text-primary outline-none focus:border-border-strong"
            />
            <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
              <button
                type="button"
                onClick={run}
                disabled={status === "streaming" || !prompt.trim()}
                className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {status === "streaming" ? t.running : t.run}
              </button>
              {status === "done" && (
                <button
                  type="button"
                  onClick={() => {
                    onApply(output);
                    close();
                  }}
                  className="rounded-[var(--radius-sm)] border border-accent-primary/60 px-[var(--space-md)] py-[var(--space-xs)] text-sm text-accent-primary hover:bg-accent-primary/10"
                >
                  {t.apply}
                </button>
              )}
              {status === "done" && (
                <button
                  type="button"
                  onClick={run}
                  className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-sm text-text-muted hover:text-text-primary"
                >
                  {t.regenerate}
                </button>
              )}
              <span className="ml-auto flex items-center gap-[var(--space-xs)]">
                <ModelPicker
                  value={modelId}
                  onChange={setModelId}
                  size="xs"
                  disabled={status === "streaming"}
                />
                <CurrencySwitcher
                  storageKey="nj_currency_ai_generate_button"
                  modelId={modelId}
                  onChange={setCurrencyType}
                  disabled={status === "streaming"}
                />
              </span>
            </div>
            {status === "streaming" && !output && (
              <ThinkingDots label={t.running} align="bubble" tone="creative" />
            )}
            {output && (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] border border-border-subtle/50 bg-bg-base p-[var(--space-md)] font-mono text-xs text-text-secondary">
                {output}
              </pre>
            )}
            {error && (
              <p className="rounded-[var(--radius-sm)] border border-semantic-error/40 bg-semantic-error/10 p-[var(--space-sm)] text-xs text-semantic-error">
                {error}
              </p>
            )}
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
    </>
  );
}
