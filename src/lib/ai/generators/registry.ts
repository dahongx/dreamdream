/**
 * Generator registry for the AI authoring helpers.
 *
 * Each entry encapsulates how a generator's prompt is assembled and what
 * the maximum streaming output should be. The actual model call happens
 * in /api/ai/generate (uses defaultModel() so swapping providers is
 * one line).
 *
 * Prompt template files live in `./prompts/*.txt`. They contain hard
 * constraints + few-shot examples + a final `# 用户需求` heading; we
 * append creator input below that heading. Templates are bundled at
 * import time so they're sealed at deploy and creators can't influence
 * them via prompt injection.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locale } from "@/i18n/config";

export type GeneratorType =
  | "target-text"
  | "replacement-html"
  | "global-css"
  | "output-guidance"
  | "pack-assistant"
  | "image-prompt";

export interface GeneratorInput {
  type: GeneratorType;
  /** Required free-text prompt from the creator. */
  prompt: string;
  /** Per-type structured context (target_text, variable_mapping, etc). */
  context?: Record<string, unknown>;
  /** Server-resolved product locale; controls creator-facing output copy. */
  locale: Locale;
}

export interface ResolvedGenerator {
  systemPrompt: string;
  userPrompt: string;
}

const PROMPT_DIR = join(process.cwd(), "src/lib/ai/generators/prompts");

const PROMPT_CACHE = new Map<GeneratorType, string>();
function loadTemplate(type: GeneratorType): string {
  const cached = PROMPT_CACHE.get(type);
  if (cached) return cached;
  const path = join(PROMPT_DIR, `${type}.txt`);
  const body = readFileSync(path, "utf-8");
  PROMPT_CACHE.set(type, body);
  return body;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(
    /<<<([A-Z_]+)>>>/g,
    (_, key: string) => vars[key] ?? "(unset)",
  );
}

const LANGUAGE_LABELS: Record<Locale, string> = {
  "zh-TW": "繁體中文（台灣）",
  "ja-JP": "日本語",
  "th-TH": "ภาษาไทย",
  en: "English",
};

const LANGUAGE_REQUIREMENTS: Record<Locale, string> = {
  "zh-TW": "請使用自然的台灣繁體中文，不得輸出簡體中文。",
  "ja-JP": "自然な日本語を使用してください。",
  "th-TH": "ใช้ภาษาไทยที่เป็นธรรมชาติ",
  en: "Use natural English.",
};

/**
 * Keep the sealed technical prompt shared while localizing only material that
 * creators and players will read. Protocol identifiers must stay stable across
 * locales or generated rules would stop matching at runtime.
 */
export function buildGeneratorLanguageDirective(locale: Locale): string {
  return `<response_language>
目标语言：${LANGUAGE_LABELS[locale]}。${LANGUAGE_REQUIREMENTS[locale]}
所有面向 creator 或玩家的自然语言都必须使用目标语言。这包括说明文字、XML 叶子占位说明、组件 name/description、outputGuidance、自定义槽位名、组件内可见文案与图片 prompt。
不得翻译或改写代码、XML/HTML/CSS/JS、标签名、selector、JSON key、proposal type、URL、$1/$2、{{char}}/{{user}}、Dearm 保留协议标记，以及 creator 明确要求原样保留的文字。
示例中的语言只用于说明结构，不得覆盖本指令；不要翻译或改写 creator 已提供的专有名词与固定文案。
</response_language>`;
}

export function resolveGenerator(input: GeneratorInput): ResolvedGenerator {
  const tpl = loadTemplate(input.type);
  const ctx = input.context ?? {};

  const vars: Record<string, string> = {};
  if (input.type === "replacement-html") {
    vars.TARGET_TEXT = String(ctx.targetText ?? "");
    vars.VARIABLE_MAPPING = JSON.stringify(ctx.variableMapping ?? []);
  } else if (input.type === "global-css") {
    vars.TARGET_SELECTORS = Array.isArray(ctx.targetSelectors)
      ? (ctx.targetSelectors as string[]).join(", ")
      : "";
  } else if (input.type === "output-guidance") {
    vars.TARGET_TEXT = String(ctx.targetText ?? "");
    vars.REPLACEMENT_HINT = String(ctx.replacementHint ?? "");
  } else if (input.type === "pack-assistant") {
    vars.CURRENT_RULES = JSON.stringify(ctx.currentRules ?? [], null, 2);
    vars.CURRENT_GLOBAL_CSS = String(ctx.currentGlobalCss ?? "");
    // 会话类型：CSS 还是组件；组件下细分新建 / 迭代
    // （迭代覆盖两种情况：① 编辑已有 rule ② 新建会话已有 draftPayload，正在多轮打磨）
    const sessionType = String(ctx.sessionType ?? "");
    const targetRule = ctx.targetRule;
    const targetOpening = ctx.targetOpening;
    if (sessionType === "css") {
      vars.SESSION_TYPE = "皮肤";
    } else if (sessionType === "component" && targetRule) {
      vars.SESSION_TYPE = "互动块（迭代）";
    } else if (sessionType === "component") {
      vars.SESSION_TYPE = "互动块（新建）";
    } else if (sessionType === "opening" && targetOpening) {
      vars.SESSION_TYPE = "开场组件（迭代）";
    } else if (sessionType === "opening") {
      vars.SESSION_TYPE = "开场组件（新建）";
    } else {
      // 兼容老调用面：未指定 type 时退化到原有的不约束行为
      vars.SESSION_TYPE = "通用（无约束）";
    }
    vars.TARGET_RULE = targetRule
      ? JSON.stringify(targetRule, null, 2)
      : "（无，正在新建互动块）";
    vars.TARGET_OPENING = targetOpening
      ? JSON.stringify(targetOpening, null, 2)
      : "（无，正在新建开场组件）";
  } else if (input.type === "image-prompt") {
    vars.IMAGE_TARGET = String(ctx.imageTarget ?? "");
    vars.CHARACTER_NAME = String(ctx.characterName ?? "");
    vars.CHARACTER_BIO = String(ctx.characterBio ?? "");
    vars.CHARACTER_TAGS = Array.isArray(ctx.characterTags)
      ? (ctx.characterTags as string[]).join("、")
      : "";
  }

  const templatePrompt = interpolate(tpl, vars).trim();
  const systemPrompt = `${templatePrompt}\n\n${buildGeneratorLanguageDirective(
    input.locale,
  )}`;
  return {
    systemPrompt,
    userPrompt: input.prompt,
  };
}

export const GENERATOR_TYPES: GeneratorType[] = [
  "target-text",
  "replacement-html",
  "global-css",
  "output-guidance",
  "pack-assistant",
  "image-prompt",
];
