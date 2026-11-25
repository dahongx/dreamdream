"use client";

import { Lightbulb, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { suggestionsSchema } from "@/lib/chat/reply-suggestions";

interface Props {
  sessionId: string;
  contextKey: string;
  disabled: boolean;
  onSend: (text: string) => boolean;
  onEdit: (text: string, isCurrent: () => boolean) => Promise<boolean>;
}

export function ReplySuggestions({
  sessionId,
  contextKey,
  disabled,
  onSend,
  onEdit,
}: Props) {
  const { dict } = useI18n();
  const labels = dict.chat.replySuggestions;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<"failed" | "limited" | null>(null);
  const [result, setResult] = useState<{
    key: string;
    values: string[];
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const currentKey = `${sessionId}:${contextKey}`;
  const latestKey = useRef(currentKey);
  latestKey.current = currentKey;
  const selecting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const values = result?.key === currentKey ? result.values : [];

  useEffect(() => {
    // This reset is tied to the conversation revision, including same-ID edits.
    latestKey.current = currentKey;
    setOpen(false);
    setResult(null);
    setError(null);
    setLoading(false);
    controller.current?.abort();
    controller.current = null;
    return () => {
      controller.current?.abort();
    };
  }, [currentKey]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  async function load() {
    if (disabled || controller.current) return;
    const request = new AbortController();
    const key = currentKey;
    controller.current = request;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chat/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
      });
      if (request.signal.aborted || latestKey.current !== key) return;
      if (!response.ok) {
        setError(response.status === 429 ? "limited" : "failed");
        return;
      }
      const payload = await response.json();
      const parsed = suggestionsSchema.safeParse(payload.suggestions);
      if (!parsed.success) throw new Error("Invalid suggestions");
      if (!request.signal.aborted && latestKey.current === key)
        setResult({ key, values: parsed.data });
    } catch {
      if (!request.signal.aborted && latestKey.current === key)
        setError("failed");
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setLoading(false);
      }
    }
  }

  async function select(text: string, edit: boolean) {
    if (disabled || selecting.current || result?.key !== latestKey.current)
      return;
    selecting.current = true;
    const selectedKey = currentKey;
    try {
      const accepted = edit
        ? await onEdit(text, () => latestKey.current === selectedKey)
        : onSend(text);
      if (accepted) {
        setOpen(false);
        if (!edit) trigger.current?.focus();
      }
    } finally {
      selecting.current = false;
    }
  }

  return (
    <>
      <button
        id="nj_reply_suggestions_button"
        ref={trigger}
        type="button"
        aria-label={labels.title}
        title={labels.title}
        aria-expanded={open}
        data-active={open || undefined}
        aria-controls="nj_reply_suggestions_panel"
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
          if (!open && !values.length) void load();
        }}
        className="nj_reply_suggestions_button order-1 m-[var(--space-xs)] flex min-h-11 min-w-11 shrink-0 self-end items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-primary data-[active]:bg-[color-mix(in_srgb,var(--text-primary)_15%,transparent)] data-[active]:text-text-primary disabled:opacity-50"
      >
        <Lightbulb size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <section
          id="nj_reply_suggestions_panel"
          aria-label={labels.title}
          aria-busy={loading}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              trigger.current?.focus();
            }
          }}
          className="nj_reply_suggestions_panel order-first min-w-0 basis-full p-[var(--space-sm)] text-text-primary"
        >
          {loading && (
            <output
              aria-label={labels.loading}
              className="flex min-h-20 items-center justify-center gap-[var(--space-sm)] p-[var(--space-sm)] text-sm"
            >
              <span
                className="ai-loading-dot motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span className="sr-only">{labels.loading}</span>
            </output>
          )}
          {error && (
            <div role="alert" className="p-[var(--space-sm)] text-sm">
              <p>{error === "limited" ? labels.limited : labels.failed}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="min-h-11 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent-primary"
              >
                {labels.retry}
              </button>
            </div>
          )}
          {!loading && !error && (
            <div className="nj_reply_suggestions_list grid max-h-[40dvh] auto-cols-[86%] grid-flow-col items-stretch snap-x snap-proximity gap-[var(--space-sm)] overflow-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:auto-cols-[44%]">
              {values.map((text) => (
                <div
                  key={text}
                  className="nj_reply_suggestion relative flex min-w-0 snap-start rounded-[var(--radius-md)] border border-border-strong bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] focus-within:border-accent-primary"
                >
                  <button
                    type="button"
                    title={labels.send}
                    aria-label={`${labels.send}: ${text}`}
                    onClick={() => void select(text, false)}
                    className="nj_reply_suggestion_send flex min-h-11 w-full items-start whitespace-pre-wrap break-words rounded-[var(--radius-md)] p-[var(--space-md)] pr-12 text-left text-base leading-relaxed [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-primary"
                  >
                    {text}
                  </button>
                  <button
                    type="button"
                    aria-label={labels.edit}
                    title={labels.edit}
                    onClick={() => void select(text, true)}
                    className="nj_reply_suggestion_edit absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-primary"
                  >
                    <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
