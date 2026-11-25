/**
 * Streaming-safe wrapper around applyRegex.
 *
 * Problem: regex rules generally match closed XML constructs like
 * `<env>...</env>`. While the AI is still streaming, we may have only
 * `<env>13:37<` so far — running applyRegex on it would either fail to
 * match (correct behavior, but the user sees raw `<env>`) or partially
 * match (worse — visible flicker).
 *
 * Strategy: identify the safe prefix (everything up to the start of the
 * last possibly-incomplete open tag) and only apply rules to that prefix.
 * The unsafe tail is appended verbatim and gets a re-render on the next
 * chunk.
 *
 * "Possibly incomplete" = an unmatched `<` from the end of the buffer. We
 * locate the last `<` and ask: is there a `>` strictly after it? If not,
 * we cut there. If yes, we additionally check whether the surrounding
 * region is a balanced tag-and-content pair for any active rule (we keep
 * the cheap version in v1 — `lastIndexOf('<')` only).
 *
 * v1 trade-off: a creator who writes a pattern that targets bare text with
 * literal `<` inside it might see one extra render cycle. That's strictly
 * better than the flicker.
 */

import type { RegexRule } from "@/lib/db/schema";
import { type ApplyRegexOptions, applyRegex } from "./apply";

export interface StreamApplyResult {
  /** Fully-rendered prefix (regex pass applied). */
  rendered: string;
  /** Untouched tail — to be appended without sanitization for now. */
  tail: string;
}

export function applyRegexStreaming(
  buffer: string,
  rules: RegexRule[],
  options: ApplyRegexOptions = {},
): StreamApplyResult {
  const cut = findSafeBoundary(buffer);
  const safe = buffer.slice(0, cut);
  const tail = buffer.slice(cut);
  const out = applyRegex(safe, rules, options);
  return { rendered: out.text, tail };
}

/**
 * Return the index up to which applying regex is safe. Returns `buffer.length`
 * when no `<` ambiguity is in flight.
 */
export function findSafeBoundary(buffer: string): number {
  const lastLT = buffer.lastIndexOf("<");
  if (lastLT === -1) return buffer.length;
  // If there's a `>` after the last `<`, the tag is complete (e.g.
  // `<env>...</env>` ends with `>`), so the whole buffer is safe.
  const closeAfter = buffer.indexOf(">", lastLT);
  if (closeAfter !== -1) return buffer.length;
  // Otherwise cut at the last `<` — the tag is still streaming.
  return lastLT;
}

/**
 * Decide what to show for the streaming tail (the slice after findSafeBoundary).
 *
 * The tail is everything past the last unclosed `<`. When it starts with `<` it
 * is a partial tag still streaming (e.g. `<div cla`, `<span class="zero-com`).
 * Rendering that raw flashes broken markup at the end of the bubble until the
 * chunk completes ("爆代码"). Hiding it costs nothing — the tag renders correctly
 * once it closes on the next chunk. Plain-text tails (normal typing) pass through
 * so latency stays low.
 */
export function visibleStreamTail(tail: string): string {
  return tail.startsWith("<") ? "" : tail;
}
