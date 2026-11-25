/**
 * Zod schema for the regex-rule form.
 *
 * Single-path flow: creator gives an optional sample of LLM output
 * (`targetText`), the form auto-derives `pattern` + `variableMapping`,
 * creator writes the `replacement` HTML.
 */

import { z } from "zod";
import { normalizeReplacementEnvelope } from "./envelope";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const optionalText = z.preprocess(emptyToUndefined, z.string().optional());

export const variableMappingEntrySchema = z.object({
  index: z.number().int().min(1),
  name: z.string().min(1).max(64),
  sample: z.string().max(512).optional(),
});

export const regexRuleFormSchema = z.object({
  name: z.string().min(1, "请填正则名称").max(128),

  targetText: optionalText,
  pattern: z.string().min(1, "pattern 不能为空"),
  replacement: z.string().default("").transform(normalizeReplacementEnvelope),

  variableMapping: z
    .preprocess((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string" && v.trim()) {
        try {
          return JSON.parse(v);
        } catch {
          return [];
        }
      }
      return [];
    }, z.array(variableMappingEntrySchema))
    .default([]),

  outputGuidance: optionalText,
  enabled: z.coerce.boolean().default(true),
  visible: z.coerce.boolean().default(false),
  orderIndex: z.coerce.number().int().min(0).max(9999).default(0),
});

export type RegexRuleFormInput = z.input<typeof regexRuleFormSchema>;
export type RegexRuleFormParsed = z.output<typeof regexRuleFormSchema>;
