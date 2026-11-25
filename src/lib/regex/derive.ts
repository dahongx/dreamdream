/**
 * Tool-mode helper: derive a pattern + variableMapping from creator-pasted
 * target XML. v1 supports only the "code_component" tool type (XML with
 * named leaf tags). Symbol-match / text-style / content-filter come in W5.
 *
 * The output pattern is intentionally permissive — `\s*` between tags, lazy
 * `(.*?)` captures inside leaves — to tolerate whitespace drift in real AI
 * output. The capture order tracks document order of leaves.
 */

import { XMLParser } from "fast-xml-parser";

export interface DerivedPattern {
  pattern: string;
  variableMapping: Array<{ index: number; name: string; sample?: string }>;
  /** Root element name — useful for the output-guidance template */
  rootTag: string;
}

const RE_SAFE = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(s: string): string {
  return s.replace(RE_SAFE, "\\$&");
}

/**
 * Walk the target string looking for tag spans, in document order. Each
 * non-self-closing element is recorded; leaf elements become capture groups.
 *
 * We intentionally don't use fast-xml-parser's object representation here —
 * it loses ordering and discards mixed content. A small hand-rolled scan
 * keeps capture-group order stable for the variable-mapping pills.
 */
export function derivePatternFromTarget(target: string): DerivedPattern | null {
  if (!target.trim()) return null;

  // Sanity-check that fast-xml-parser can parse it. We don't use the result;
  // this is just to fail early on malformed input.
  try {
    new XMLParser().parse(target);
  } catch {
    return null;
  }

  const TAG_RE = /<\s*(\/?)([a-zA-Z_一-龥][\w一-龥-]*)\s*([^/>]*?)(\/?)>/g;
  type Span =
    | { type: "open"; tag: string; pos: number; end: number }
    | { type: "close"; tag: string; pos: number; end: number };
  const spans: Span[] = [];
  for (const m of target.matchAll(TAG_RE)) {
    const close = m[1] === "/";
    const selfClose = m[4] === "/";
    const tag = m[2];
    const pos = m.index ?? 0;
    const end = pos + m[0].length;
    if (selfClose) {
      spans.push({ type: "open", tag, pos, end });
      spans.push({ type: "close", tag, pos: end, end });
    } else if (close) {
      spans.push({ type: "close", tag, pos, end });
    } else {
      spans.push({ type: "open", tag, pos, end });
    }
  }
  if (spans.length === 0) return null;

  // First open tag is the root.
  const firstOpen = spans.find((s) => s.type === "open");
  if (!firstOpen) return null;
  const rootTag = firstOpen.tag;

  // Walk: emit pattern by alternating literal tag spans with `\s*` glue and
  // `(.*?)` for leaf bodies. A leaf = open immediately followed by close of
  // same tag. Otherwise we treat it as a container (literal in pattern).
  let pattern = "";
  const mapping: DerivedPattern["variableMapping"] = [];
  let captureIndex = 0;

  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    const next = spans[i + 1];
    if (
      s.type === "open" &&
      next &&
      next.type === "close" &&
      next.tag === s.tag
    ) {
      // Leaf — capture body
      const bodyStart = s.end;
      const bodyEnd = next.pos;
      const sample = target.slice(bodyStart, bodyEnd).trim();
      pattern += `<${escapeRegex(s.tag)}>\\s*(.*?)\\s*</${escapeRegex(s.tag)}>`;
      captureIndex += 1;
      mapping.push({
        index: captureIndex,
        name: s.tag,
        sample: sample || undefined,
      });
      i++; // consume the matching close
    } else if (s.type === "open") {
      pattern += `<${escapeRegex(s.tag)}>`;
    } else {
      pattern += `</${escapeRegex(s.tag)}>`;
    }
    if (i + 1 < spans.length) pattern += "\\s*";
  }

  return { pattern, variableMapping: mapping, rootTag };
}
