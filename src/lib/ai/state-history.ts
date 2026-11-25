import { stripStatusCards } from "@/lib/ai/adverb-antistick";

const STATE_START_MARKER = "<!-- DEARM_STATE_START -->";
const STATE_END_MARKER = "<!-- DEARM_STATE_END -->";

const MARKED_STATE_RE =
  /<!--\s*DEARM_STATE_START\s*-->[\s\S]*?(?:<!--\s*DEARM_STATE_END\s*-->|$)/gi;
const COMPLETE_MARKED_STATE_RE =
  /<!--\s*DEARM_STATE_START\s*-->[\s\S]*?<!--\s*DEARM_STATE_END\s*-->/i;
const COMPLETE_STATUS_CARD_RE =
  /<details\b[^>]*class\s*=\s*(?:"[^"]*status-card[^"]*"|'[^']*status-card[^']*')[^>]*>[\s\S]*?<\/details>/i;

const STATE_SIGNALS = [
  "好感度",
  "状态",
  "关系",
  "记忆",
  "亲密",
  "信任",
  "欲望",
] as const;

const STATE_CLASS_HINT_RE =
  /(?:^|[-_\s])(?:status|state|ui|box|bar|sys|suite|group|panel|wrapper|codex|bx|st)(?:$|[-_\s])/i;
const CONTAINER_TAG_RE = /<\/?(div|details|section)\b[^>]*>/gi;
const MIN_NARRATIVE_PREFIX_CHARS = 24;
const MAX_TRAILING_VISIBLE_CHARS = 24;

interface OpenContainer {
  tag: string;
  start: number;
  openEnd: number;
  className: string;
}

interface StateElementRange {
  start: number;
  end: number;
  complete: boolean;
}

interface MarkedStateRange extends StateElementRange {
  contentStart: number;
}

function visibleText(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|emsp);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classNameFromTag(tag: string): string {
  const match = tag.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return match?.[1] ?? match?.[2] ?? "";
}

function activeContainersAt(
  text: string,
  targetIndex: number,
): OpenContainer[] {
  const stack: OpenContainer[] = [];
  const tokens = new RegExp(CONTAINER_TAG_RE.source, "gi");

  for (;;) {
    const match = tokens.exec(text);
    if (!match || match.index >= targetIndex) break;
    const raw = match[0];
    const tag = match[1].toLowerCase();
    if (raw.startsWith("</")) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }
    stack.push({
      tag,
      start: match.index,
      openEnd: tokens.lastIndex,
      className: classNameFromTag(raw),
    });
  }

  return stack;
}

function matchingContainerEnd(
  text: string,
  container: OpenContainer,
): number | null {
  const tokens = new RegExp(CONTAINER_TAG_RE.source, "gi");
  tokens.lastIndex = container.openEnd;
  let depth = 1;

  for (;;) {
    const match = tokens.exec(text);
    if (!match) break;
    if (match[1].toLowerCase() !== container.tag) continue;
    if (match[0].startsWith("</")) depth--;
    else depth++;
    if (depth === 0) return tokens.lastIndex;
  }

  return null;
}

function findLastMarkedStateRange(text: string): MarkedStateRange | null {
  const startPattern = /<!--\s*DEARM_STATE_START\s*-->/gi;
  let latest: RegExpExecArray | null = null;
  for (;;) {
    const match = startPattern.exec(text);
    if (!match) break;
    latest = match;
  }
  if (!latest) return null;

  const contentStart = latest.index + latest[0].length;
  const endPattern = /<!--\s*DEARM_STATE_END\s*-->/gi;
  endPattern.lastIndex = contentStart;
  const endMatch = endPattern.exec(text);
  return {
    start: latest.index,
    contentStart,
    end: endMatch ? endPattern.lastIndex : text.length,
    complete: endMatch !== null,
  };
}

/**
 * A provider can stop after the affinity/core module is already closed but
 * while a later memory/log module is still streaming. In that case the core
 * values are safe to carry forward even though the whole state wrapper is not.
 */
function findCompletedCoreStateElement(
  text: string,
  stateRange: StateElementRange,
): StateElementRange | null {
  const affinityIndex = text.lastIndexOf("好感度", stateRange.end);
  if (affinityIndex < stateRange.start || affinityIndex >= stateRange.end) {
    return null;
  }

  const containers = activeContainersAt(text, affinityIndex).filter(
    (container) => container.start >= stateRange.start,
  );
  const ordered = [
    ...containers.filter((container) => container.tag === "details").reverse(),
    ...containers.filter((container) => container.tag !== "details").reverse(),
  ];

  for (const container of ordered) {
    const end = matchingContainerEnd(text, container);
    if (end === null || end > stateRange.end) continue;
    const block = text.slice(container.start, end);
    if (!block.includes("好感度")) continue;
    return { start: container.start, end, complete: true };
  }

  return null;
}

function partialStateWithCompletedCore(text: string): {
  state: StateElementRange;
  core: StateElementRange;
} | null {
  const marked = findLastMarkedStateRange(text);
  const state = marked ?? findTrailingLegacyStateElement(text);
  if (!state || state.complete) return null;
  const core = findCompletedCoreStateElement(text, state);
  return core ? { state, core } : null;
}

function hasStateShape(block: string, className: string): boolean {
  const distinctSignals = STATE_SIGNALS.filter((signal) =>
    block.includes(signal),
  ).length;
  if (distinctSignals < 2) return false;

  const structuralTags =
    block.match(/<(?:div|details|section)\b/gi)?.length ?? 0;
  return STATE_CLASS_HINT_RE.test(className) || structuralTags >= 3;
}

/**
 * Locate a legacy creator-defined state panel without depending on one CSS
 * class. The detector is deliberately conservative: the panel must be a
 * trailing container, follow meaningful narrative, and contain multiple
 * state-related signals. New replies use explicit DEARM_STATE markers.
 */
function findTrailingLegacyStateElement(
  text: string,
): StateElementRange | null {
  const affinityIndex = text.lastIndexOf("好感度");
  if (affinityIndex < 0) return null;

  const containers = activeContainersAt(text, affinityIndex);
  for (const container of containers) {
    if (
      visibleText(text.slice(0, container.start)).length <
      MIN_NARRATIVE_PREFIX_CHARS
    ) {
      continue;
    }

    const matchedEnd = matchingContainerEnd(text, container);
    const end = matchedEnd ?? text.length;
    const block = text.slice(container.start, end);
    if (!hasStateShape(block, container.className)) continue;

    if (
      matchedEnd !== null &&
      visibleText(text.slice(matchedEnd)).length > MAX_TRAILING_VISIBLE_CHARS
    ) {
      continue;
    }

    return {
      start: container.start,
      end,
      complete: matchedEnd !== null,
    };
  }

  return null;
}

function cleanAfterRemoval(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function hasCompleteStateSnapshot(text: string): boolean {
  if (!text) return false;
  if (COMPLETE_MARKED_STATE_RE.test(text)) return true;
  const legacy = findTrailingLegacyStateElement(text);
  if (legacy?.complete) return true;
  return COMPLETE_STATUS_CARD_RE.test(text);
}

export function hasUsableStateSnapshot(text: string): boolean {
  return (
    hasCompleteStateSnapshot(text) ||
    partialStateWithCompletedCore(text) !== null
  );
}

export function findLatestCompleteStateSnapshotIndex<
  T extends { role: string },
>(messages: readonly T[], getText: (message: T) => string): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    if (hasCompleteStateSnapshot(getText(message))) return i;
  }
  return -1;
}

export function findLatestUsableStateSnapshotIndex<T extends { role: string }>(
  messages: readonly T[],
  getText: (message: T) => string,
): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    if (hasUsableStateSnapshot(getText(message))) return i;
  }
  return -1;
}

/**
 * Shape the one state-bearing assistant turn retained for model history.
 * Storage and UI keep the raw reply; only model input receives this projection.
 */
export function retainUsableStateSnapshot(text: string): string {
  if (!text || hasCompleteStateSnapshot(text)) return text;

  const partial = partialStateWithCompletedCore(text);
  if (!partial) return stripHistoricalStateBlocks(text);

  const narrative = cleanAfterRemoval(text.slice(0, partial.state.start));
  const core = text.slice(partial.core.start, partial.core.end).trim();
  return cleanAfterRemoval(
    `${narrative}\n${STATE_START_MARKER}\n${core}\n${STATE_END_MARKER}`,
  );
}

/**
 * Remove recurring state UI only from older assistant history. The complete
 * response remains stored and rendered; this function only shapes model input.
 */
export function stripHistoricalStateBlocks(text: string): string {
  if (!text) return text;

  let out = text.replace(MARKED_STATE_RE, "");
  const legacy = findTrailingLegacyStateElement(out);
  if (legacy) {
    out = `${out.slice(0, legacy.start)}${out.slice(legacy.end)}`;
  }

  // Preserve the original class-specific fallback for panels without an
  // affinity field (for example group-chat or memory-only status cards).
  out = stripStatusCards(out);

  return cleanAfterRemoval(out);
}

export { STATE_END_MARKER, STATE_START_MARKER };
