interface MessagePartLike {
  type?: unknown;
  text?: unknown;
}

function messageText(parts: readonly unknown[]): string {
  return parts
    .filter(
      (part): part is MessagePartLike =>
        part !== null && typeof part === "object" && !Array.isArray(part),
    )
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

function firstUnclosedDetailsStart(text: string): number {
  const stack: number[] = [];
  const tagPattern = /<\/?details\b[^>]*>/gi;

  for (const match of text.matchAll(tagPattern)) {
    if (match[0].startsWith("</")) {
      stack.pop();
    } else if (match.index !== undefined) {
      stack.push(match.index);
    }
  }

  return stack[0] ?? -1;
}

const STATE_START_MARKER_RE = /<!--\s*DEARM_STATE_START\s*-->/i;
const STATE_SIGNAL_RE =
  /好感度|状态|关系|记忆|亲密|信任|欲望|affinity|status|relationship|memory|social|records?|data\s*&\s*log/i;

export type SafetyTruncationNoticePlacement =
  | "external"
  | "inside-state"
  | "none";

function hasMeaningfulVisiblePrefix(text: string): boolean {
  const visible = text
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .trim();
  return visible.length >= 24;
}

/**
 * A safety stop inside a trailing <details> panel usually means the narrative
 * already finished and only a status/memory panel was cut short. Browsers
 * repair the unclosed tags, so showing a whole-response warning is misleading.
 */
export function isTrailingPanelTruncation(parts: readonly unknown[]): boolean {
  const text = messageText(parts);
  const panelStart = firstUnclosedDetailsStart(text);
  return (
    panelStart >= 0 && hasMeaningfulVisiblePrefix(text.slice(0, panelStart))
  );
}

function isCompleteTrailingStatePanel(text: string): boolean {
  const marked = text.search(STATE_START_MARKER_RE);
  if (marked >= 0 && hasMeaningfulVisiblePrefix(text.slice(0, marked))) {
    return STATE_SIGNAL_RE.test(text.slice(marked));
  }

  const firstDetails = text.search(/<details\b/i);
  return (
    firstDetails >= 0 &&
    hasMeaningfulVisiblePrefix(text.slice(0, firstDetails)) &&
    STATE_SIGNAL_RE.test(text.slice(firstDetails))
  );
}

/**
 * Decide where a provider safety-stop notice belongs. A cut narrative keeps
 * the existing whole-response warning. Once generation has entered a trailing
 * state panel, the warning is local to that panel; fully closed state modules
 * need no warning even if only an outer wrapper/final marker is missing.
 */
export function safetyTruncationNoticePlacement(
  parts: readonly unknown[],
): SafetyTruncationNoticePlacement {
  const text = messageText(parts);
  if (isTrailingPanelTruncation(parts)) return "inside-state";
  if (isCompleteTrailingStatePanel(text)) return "none";
  return "external";
}

export function shouldShowSafetyTruncationNotice(
  parts: readonly unknown[],
): boolean {
  return safetyTruncationNoticePlacement(parts) === "external";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Render-only HTML: never stored, copied, edited, or sent back to the model. */
export function stateTruncationRenderSuffix(label: string): string {
  return `<p data-state-truncation-note="true" class="mt-[var(--space-sm)] rounded-[var(--radius-sm)] border border-semantic-warning/40 bg-semantic-warning/10 px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-semantic-warning" role="note">${escapeHtml(label)}</p>`;
}
