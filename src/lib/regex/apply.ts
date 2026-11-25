/**
 * Single-pass regex rewriter (general-mode runtime).
 *
 * Contract:
 *   - Rules are applied in `order_index` ascending order
 *   - A rule is skipped when:
 *       * `enabled = false`, or
 *       * `visible = true` AND the user explicitly disabled it
 *   - Each rule is `new RegExp(pattern, 'gms')` with the user-supplied flags
 *     subset. `m` and `s` are forced on because the AI output is multi-line
 *     and creators almost always want `.` to match newlines inside short XML.
 *   - Captures `$1..$9` and `$<name>` work the same as `String.prototype.replace`
 *
 * Companion paths:
 *   - `applyRegexStreaming` (./stream.ts) trims at the last unclosed `<` so
 *     partial tags don't flicker during the SSE stream.
 *   - `applyRegexToSegments` (./segments.ts) returns a Segment array instead
 *     of one string — required for iframe-mode rules so each match gets its
 *     own React mount point.
 *   - No ReDoS sandboxing. We log a warning if a rule takes >50ms but let
 *     it finish. v1 trusts the creator.
 */

import type { RegexRule } from "@/lib/db/schema";
import {
  applyMufySourceRuleEnvelope,
  isMufySourceRuleEnvelope,
} from "@/lib/import/mufy-source-rule-envelope";

export interface ApplyRegexResult {
  text: string;
  matchedRules: Array<{ id: string; name: string; count: number }>;
  unmatchedRules: Array<{ id: string; name: string; reason: string }>;
}

export interface ApplyRegexOptions {
  /**
   * Per-user opt-outs for `visible=true` rules. Maps rule id → enabled flag.
   * Rules not present in the map keep their default (treated as ON).
   */
  userPrefs?: Map<string, boolean>;
  /** Time budget warning threshold in ms (default 50). */
  warnMs?: number;
}

export function applyRegex(
  raw: string,
  rules: RegexRule[],
  options: ApplyRegexOptions = {},
): ApplyRegexResult {
  const { userPrefs, warnMs = 50 } = options;
  const matchedRules: ApplyRegexResult["matchedRules"] = [];
  const unmatchedRules: ApplyRegexResult["unmatchedRules"] = [];

  const active = rules
    .filter((r) => {
      if (!r.enabled) return false;
      if (r.visible && userPrefs?.get(r.id) === false) return false;
      return true;
    })
    .sort((a, b) => a.orderIndex - b.orderIndex);

  let text = raw;
  for (const rule of active) {
    if (isMufySourceRuleEnvelope(rule.replacement)) {
      try {
        const result = applyMufySourceRuleEnvelope(text, rule.replacement);
        text = result.html;
        const count = result.matchedRules.reduce(
          (sum, item) => sum + item.count,
          0,
        );
        if (count) matchedRules.push({ id: rule.id, name: rule.name, count });
        else
          unmatchedRules.push({
            id: rule.id,
            name: rule.name,
            reason: "source rules did not match the model output",
          });
      } catch (error) {
        unmatchedRules.push({
          id: rule.id,
          name: rule.name,
          reason: `source rule chain rejected: ${(error as Error).message}`,
        });
      }
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

    const before = text;
    const startedAt = Date.now();
    let count = 0;
    try {
      text = before.replace(re, (...args) => {
        count++;
        // String.prototype.replace handles `$1..$9` substitution natively when
        // the replacement is a string, so we substitute by hand here using the
        // capture groups in `args[1..n]`. This avoids re-compiling and
        // re-running the regex per match (the previous approach), which was
        // O(matches²) in the worst case.
        const m = args[0] as string;
        // args layout: (match, p1, p2, ..., offset, fullString[, groups])
        // The last 2-3 entries (offset, fullString, optionally groups) aren't
        // captures. We slice off the tail conservatively.
        const tail = typeof args[args.length - 1] === "object" ? 3 : 2;
        const groups = args.slice(1, args.length - tail) as string[];
        return substituteCaptures(rule.replacement, m, groups);
      });
    } catch (err) {
      unmatchedRules.push({
        id: rule.id,
        name: rule.name,
        reason: `pattern execution error: ${(err as Error).message.slice(-240)}`,
      });
      continue;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed > warnMs) {
      console.warn(
        `[regex] rule ${rule.name} (${rule.id}) took ${elapsed}ms — possible ReDoS`,
      );
    }

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

  return { text, matchedRules, unmatchedRules };
}

/**
 * Build a RegExp from the creator-stored `pattern` string. Accepts either:
 *   - `/foo/giu` literal form (with leading `/` + trailing flags)
 *   - bare `foo` (no slashes) — flags default to `gms`
 *
 * Always forces `g` so replace-all works; adds `m` and `s` for multi-line AI
 * output unless the creator explicitly opts out via the literal form.
 */
export function buildRegExp(pattern: string): RegExp {
  const trimmed = pattern.trim();
  // Literal form: /body/flags. Body may contain newlines, so we match anything
  // (including newline) via [\s\S] instead of the /s flag (which TS only
  // recognises at ES2018+; we stay on ES2017 for the project).
  const literal = /^\/([\s\S]+)\/([a-z]*)$/.exec(trimmed);
  if (literal) {
    const [, body, flags] = literal;
    const finalFlags = flags.includes("g") ? flags : `g${flags}`;
    return new RegExp(body, finalFlags);
  }
  return new RegExp(trimmed, "gms");
}

/**
 * Hand-rolled numbered capture + `$&` substitution. Matches the subset of
 * JavaScript's `String.prototype.replace` semantics that the regex docs
 * promise creators (`$1`, `$2`, ..., `$&`); we leave named groups and `$$`
 * to the segments path which already inherits them via Drizzle-shaped HTML.
 */
function substituteCaptures(
  template: string,
  match: string,
  groups: string[],
): string {
  return template.replace(
    /\$(?:(&)|([1-9]\d*))/g,
    (_, whole: string, numbered: string) => {
      if (whole === "&") return match;
      const idx = Number(numbered) - 1;
      return groups[idx] ?? "";
    },
  );
}
