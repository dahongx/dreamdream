const STATE_START_RE = /<!--\s*DEARM_STATE_START\s*-->/gi;
const STATE_END_RE = /<!--\s*DEARM_STATE_END\s*-->/i;

interface StateRoot {
  markerStart: number;
  tagName: string;
  classes: string[];
  openStart: number;
}

export interface RepeatedStateCycleResult {
  text: string;
  changed: boolean;
  originalChars: number;
  keptChars: number;
  stateStartCount: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readStateRoot(
  text: string,
  markerStart: number,
  markerEnd: number,
): StateRoot | null {
  const tail = text.slice(markerEnd);
  const open = /<([A-Za-z][\w:-]*)\b([^>]*)>/.exec(tail);
  if (!open || open[0].startsWith("</") || open[0].endsWith("/>")) return null;
  if (tail.slice(0, open.index).trim()) return null;

  const classMatch = /\bclass\s*=\s*(["'])(.*?)\1/i.exec(open[2] ?? "");
  const classes = (classMatch?.[2] ?? "")
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort();

  // A classed root gives us a conservative structural identity. Bare tags are
  // too common to use as evidence that the model restarted a whole reply.
  if (classes.length === 0) return null;

  const openStart = markerEnd + open.index;
  return {
    markerStart,
    tagName: open[1].toLowerCase(),
    classes,
    openStart,
  };
}

function sameRoot(a: StateRoot, b: StateRoot): boolean {
  return a.tagName === b.tagName && a.classes.join(" ") === b.classes.join(" ");
}

function findRootEnd(text: string, root: StateRoot): number | null {
  const tag = escapeRegex(root.tagName);
  const tokenRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  tokenRe.lastIndex = root.openStart;
  let depth = 0;
  let match: RegExpExecArray | null = tokenRe.exec(text);

  while (match) {
    const token = match[0];
    if (/^<\//.test(token)) {
      depth -= 1;
      if (depth === 0) return match.index + token.length;
    } else if (!/\/\s*>$/.test(token)) {
      depth += 1;
    }
    match = tokenRe.exec(text);
  }

  return null;
}

/**
 * Gemini can occasionally restart a complete reply inside one generation:
 * narrative + state UI, narrative + state UI, ... . The creator-facing state
 * markers make that failure observable without inspecting private prose.
 *
 * Only truncate when at least two markers introduce the same classed root and
 * the first root is structurally complete. This deliberately leaves ordinary
 * replies, multi-panel state UIs, and incomplete streaming markup untouched.
 */
export function truncateRepeatedStateCycles(
  text: string,
): RepeatedStateCycleResult {
  const markers = [...text.matchAll(STATE_START_RE)];
  const unchanged = (): RepeatedStateCycleResult => ({
    text,
    changed: false,
    originalChars: text.length,
    keptChars: text.length,
    stateStartCount: markers.length,
  });

  if (markers.length < 2) return unchanged();

  const first = readStateRoot(
    text,
    markers[0].index,
    markers[0].index + markers[0][0].length,
  );
  const second = readStateRoot(
    text,
    markers[1].index,
    markers[1].index + markers[1][0].length,
  );
  if (!first || !second || !sameRoot(first, second)) return unchanged();

  const firstRootEnd = findRootEnd(text, first);
  if (firstRootEnd === null || firstRootEnd >= second.markerStart) {
    // The model restarted before closing the first state root. Keep the first
    // narrative, but drop the malformed state HTML and every restarted cycle.
    const narrativeOnly = text.slice(0, first.markerStart).trimEnd();
    if (!narrativeOnly) return unchanged();
    return {
      text: narrativeOnly,
      changed: true,
      originalChars: text.length,
      keptChars: narrativeOnly.length,
      stateStartCount: markers.length,
    };
  }

  const prefix = text.slice(0, firstRootEnd).trimEnd();
  const betweenCycles = text.slice(firstRootEnd, second.markerStart);
  const existingEnd = STATE_END_RE.exec(betweenCycles);
  const cleaned = existingEnd
    ? text
        .slice(0, firstRootEnd + existingEnd.index + existingEnd[0].length)
        .trimEnd()
    : `${prefix}\n<!-- DEARM_STATE_END -->`;

  return {
    text: cleaned,
    changed: true,
    originalChars: text.length,
    keptChars: cleaned.length,
    stateStartCount: markers.length,
  };
}
