/**
 * Segmented regex pipeline — chat render path.
 *
 * Walks the model output once, splitting it into a sequence of segments:
 *   - HtmlSegment      (default — sanitize + react-markdown route)
 *   - IframeSegment    (replacement wraps content in <artifact>...</artifact>,
 *                       carries srcdoc + capture groups for the host bridge)
 *
 * Auto-routing: the rule's substituted replacement is inspected; if it is
 * the form `<artifact>{srcdoc}</artifact>` (whitespace tolerant), the
 * segment becomes an IframeSegment with the inner srcdoc; otherwise it
 * stays HTML and flows through MessageRenderer like any other markdown.
 *
 * Why segments rather than a single HTML string: iframe-route rules need
 * stable React keys + host-API context per occurrence so we can target
 * messages back to the iframe via postMessage. Stuffing iframe HTML into a
 * single sanitized string would strip the <iframe>/<script> bits at render
 * time and break the contract.
 *
 * Rules without a `pattern` match in the input fall through unchanged.
 */

import type { RegexRule } from "@/lib/db/schema";
import {
  applyMufySourceRuleEnvelope,
  isMufySourceRuleEnvelope,
  splitMufySourceFrames,
} from "@/lib/import/mufy-source-rule-envelope";
import { buildRegExp } from "./apply";
import { artifactMinHeight } from "./artifact-size";

export type Segment =
  | { type: "html"; content: string }
  | {
      type: "iframe";
      ruleId: string;
      ruleName: string;
      srcdoc: string;
      captureGroups: string[];
      /** Source-native foldable components may shrink below the default. */
      minHeight?: number;
    };

export interface SegmentResult {
  segments: Segment[];
  matchedRules: Array<{ id: string; name: string; count: number }>;
  unmatchedRules: Array<{ id: string; name: string; reason: string }>;
}

export interface SegmentOptions {
  userPrefs?: Map<string, boolean>;
}

/** Matches a replacement whose entire body is a single <artifact>...</artifact>
 *  envelope. We only iframe-route when the replacement is *exclusively* an
 *  artifact — otherwise normal markdown rules (e.g. inline <artifact> mixed
 *  with surrounding text) should let MessageRenderer's component map handle
 *  routing instead. */
const ARTIFACT_ENVELOPE_RE = /^\s*<artifact>([\s\S]*)<\/artifact>\s*$/i;

/**
 * Apply rules to `raw` and produce a segment list. The substituted
 * replacement is inspected per match: a single `<artifact>...</artifact>`
 * envelope produces an IframeSegment carrying the inner srcdoc; anything
 * else is left as inline HTML that MessageRenderer will route via
 * react-markdown.
 */
export function applyRegexToSegments(
  raw: string,
  rules: RegexRule[],
  options: SegmentOptions = {},
): SegmentResult {
  const { userPrefs } = options;
  const matchedRules: SegmentResult["matchedRules"] = [];
  const unmatchedRules: SegmentResult["unmatchedRules"] = [];

  const active = rules
    .filter((r) => {
      if (!r.enabled) return false;
      if (r.visible && userPrefs?.get(r.id) === false) return false;
      return true;
    })
    .sort((a, b) => a.orderIndex - b.orderIndex);

  let segments: Segment[] = [{ type: "html", content: raw }];

  for (const rule of active) {
    if (isMufySourceRuleEnvelope(rule.replacement)) {
      let count = 0;
      let failure: string | undefined;
      segments = segments.flatMap((segment): Segment[] => {
        if (segment.type !== "html") return [segment];
        try {
          const result = applyMufySourceRuleEnvelope(
            segment.content,
            rule.replacement,
          );
          count += result.matchedRules.reduce(
            (sum, item) => sum + item.count,
            0,
          );
          // Do not route arbitrary pre-existing fences on a no-match result.
          if (!result.matchedRules.length) return [segment];
          return splitMufySourceFrames(result.html, result.skinCss).map(
            (part): Segment =>
              part.type === "html"
                ? part
                : {
                    type: "iframe",
                    ruleId: rule.id,
                    ruleName: rule.name,
                    srcdoc: part.srcdoc,
                    captureGroups: [],
                    minHeight: 1,
                  },
          );
        } catch (error) {
          failure = `source rule chain rejected: ${(error as Error).message}`;
          return [segment];
        }
      });
      if (count) matchedRules.push({ id: rule.id, name: rule.name, count });
      if (failure || !count)
        unmatchedRules.push({
          id: rule.id,
          name: rule.name,
          reason: failure ?? "source rules did not match the model output",
        });
      continue;
    }
    let re: RegExp;
    try {
      re = buildRegExp(rule.pattern);
    } catch (err) {
      unmatchedRules.push({
        id: rule.id,
        name: rule.name,
        reason: `pattern parse error: ${(err as Error).message}`,
      });
      continue;
    }

    let count = 0;
    const nextSegments: Segment[] = [];

    try {
      for (const seg of segments) {
        if (seg.type !== "html") {
          nextSegments.push(seg);
          continue;
        }
        let cursor = 0;
        // Reset the regex's lastIndex by allocating a fresh one (already
        // fresh from buildRegExp, but defensive)
        const localRe = new RegExp(re.source, re.flags);
        let m = localRe.exec(seg.content);
        while (m) {
          count++;
          const matchStart = m.index;
          const matchEnd = matchStart + m[0].length;
          if (matchStart > cursor) {
            nextSegments.push({
              type: "html",
              content: seg.content.slice(cursor, matchStart),
            });
          }
          const captureGroups = m.slice(1).map((g) => g ?? "");
          const substituted = substituteCaptures(rule.replacement, m);
          const artifact = ARTIFACT_ENVELOPE_RE.exec(substituted);
          if (artifact) {
            const minHeight = artifactMinHeight(artifact[1]);
            nextSegments.push({
              type: "iframe",
              ruleId: rule.id,
              ruleName: rule.name,
              srcdoc: artifact[1],
              captureGroups,
              ...(minHeight === undefined ? {} : { minHeight }),
            });
          } else {
            nextSegments.push({ type: "html", content: substituted });
          }
          cursor = matchEnd;
          // Guard against zero-width matches creating an infinite loop.
          if (matchEnd === matchStart) localRe.lastIndex = matchEnd + 1;
          m = localRe.exec(seg.content);
          if (!localRe.global) break;
        }
        if (cursor < seg.content.length) {
          nextSegments.push({
            type: "html",
            content: seg.content.slice(cursor),
          });
        }
      }
    } catch (err) {
      // V8 may compile lazily at exec(), even after construction succeeded.
      // Discard this rule's partial output, retaining prior rules and content.
      unmatchedRules.push({
        id: rule.id,
        name: rule.name,
        reason: `pattern execution error: ${(err as Error).message.slice(-240)}`,
      });
      continue;
    }
    segments = nextSegments;

    if (count > 0) {
      matchedRules.push({ id: rule.id, name: rule.name, count });
    } else {
      unmatchedRules.push({
        id: rule.id,
        name: rule.name,
        reason: "pattern did not match the model output",
      });
    }
  }

  return {
    segments: collapseAdjacentHtml(segments),
    matchedRules,
    unmatchedRules,
  };
}

function substituteCaptures(template: string, match: RegExpExecArray): string {
  return template.replace(/\$([1-9]\d*)/g, (_, n: string) => {
    const idx = Number(n);
    return match[idx] ?? "";
  });
}

function collapseAdjacentHtml(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && last.type === "html" && seg.type === "html") {
      out[out.length - 1] = {
        type: "html",
        content: last.content + seg.content,
      };
    } else {
      out.push(seg);
    }
  }
  return out;
}
