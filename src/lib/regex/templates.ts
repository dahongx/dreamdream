/**
 * Built-in regex templates exposed via "Load template" in RegexForm.
 *
 * Canonical IDs, tag grammar, capture groups, replacement selectors, and HTML
 * structure are stable protocol. Human-facing copy and examples come from the
 * active request dictionary, so loading a template never injects another UI
 * locale into a creator's draft.
 */

import type { Dict } from "@/i18n/types";
import { buildYearnPhoneArtifact } from "@/lib/regex/yearn-phone";

export interface RegexTemplatePreset {
  name: string;
  targetText: string;
  pattern: string;
  replacement: string;
  variableMapping: Array<{ index: number; name: string; sample?: string }>;
  outputGuidance: string;
  enabled: boolean;
  visible: boolean;
  orderIndex: number;
}

export type RegexTemplate = {
  id: string;
  label: string;
  hint: string;
  preset: RegexTemplatePreset;
};

/** Build localized presentation/preset data around stable technical assets. */
export function getRegexTemplates(dict: Dict): RegexTemplate[] {
  const copy = dict.regex.templates;

  return [
    {
      id: "env_state_panel",
      label: copy.env.label,
      hint: copy.env.hint,
      preset: {
        name: copy.env.name,
        targetText: copy.env.targetText,
        pattern:
          "<env>\\s*<time>(.*?)</time>\\s*<weather>(.*?)</weather>\\s*<scene>(.*?)</scene>\\s*</env>",
        replacement: `<div class="nj_env_panel" style="border:1px solid rgba(212,175,55,.4);padding:12px;border-radius:8px;background:rgba(14,10,26,.6)">
  <div style="font-family:serif;font-size:18px;color:#d4af37">🕘 $1</div>
  <div style="color:#cbd5e1">${copy.env.weatherPrefix}$2</div>
  <div style="color:#94a3b8;font-style:italic">$3</div>
</div>`,
        variableMapping: [
          { index: 1, name: copy.env.timeVariable, sample: "13:37" },
          {
            index: 2,
            name: copy.env.weatherVariable,
            sample: copy.env.weatherSample,
          },
          {
            index: 3,
            name: copy.env.sceneVariable,
            sample: copy.env.sceneSample,
          },
        ],
        outputGuidance: copy.env.outputGuidance,
        enabled: true,
        visible: true,
        orderIndex: 0,
      },
    },
    {
      id: "dynamic_memory",
      label: copy.memory.label,
      hint: copy.memory.hint,
      preset: {
        name: copy.memory.name,
        targetText: copy.memory.targetText,
        pattern:
          "<memory>\\s*<short>(.*?)</short>\\s*<long>(.*?)</long>\\s*</memory>",
        replacement: `<details class="nj_memory" open style="border:1px dashed rgba(212,175,55,.3);padding:10px;border-radius:6px;margin:8px 0">
  <summary style="color:#d4af37;cursor:pointer">📓 ${copy.memory.summaryLabel}</summary>
  <div style="margin-top:6px"><strong>${copy.memory.shortLabel}</strong>$1</div>
  <div style="margin-top:4px;color:#94a3b8"><strong>${copy.memory.longLabel}</strong>$2</div>
</details>`,
        variableMapping: [
          {
            index: 1,
            name: copy.memory.shortVariable,
            sample: copy.memory.shortSample,
          },
          {
            index: 2,
            name: copy.memory.longVariable,
            sample: copy.memory.longSample,
          },
        ],
        outputGuidance: copy.memory.outputGuidance,
        enabled: true,
        visible: true,
        orderIndex: 0,
      },
    },
    {
      id: "emphasis_text",
      label: copy.emphasis.label,
      hint: copy.emphasis.hint,
      preset: {
        name: copy.emphasis.name,
        targetText: copy.emphasis.targetText,
        pattern: "<em>(.*?)</em>",
        replacement:
          '<span class="nj_emphasis_text" style="color:#d4af37;font-weight:600">$1</span>',
        variableMapping: [{ index: 1, name: copy.emphasis.contentVariable }],
        outputGuidance: copy.emphasis.outputGuidance,
        enabled: true,
        visible: false,
        orderIndex: 0,
      },
    },
    {
      id: "yearn_phone_placeholder",
      label: copy.phone.label,
      hint: copy.phone.hint,
      preset: {
        name: copy.phone.name,
        targetText: dict.characterForm.sandboxPhoneSampleText,
        pattern: "<phone>([\\s\\S]*?)</phone>",
        replacement: buildYearnPhoneArtifact(),
        variableMapping: [],
        outputGuidance: copy.phone.outputGuidance,
        enabled: false,
        visible: true,
        orderIndex: 0,
      },
    },
  ];
}
