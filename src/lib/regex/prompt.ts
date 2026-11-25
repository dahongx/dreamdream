/**
 * System-prompt fragment builder for enabled regex_rules.
 *
 * Renders the creator-output extension section that teaches the LLM when/how to
 * emit each creator-defined short-XML tag. Only rules with non-empty
 * `output_guidance` and `enabled = true` participate.
 *
 * It is inserted inside the canonical master's OutputSetting role section,
 * immediately after Dearm's host tag contract and creator-authored settings.
 */

import type { RegexRule } from "@/lib/db/schema";

export const REGEX_GUIDANCE_HEADING = "## Creator-defined output extensions";

/**
 * Produce the one authoritative rule set for both prompt guidance and output
 * rendering. A visible rule disabled by this user must not continue steering
 * the model while being hidden by the renderer.
 */
export function filterRulesForUser(
  rules: RegexRule[],
  userPrefs: ReadonlyMap<string, boolean>,
): RegexRule[] {
  return rules.filter(
    (rule) =>
      rule.enabled && (!rule.visible || userPrefs.get(rule.id) !== false),
  );
}

export function buildRegexGuidanceSection(rules: RegexRule[]): string | null {
  const enabled = rules.filter(
    (r) => r.enabled && r.outputGuidance && r.outputGuidance.trim(),
  );
  if (enabled.length === 0) return null;

  return [
    REGEX_GUIDANCE_HEADING,
    "The creator enabled the following custom output tags for this conversation. Each rule explains exactly when and how to emit its tag:",
    "1. When the player's input clearly matches a rule's trigger scenario, you **must** emit that rule's tag so Dearm can render the component. Do not replace the required component with ordinary <narration> or <message> text.",
    "2. When the current input is unrelated to a rule's trigger, do **not** force that tag into the reply. No trigger means no component.",
    "3. Preserve every tag name, attribute, code fragment, placeholder, and selector exactly as supplied by the creator.",
    "",
    enabled
      .map((r) => {
        const lines = [`### ${r.name}`, (r.outputGuidance as string).trim()];
        const tt = r.targetText?.trim();
        if (tt) {
          lines.push(`Required structural example:\n${tt}`);
        }
        return lines.join("\n\n");
      })
      .join("\n\n"),
  ].join("\n");
}
