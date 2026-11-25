/**
 * Mufy's public renderer protocol, transcribed from index.CJYEwf6c.js
 * (offset 3054400–3057200, inspected 2026-10-15).
 *
 * This is NOT Dearm's ordinary regex pipeline: source rule order and flags
 * matter, and generated replacements are protected from subsequent rules.
 * Apply the complete chain before routing the resulting document to the
 * existing iframe sandbox. This module neither executes HTML nor sanitizes it.
 * Native RegExp has no synchronous timeout: untrusted execution must happen
 * in a terminable worker, even with the allocation/match limits below.
 */

// Pure serialization is also used by the standalone migration CLI. Keep it
// independent of DOM sanitization, whose server implementation needs JSDOM assets.
export const MUFY_SOURCE_ENVELOPE_PREFIX = "MUFY_SOURCE_RULE_CHAIN_V1\n";
export function buildMufySourceRuleEnvelope(capture: unknown, roleId: string, skinCss = "") {
  if (skinCss.length > 1_048_576) throw new Error("source-skin-length-limit");
  const rules = prepareMufySourceRules(capture, roleId);
  if (!rules.length) return undefined;
  return {
    name: "Mufy 原站有序渲染规则",
    pattern: "/[\\s\\S]+/g",
    replacement: MUFY_SOURCE_ENVELOPE_PREFIX + JSON.stringify({ version: 1, roleId, rules, skinCss }),
    orderIndex: -90,
  };
}

export interface MufySourceRule {
  regexRuleId: string | number;
  ruleName: string;
  regPattern: string;
  replaceString: string;
  /** Editor metadata; the observed public renderer does not branch on it. */
  mode?: number;
}

export interface MufySourceRuleCapture {
  version: 1;
  roleId: string;
  capturedAt: string;
  captureScope: "normal-page-public-render-rules";
  responseCode: 200;
  responseDataWasNull: boolean;
  rules: MufySourceRule[];
}

export interface PreparedMufySourceRule {
  id: string;
  name: string;
  source: string;
  flags: string;
  replacement: string;
}

export interface MufySourceRuleLimits {
  maxRules: number;
  maxPatternLength: number;
  maxReplacementLength: number;
  maxTotalRuleLength: number;
  maxInputLength: number;
  maxOutputLength: number;
  maxMatchesPerRule: number;
  maxTotalMatches: number;
}

export const MUFY_SOURCE_RULE_LIMITS: Readonly<MufySourceRuleLimits> = {
  maxRules: 256,
  maxPatternLength: 32_768,
  maxReplacementLength: 1_048_576,
  maxTotalRuleLength: 4_194_304,
  maxInputLength: 1_048_576,
  maxOutputLength: 8_388_608,
  maxMatchesPerRule: 1_000,
  maxTotalMatches: 10_000,
};

const START = "\uE000";
const END = "\uE001";

export class MufySourceRuleError extends Error {
  constructor(
    public readonly code: string,
    public readonly ruleIndex?: number,
  ) {
    super(
      `Mufy source rules rejected: ${code}${ruleIndex === undefined ? "" : ` (rule ${ruleIndex})`}`,
    );
    this.name = "MufySourceRuleError";
  }
}

function limitsWith(
  overrides: Partial<MufySourceRuleLimits>,
): MufySourceRuleLimits {
  const limits = { ...MUFY_SOURCE_RULE_LIMITS, ...overrides };
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new MufySourceRuleError("invalid-limits");
  }
  return limits;
}

function hasMarker(value: string): boolean {
  return value.includes(START) || value.includes(END);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Shared business/staging gate: missing responses are never inferred as empty. */
export function assertMufySourceRuleResponse(
  value: unknown,
  now = Date.now(),
): void {
  if (
    !record(value) ||
    value.responseCode !== 200 ||
    typeof value.responseDataWasNull !== "boolean" ||
    !Array.isArray(value.rules) ||
    (value.responseDataWasNull && value.rules.length !== 0) ||
    typeof value.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(value.capturedAt)) ||
    Date.parse(value.capturedAt) > now + 5 * 60_000
  )
    throw new MufySourceRuleError("invalid-capture-response");
}

/** Fail the entire import, rather than silently omitting an invalid rule. */
export function prepareMufySourceRules(
  value: unknown,
  expectedRoleId: string,
  overrides: Partial<MufySourceRuleLimits> = {},
): PreparedMufySourceRule[] {
  const limits = limitsWith(overrides);
  if (
    !record(value) ||
    value.version !== 1 ||
    value.roleId !== expectedRoleId ||
    !expectedRoleId ||
    value.captureScope !== "normal-page-public-render-rules" ||
    typeof value.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(value.capturedAt)) ||
    !Array.isArray(value.rules)
  )
    throw new MufySourceRuleError("invalid-capture-binding");
  assertMufySourceRuleResponse(value);
  if (value.rules.length > limits.maxRules)
    throw new MufySourceRuleError("rule-count-limit");
  const ids = new Set<string>();
  let totalLength = 0;
  return value.rules.map((item: unknown, index: number) => {
    if (
      !record(item) ||
      !(
        (typeof item.regexRuleId === "string" && item.regexRuleId.length > 0) ||
        (typeof item.regexRuleId === "number" &&
          Number.isSafeInteger(item.regexRuleId) &&
          item.regexRuleId >= 0)
      ) ||
      typeof item.ruleName !== "string" ||
      typeof item.regPattern !== "string" ||
      typeof item.replaceString !== "string"
    )
      throw new MufySourceRuleError("invalid-rule", index);
    const id = String(item.regexRuleId);
    if (ids.has(id)) throw new MufySourceRuleError("duplicate-rule-id", index);
    ids.add(id);
    if (
      item.regPattern.length > limits.maxPatternLength ||
      item.replaceString.length > limits.maxReplacementLength
    )
      throw new MufySourceRuleError("rule-length-limit", index);
    totalLength += item.regPattern.length + item.replaceString.length;
    if (totalLength > limits.maxTotalRuleLength)
      throw new MufySourceRuleError("total-rule-length-limit", index);
    if (hasMarker(item.regPattern) || hasMarker(item.replaceString))
      throw new MufySourceRuleError("reserved-marker", index);
    let source = item.regPattern;
    let flags = "g";
    if (source.startsWith("/")) {
      const end = source.lastIndexOf("/");
      if (end < 1) throw new MufySourceRuleError("invalid-literal", index);
      flags = source.slice(end + 1) || "g";
      source = source.slice(1, end);
    }
    source = source.replaceAll("\\n", "\n").replaceAll("\\r", "\r");
    try {
      new RegExp(source, flags);
    } catch {
      throw new MufySourceRuleError("invalid-regexp", index);
    }
    return {
      id,
      name: item.ruleName,
      source,
      flags,
      replacement: item.replaceString,
    };
  });
}

export interface MufySourceRuleResult {
  html: string;
  matchedRules: Array<{ id: string; name: string; count: number }>;
  unmatchedRuleIds: string[];
}

/** Serialized prepared rules can be sent to a sandbox worker without eval. */
export function applyMufySourceRules(
  raw: string,
  rules: readonly PreparedMufySourceRule[],
  overrides: Partial<MufySourceRuleLimits> = {},
): MufySourceRuleResult {
  const limits = limitsWith(overrides);
  if (raw.length > limits.maxInputLength)
    throw new MufySourceRuleError("input-length-limit");
  if (raw.length > limits.maxOutputLength)
    throw new MufySourceRuleError("output-length-limit");
  if (hasMarker(raw)) throw new MufySourceRuleError("reserved-marker");
  if (rules.length > limits.maxRules)
    throw new MufySourceRuleError("rule-count-limit");
  let text = raw;
  let totalMatches = 0;
  let totalRuleLength = 0;
  const matchedRules: MufySourceRuleResult["matchedRules"] = [];
  const unmatchedRuleIds: string[] = [];
  for (const [index, rule] of rules.entries()) {
    totalRuleLength += rule.source.length + rule.replacement.length;
    if (
      rule.source.length > limits.maxPatternLength ||
      rule.replacement.length > limits.maxReplacementLength ||
      totalRuleLength > limits.maxTotalRuleLength
    )
      throw new MufySourceRuleError("rule-length-limit", index);
    if (hasMarker(rule.source) || hasMarker(rule.replacement))
      throw new MufySourceRuleError("reserved-marker", index);
    let regex: RegExp;
    try {
      regex = new RegExp(rule.source, rule.flags);
    } catch {
      throw new MufySourceRuleError("invalid-regexp", index);
    }
    const matches: Array<{
      start: number;
      length: number;
      replacement: string;
    }> = [];
    let inspected = 0;
    let nextLength = text.length;
    for (;;) {
      const match = regex.exec(text);
      if (!match) break;
      inspected++;
      if (inspected > limits.maxMatchesPerRule)
        throw new MufySourceRuleError("per-rule-match-limit", index);
      totalMatches++;
      if (totalMatches > limits.maxTotalMatches)
        throw new MufySourceRuleError("total-match-limit", index);
      // Source behavior: protect matches whose start lies in a generated region.
      const lastStart = text.lastIndexOf(START, match.index);
      const protectedEnd = lastStart < 0 ? -1 : text.indexOf(END, lastStart);
      if (!(lastStart >= 0 && protectedEnd >= match.index)) {
        const replacement = rule.replacement.replace(
          /\$(\d+)/g,
          (_, n: string) => match[Number(n)] || "",
        );
        nextLength += replacement.length + 2 - match[0].length;
        if (nextLength > limits.maxOutputLength)
          throw new MufySourceRuleError("output-length-limit", index);
        matches.push({
          start: match.index,
          length: match[0].length,
          replacement,
        });
      }
      // Unlike the original exec loop, non-global rules run once. Do not add
      // flags or repeat a match up to 1000 times. Zero-width matches advance.
      if (!regex.global && !regex.sticky) break;
      if (match[0].length === 0) {
        const point = text.codePointAt(regex.lastIndex);
        regex.lastIndex +=
          (regex.unicode || regex.flags.includes("v")) &&
          point !== undefined &&
          point > 0xffff
            ? 2
            : 1;
      }
    }
    for (let m = matches.length - 1; m >= 0; m--) {
      const match = matches[m];
      text =
        text.slice(0, match.start) +
        START +
        match.replacement +
        END +
        text.slice(match.start + match.length);
    }
    if (matches.length)
      matchedRules.push({
        id: rule.id,
        name: rule.name,
        count: matches.length,
      });
    else unmatchedRuleIds.push(rule.id);
  }
  return {
    html: text.replaceAll(START, "").replaceAll(END, ""),
    matchedRules,
    unmatchedRuleIds,
  };
}
