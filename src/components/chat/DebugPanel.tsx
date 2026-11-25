"use client";

import { useI18n } from "@/i18n/client";
import type { DebugInfo } from "@/lib/chat/debug-meta";

/**
 * Debug panel — folded under each AI message, visible only when the chat
 * page's "Debug" toggle is ON. Surfaces what the chat pipeline saw and what
 * the regex pass did, so creators can answer "why isn't my component
 * rendering" without leaving the page.
 *
 * Data source: messages.debug_info jsonb (populated in /api/chat onFinish).
 * Fresh turns carry it via the useChat message-metadata channel; already-loaded
 * messages carry it via the chat page RSC. See DebugInfo in lib/chat/debug-meta.
 */

interface Props {
  debug: DebugInfo | null | undefined;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  cacheReadTokens?: number | null;
  cacheWriteTokens?: number | null;
  reasoningTokens?: number | null;
  costMillicents?: number | null;
  // CNY snapshot frozen at write time. Falls back to USD × 7.2 for pre-rate
  // messages that the migration backfill missed (shouldn't happen post-0020
  // but kept as a safety net so the panel never renders "$x / ¥—").
  costCnyMillicents?: number | null;
  latencyMs?: number | null;
}

function formatCost(
  millicents: number,
  cnyMillicents: number | null | undefined,
): string {
  const usd = millicents / 100_000;
  const cny = cnyMillicents != null ? cnyMillicents / 100_000 : usd * 7.2;
  return `$${usd.toFixed(4)} / ¥${cny.toFixed(4)}`;
}

function cacheHitRate(
  inputTokens: number | null | undefined,
  cacheReadTokens: number | null | undefined,
): string | null {
  if (!inputTokens || !cacheReadTokens) return null;
  return `${((cacheReadTokens / inputTokens) * 100).toFixed(1)}%`;
}

export function DebugPanel({
  debug,
  model,
  tokensIn,
  tokensOut,
  cacheReadTokens,
  cacheWriteTokens,
  reasoningTokens,
  costMillicents,
  costCnyMillicents,
  latencyMs,
}: Props) {
  const { dict } = useI18n();
  const t = dict.chat;
  if (!debug) return null;
  const hitRate = cacheHitRate(tokensIn, cacheReadTokens);
  return (
    <details className="group mt-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle/40 bg-bg-base/40 px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-muted">
      <summary className="flex cursor-pointer select-none list-none flex-wrap items-baseline gap-x-[var(--space-md)] gap-y-[2px] font-mono [&::-webkit-details-marker]:hidden">
        <span className="uppercase tracking-[0.2em]">
          <span
            aria-hidden="true"
            className="mr-[var(--space-xs)] inline-block transition-transform duration-[var(--dur-micro)] group-open:rotate-90"
          >
            ▸
          </span>
          {t.debugSummary}
        </span>
        {/* 关键指标直接亮在 summary 上 —— 创作者扫一眼延迟/token/命中数，
            不用逐条展开。 */}
        <span className="tabular-nums text-text-muted/80">
          {latencyMs == null ? "—" : `${latencyMs}ms`}
          {" · "}
          {tokensIn ?? "—"}/{tokensOut ?? "—"} tok
          {" · "}
          {debug.matchedRules.length}✓
        </span>
      </summary>
      <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-sm)]">
        <Section title={t.debugSectionRaw}>
          {/* 长输出限高内滚，不再把整个面板撑到一屏之外 */}
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-sm)] bg-bg-base/60 p-[var(--space-sm)] font-mono text-text-secondary">
            {debug.rawOutput}
          </pre>
        </Section>
        <Section
          title={`${t.debugSectionMatched} (${debug.matchedRules.length}${t.debugMatchedCountSuffix})`}
        >
          {debug.matchedRules.length === 0 ? (
            <p>—</p>
          ) : (
            <ul>
              {debug.matchedRules.map((m) => (
                <li key={m.id}>
                  <span className="text-semantic-success">✓</span> {m.name}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section
          title={`${t.debugSectionUnmatched} (${debug.unmatchedRules.length}${t.debugMatchedCountSuffix})`}
        >
          {debug.unmatchedRules.length === 0 ? (
            <p>—</p>
          ) : (
            <ul>
              {debug.unmatchedRules.map((m) => (
                <li key={m.id}>
                  <span className="text-text-disabled">✗</span> {m.name}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={t.debugSectionPerf}>
          <p>
            {t.debugTokensLabel}: {tokensIn ?? "—"} in / {tokensOut ?? "—"} out
          </p>
          {(cacheReadTokens || cacheWriteTokens) && (
            <p>
              {t.debugCacheLabel}: {cacheReadTokens ?? 0} read /{" "}
              {cacheWriteTokens ?? 0} write
              {hitRate && ` (${t.debugCacheHitRate}: ${hitRate})`}
            </p>
          )}
          {reasoningTokens ? (
            <p>
              {t.debugReasoningLabel}: {reasoningTokens}
            </p>
          ) : null}
          {costMillicents ? (
            <p>
              {t.debugCostLabel}:{" "}
              {formatCost(costMillicents, costCnyMillicents)}
            </p>
          ) : null}
          <p>
            {t.debugLatencyLabel}: {latencyMs == null ? "—" : `${latencyMs}ms`}
          </p>
          <p>
            {t.debugModelLabel}: {model ?? "—"}
          </p>
        </Section>
        <details className="rounded-[var(--radius-sm)] border border-border-subtle/30 p-[var(--space-xs)]">
          <summary className="cursor-pointer text-text-secondary">
            {t.debugSectionSystem}
          </summary>
          <pre className="mt-[var(--space-xs)] max-h-96 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-sm)] bg-bg-base/60 p-[var(--space-sm)] font-mono text-text-secondary">
            {debug.systemPrompt}
          </pre>
        </details>
      </div>
    </details>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-text-secondary">{title}</p>
      {children}
    </div>
  );
}
