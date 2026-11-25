import type { Dict } from "@/i18n/types";
import type { RegexRule } from "@/lib/db/schema";
import {
  OFFICIAL_RULE_ENV_PANEL_ID,
  OFFICIAL_RULE_MEMORY_ID,
  OFFICIAL_RULE_YEARN_PHONE_ID,
} from "@/lib/packs/official-ids";
import { getRegexTemplates } from "@/lib/regex/templates";

const TEMPLATE_BY_RULE_ID: Readonly<Record<string, string>> = {
  [OFFICIAL_RULE_YEARN_PHONE_ID]: "yearn_phone_placeholder",
  [OFFICIAL_RULE_ENV_PANEL_ID]: "env_state_panel",
  [OFFICIAL_RULE_MEMORY_ID]: "dynamic_memory",
};

/**
 * Project shared official rules into one request locale without changing the
 * canonical DB row. Stable IDs/patterns and creator toggles remain untouched.
 */
export function localizeOfficialRules(
  rules: RegexRule[],
  dict?: Dict,
): RegexRule[] {
  if (!dict) return rules;
  const templates = getRegexTemplates(dict);
  const byId = new Map(templates.map((template) => [template.id, template]));

  return rules.map((rule) => {
    const templateId = TEMPLATE_BY_RULE_ID[rule.id];
    const preset = templateId ? byId.get(templateId)?.preset : undefined;
    if (!preset) return rule;
    return {
      ...rule,
      name: preset.name,
      targetText: preset.targetText,
      replacement: preset.replacement,
      variableMapping: preset.variableMapping,
      outputGuidance: preset.outputGuidance,
    };
  });
}
