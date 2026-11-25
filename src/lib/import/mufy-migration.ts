import { createHash } from "node:crypto";
import postcss from "postcss";
import {derivePublicHostWarningContract,buildPublicHostWarningFloating} from "./mufy-public-host-warning-candidate";
import { forceSfwNsfw } from "@/lib/config/site";
import { closeStyleBlockAtEof } from "@/lib/styling/style-block-boundary";
import { convertLegacyCss } from "@/lib/import/external-card";
import { routeOpeningContentSplit } from "@/lib/opening/content";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { localIdentityFacts } from "./mufy-local-identity";
import { adaptMufyRuntime } from "./mufy-runtime-adaptation";
import { prepareRenderedOpening, type RenderedOpeningCapture } from "./mufy-rendered-opening";
import { buildMufySourceRuleEnvelope } from "./mufy-source-rules";
import type { MufySourceRuleCapture } from "./mufy-source-rules";

export const MUFY_PROMPT_SECTIONS = {
  CharaPrompt: "persona",
  AdversityHandling: "adversity",
  DefaultCognition: "defaultCognition",
  Greeting: "opening",
  PlotSetting: "plotSetting",
  OutputSetting: "outputSetting",
  StyleSamples: "sampleDialogue",
} as const;

export type MufyPromptTag = keyof typeof MUFY_PROMPT_SECTIONS;

export interface MufyRoleDetail {
  characterId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  tags?: unknown;
  age?: number | null;
  gender?: number | string | null;
  creatorDescriptionTitle?: string | null;
  creatorDescription?: string | null;
  greeting?: string | null;
  codeRenderContent?: string | null;
  optimizationCode?: string | null;
  renderedOpening?: RenderedOpeningCapture;
  sourceRules?: MufySourceRuleCapture;
  items?: unknown;
  isAi?: boolean | null;
  isOc?: boolean | null;
  defaultModelId?: string | null;
  defaultModelTemplateId?: string | null;
  [key: string]: unknown;
}

export interface PromptRecord {
  characterName: string;
  prompt: string;
  source: Record<string, unknown>;
}

export interface ParsedPromptFields {
  persona: string;
  adversity: string | null;
  defaultCognition: string | null;
  opening: string | null;
  plotSetting: string | null;
  outputSetting: string | null;
  sampleDialogue: string | null;
}

export interface MigrationIssue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface PreparedMufyMigration {
  roleId: string;
  sourceName: string;
  targetName: string;
  character: {
    name: string;
    gender: "male" | "female" | "other" | "unset";
    age: number | null;
    nsfw: boolean;
    isAi: boolean;
    contentType: "original" | "self_designed" | "fanwork";
    avatarUrl: string | null;
    coverImageUrl: string | null;
    tags: string[];
    bio: string | null;
    creatorNote: string | null;
    persona: string;
    adversity: string | null;
    defaultCognition: string | null;
    opening: string;
    plotSetting: string | null;
    outputSetting: string | null;
    sampleDialogue: string | null;
  };
  beautification: {
    openingRender?: { pattern: string; replacement: string };
    replyRender?: ReturnType<typeof buildMufySourceRuleEnvelope>;
    globalCss: string | null;
    openingComponent: string | null;
    openingComponentName: string;
  };
  audit: {
    promptLength: number;
    sectionLengths: Record<MufyPromptTag, number>;
    detailGreetingLength: number;
    promptGreetingLength: number;
    greetingSource: "detail.greeting" | "prompt.Greeting";
    greetingMatchesPrompt: boolean | null;
    greetingTextSimilarity: number | null;
    optimizationCodeLength: number;
    codeRenderContentLength: number;
    globalCssLength: number;
    convertedSelectorCount: number;
    sanitizedCssLength: number;
    cssWarningCount: number;
    cssWarnings: string[];
    openingRoute: string | null;
    openingIframeCount: number;
    floatingComponentCount: number;
    itemCount: number;
    runtimeMarkers: Array<{
      tag: string;
      presentInPrompt: boolean;
      implementationFoundInDetail: boolean;
    }>;
    sourceHashes: {
      prompt: string;
      greeting: string;
      optimizationCode: string;
      codeRenderContent: string;
    };
  };
  issues: MigrationIssue[];
}

interface ExtractedPromptModulesRecord {
  character_name?: unknown;
  required_modules?: unknown;
  optional_modules?: unknown;
  module_order?: unknown;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function assembleExtractedPromptModules(
  source: ExtractedPromptModulesRecord,
): { character_name: string; prompt: string } | null {
  const required = asObject(source.required_modules) ?? {};
  const optional = asObject(source.optional_modules) ?? {};
  const modules = { ...required, ...optional };
  const declaredOrder = Array.isArray(source.module_order)
    ? source.module_order.filter(
        (tag): tag is string =>
          typeof tag === "string" && tag.trim().length > 0,
      )
    : [];
  const order = [
    ...declaredOrder,
    ...Object.keys(modules).filter((tag) => !declaredOrder.includes(tag)),
  ];
  const sections = order.flatMap((tag) => {
    const value = modules[tag];
    if (typeof value !== "string") return [];
    return [`<${tag}>\n${value}\n</${tag}>`];
  });
  if (!sections.length) return null;
  return {
    character_name: asNonEmptyString(source.character_name) ?? "",
    prompt: sections.join("\n\n"),
  };
}

function normalizeStructuredPromptSource(source: unknown): unknown {
  if (Array.isArray(source)) {
    const assembled = source.map((entry) => {
      const object = asObject(entry);
      return object ? (assembleExtractedPromptModules(object) ?? entry) : entry;
    });
    return assembled;
  }
  const object = asObject(source);
  return object ? (assembleExtractedPromptModules(object) ?? source) : source;
}

/**
 * Accept the three source formats used by the migration workflow:
 * a normal Prompt export JSON, extracted module JSON/JSONL, or an assembled
 * plain-text Prompt. The returned shape is intentionally fed back through the
 * same strict record selector used by the single-card importer.
 */
export function parseMufyPromptSourceText(sourceText: string): unknown {
  const trimmed = sourceText.trim();
  if (!trimmed) throw new Error("Prompt 来源文件为空");

  try {
    return normalizeStructuredPromptSource(JSON.parse(trimmed) as unknown);
  } catch (jsonError) {
    if (trimmed.includes("<CharaPrompt>")) return sourceText;

    try {
      const records = trimmed
        .split(/\r?\n/u)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as unknown);
      return normalizeStructuredPromptSource(records);
    } catch {
      throw new Error(
        `Prompt 来源既不是有效 JSON/JSONL，也不是完整标签文本：${
          jsonError instanceof Error ? jsonError.message : String(jsonError)
        }`,
      );
    }
  }
}

function plainTextForSimilarity(value: string): string {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/&[a-z#0-9]+;/giu, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/** Dice coefficient over character bigrams after removing presentation HTML. */
export function mufyTextSimilarity(left: string, right: string): number {
  const a = plainTextForSimilarity(left);
  const b = plainTextForSimilarity(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const grams = (value: string) => {
    const result = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      result.set(gram, (result.get(gram) ?? 0) + 1);
    }
    return result;
  };
  const leftGrams = grams(a);
  const rightGrams = grams(b);
  let overlap = 0;
  let total = 0;
  for (const count of leftGrams.values()) total += count;
  for (const count of rightGrams.values()) total += count;
  for (const [gram, count] of leftGrams) {
    overlap += Math.min(count, rightGrams.get(gram) ?? 0);
  }
  return total > 0 ? (2 * overlap) / total : 0;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Mufy often appends version notes to a card name, for example
 * `赵漳平(新增婚后开场白)`. The prompt export normally uses the base name.
 * This normalization is only used for matching; the source name remains intact
 * in the audit report.
 */
export function normalizeMufyCharacterName(value: string): string {
  return value
    .trim()
    .replace(/[（(][^（）()]*[）)]\s*$/u, "")
    .replace(/\s*\/新增[^/]*开场白[^/]*$/u, "")
    .replace(/\s+/g, "")
    .trim();
}

function collectObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectObjects(entry, depth + 1));
  }
  const object = asObject(value);
  if (!object) return [];
  return [
    object,
    ...Object.values(object).flatMap((entry) =>
      collectObjects(entry, depth + 1),
    ),
  ];
}

function looksLikeRoleDetail(value: Record<string, unknown>): boolean {
  return (
    typeof value.characterId === "string" &&
    typeof value.name === "string" &&
    ("greeting" in value || "codeRenderContent" in value)
  );
}

/** Accepts a raw detail response or the `{cards:{...}}` browser export. */
export function selectMufyRoleDetail(
  source: unknown,
  selector: string,
): MufyRoleDetail {
  const wanted = selector.trim();
  const wantedName = normalizeMufyCharacterName(wanted);
  const candidates = collectObjects(source).filter(looksLikeRoleDetail);
  const unique = [
    ...new Map(
      candidates.map((candidate) => [candidate.characterId, candidate]),
    ).values(),
  ] as unknown as MufyRoleDetail[];

  const byId = unique.filter((item) => item.characterId === wanted);
  if (byId.length === 1) return byId[0];

  const exact = unique.filter((item) => item.name.trim() === wanted);
  if (exact.length === 1) return exact[0];

  const normalized = unique.filter(
    (item) => normalizeMufyCharacterName(item.name) === wantedName,
  );
  if (normalized.length === 1) return normalized[0];

  const available = unique.map((item) => `${item.name}(${item.characterId})`);
  throw new Error(
    normalized.length > 1
      ? `Mufy 详情中“${selector}”匹配到多张卡，请改用 roleId：${available.join("、")}`
      : `Mufy 详情中找不到“${selector}”。可用角色：${available.join("、") || "无"}`,
  );
}

/** Reuse the authenticated browser export as the detail source. This keeps
 * the recommended workflow password-free after the user has logged in once. */
export function selectMufyRuntimeDetail(
  runtimeSnapshot: unknown,
  selector: string,
): { detail: MufyRoleDetail; rawResponse: unknown } | null {
  const snapshot = asObject(runtimeSnapshot);
  if (snapshot?.version !== 3 || !snapshot.detail) return null;
  return {
    detail: {
      ...selectMufyRoleDetail(snapshot.detail, selector),
      ...(snapshot.renderedOpening ? { renderedOpening: snapshot.renderedOpening as unknown as RenderedOpeningCapture } : {}),
      ...(snapshot.sourceRules ? { sourceRules: snapshot.sourceRules as unknown as MufySourceRuleCapture } : {}),
    },
    rawResponse: snapshot.detail,
  };
}

function promptRecords(source: unknown): PromptRecord[] {
  if (typeof source === "string") {
    return [{ characterName: "", prompt: source, source: {} }];
  }
  const object = asObject(source);
  const rawRecords = Array.isArray(source)
    ? source
    : Array.isArray(object?.characters)
      ? object.characters
      : object && typeof object.prompt === "string"
        ? [object]
        : [];

  return rawRecords.flatMap((entry): PromptRecord[] => {
    const record = asObject(entry);
    if (!record || typeof record.prompt !== "string" || !record.prompt.trim()) {
      return [];
    }
    if (record.found === false) return [];
    const characterName =
      asNonEmptyString(record.character_name) ??
      asNonEmptyString(record.characterName) ??
      asNonEmptyString(record.name) ??
      "";
    return [{ characterName, prompt: record.prompt, source: record }];
  });
}

export function selectPromptRecord(
  source: unknown,
  characterName: string,
): PromptRecord {
  const records = promptRecords(source);
  const exact = records.filter(
    (record) => record.characterName.trim() === characterName.trim(),
  );
  if (exact.length === 1) return exact[0];

  const normalizedName = normalizeMufyCharacterName(characterName);
  const normalized = records.filter(
    (record) =>
      normalizeMufyCharacterName(record.characterName) === normalizedName,
  );
  if (normalized.length === 1) return normalized[0];

  if (records.length === 1 && !records[0].characterName) return records[0];
  throw new Error(
    normalized.length > 1
      ? `Prompt JSON 中“${characterName}”存在多条候选，请先整理为唯一记录`
      : `Prompt JSON 中找不到“${characterName}”。可用角色：${
          records
            .map((record) => record.characterName || "未命名")
            .join("、") || "无"
        }`,
  );
}

export function extractPromptSection(
  prompt: string,
  tag: MufyPromptTag,
): string | null {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const closeIndex = prompt.indexOf(close);
  if (closeIndex < 0) return null;
  // The assembled master prompt can mention opening tags in its instructions.
  // The payload is the closest opening tag before the first closing tag.
  const openIndex = prompt.lastIndexOf(open, closeIndex);
  if (openIndex < 0) return null;
  const value = prompt.slice(openIndex + open.length, closeIndex).trim();
  return value || null;
}

export function parseMufyPrompt(prompt: string): ParsedPromptFields {
  const fields = Object.fromEntries(
    Object.entries(MUFY_PROMPT_SECTIONS).map(([tag, field]) => [
      field,
      extractPromptSection(prompt, tag as MufyPromptTag),
    ]),
  ) as unknown as ParsedPromptFields;
  if (!fields.persona) {
    throw new Error("Prompt 缺少有效的 <CharaPrompt>…</CharaPrompt>");
  }
  return fields;
}

function extractStyleBlocks(value: string): string[] {
  return [...value.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function decodeCssContent(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')$/.exec(trimmed);
  if (!match) return null;
  return (match[1] ?? match[2] ?? "")
    .replace(/\\(["'\\])/g, "$1")
    .replace(/\\A\s?/gi, "\n")
    .trim();
}

/** Recover a customized Mufy host warning which otherwise has no DOM inside
 * the exported theater. The source text lives in the host skin's
 * `.z-dropdown ... span::before { content: ... }` rule. */
export function extractMufyWarningText(html: string): string | null {
  for (const css of extractStyleBlocks(html)) {
    let root: postcss.Root;
    try {
      root = postcss.parse(css);
    } catch {
      continue;
    }
    let warning: string | null = null;
    root.walkRules((rule) => {
      if (
        warning ||
        !rule.selectors.some(
          (selector) =>
            /(?:z-dropdown|mb-2\.mt-2|rounded-md|background-color: rgba\(52|text-white\\\/60)/i.test(selector) && /span[^,{]*::(?:before|after)/i.test(selector),
        )
      ) {
        return;
      }
      rule.walkDecls("content", (declaration) => {
        warning ??= decodeCssContent(declaration.value);
      });
    });
    if (warning) return warning;
  }
  return null;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMufyWarningFloating(text: string): string {
  return `<floating kind="warning-top" pos="top-center" interactive="false">
<style>
.nj-mufy-warning{height:54px;box-sizing:border-box;display:flex;align-items:center;padding:8px 48px 8px 15px;border:1px solid rgba(213,229,235,.38);background:rgba(8,12,18,.72);color:#d5e5eb;font:300 13px/1.35 'Noto Serif SC','Playfair Display',serif;letter-spacing:2px;text-shadow:0 0 5px rgba(213,229,235,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
</style>
<div class="nj-mufy-warning">${escapeHtmlText(text)}</div>
</floating>`;
}

/**
 * Some Mufy cards put host-page skin rules inside codeRenderContent instead
 * of optimizationCode. Only selectors using Mufy's documented host contract
 * are promoted; component-private rules stay inside the sandboxed theater.
 */
export function extractEmbeddedMufyHostCss(html: string): string {
  const extracted: string[] = [];
  for (const css of extractStyleBlocks(html)) {
    let root: postcss.Root;
    try {
      root = postcss.parse(css);
    } catch {
      continue;
    }
    const hasHostRule = root.nodes.some((node) => {
      if (node.type !== "rule") return false;
      return node.selectors.some((selector) =>
        /[#.]mufy_[\w-]+/i.test(selector),
      );
    });
    if (!hasHostRule) continue;

    // Emphasis shares Mufy's narration skin, but is a separate inline node
    // in Dearm. Split it before stripping backgrounds from block narration.
    root.walkRules((rule) => {
      if (
        rule.selectors.some((selector) => /[#.]mufy_[\w-]+/i.test(selector)) &&
        rule.selectors.some((selector) =>
          /^(?:b|strong)$/i.test(selector.trim()),
        )
      ) {
        rule.cloneBefore({ selector: ".mufy_emphasis_text" });
      }
    });

    root.walkRules((rule) => {
      const parentName = rule.parent?.type === "atrule" ? rule.parent.name : "";
      if (/keyframes$/i.test(parentName)) return;
      if (rule.selector.trim() === ":root") return;
      const selectors = rule.selectors.filter((selector) =>
        /[#.]mufy_[\w-]+/i.test(selector),
      );
      if (selectors.length === 0) rule.remove();
      else rule.selectors = selectors;
    });
    // Mufy renders narration highlights around inline text. Dearm's semantic
    // narration node is a block container, so carrying the same background
    // paints a full-width blue rectangle behind each narration section.
    // Preserve typography and text glow, but drop the incompatible fill.
    root.walkRules((rule) => {
      if (
        !rule.selectors.some((selector) =>
          /\.mufy_message_narration\b/i.test(selector),
        )
      ) {
        return;
      }
      rule.walkDecls(/^background(?:-.+)?$/i, (declaration) => {
        declaration.remove();
      });
    });
    // Host skins frequently repeat pointer-event guards on decorative
    // pseudo-elements. Dearm enforces those guards in globals.css and the CSS
    // sandbox intentionally rejects creator-controlled pointer routing.
    root.walkDecls("pointer-events", (declaration) => {
      declaration.remove();
    });

    const retainedText = root.toString();
    root.walkAtRules((atRule) => {
      if (atRule.name === "import" || atRule.name === "font-face") {
        atRule.remove();
        return;
      }
      if (/keyframes$/i.test(atRule.name)) {
        const name = atRule.params.trim();
        if (!name || !retainedText.includes(name)) atRule.remove();
        return;
      }
      if (atRule.nodes && atRule.nodes.length === 0) atRule.remove();
    });
    const value = root.toString().trim();
    if (value) extracted.push(value);
  }
  return extracted.join("\n\n");
}

/** Adapt Mufy's animated reasoning disclosure to Dearm's semantic button.
 * The source selector is a Tailwind class chain owned by Mufy's host page, so
 * it cannot be copied verbatim. Detect the card-specific face signature and
 * reproduce the same breathing glyph and sliding underline on our stable host
 * contract instead. */
export function extractMufyThinkToggleCss(html: string): string {
  if (
    /content\s*:\s*["']⩌\s*_\s*⩌["']/i.test(html) &&
    /btn-underline-slide/i.test(html) &&
    /btn-text-breathe/i.test(html)
  ) {
    return `@keyframes mufy-think-line-slide {
  0% { width: 0; opacity: 0; }
  15%, 85% { opacity: 1; }
  50% { width: 100%; opacity: 1; }
  100% { width: 0; opacity: 0; }
}
@keyframes mufy-think-text-breathe {
  0%, 100% { opacity: .7; letter-spacing: 3px; }
  50% { opacity: 1; letter-spacing: 5px; }
}
.mufy_message_think[data-collapsed="true"] {
  width: fit-content !important;
  min-width: 96px;
  position: relative;
  overflow: visible !important;
  padding: 10px 20px !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--c-highlight, #d5e5eb) !important;
  font-size: 0 !important;
  text-align: center !important;
}
.mufy_message_think[data-collapsed="true"]::before {
  content: '⩌ _ ⩌';
  color: var(--c-highlight, #d5e5eb) !important;
  font: 300 16px/1.5 'Noto Serif SC', serif !important;
  letter-spacing: 3px;
  text-shadow: 0 0 4px var(--c-glow, rgba(213,229,235,.5));
  animation: mufy-think-text-breathe 3.5s ease-in-out infinite;
}
.mufy_message_think[data-collapsed="true"]::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 0;
  height: 1px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, rgba(213,229,235,0), var(--c-highlight, #d5e5eb) 50%, rgba(213,229,235,0));
  box-shadow: 0 0 6px rgba(213,229,235,.6);
  animation: mufy-think-line-slide 3.5s ease-in-out infinite;
}
.mufy_message_think[data-collapsed="true"] > span {
  display: none !important;
  font-size: 0 !important;
  line-height: 0 !important;
}
.mufy_message_think[data-collapsed="true"]:hover::after {
  width: 100%;
  opacity: 1;
  animation: none;
}
.mufy_message_think[data-collapsed="true"]:hover::before {
  opacity: 1;
  letter-spacing: 5px;
  animation: none;
}
@media (max-width: 480px) {
  .mufy_message_think[data-collapsed="true"] { padding: 8px 16px !important; }
  .mufy_message_think[data-collapsed="true"]::before { font-size: 14px !important; }
}`;
  }

  const extracted: string[] = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    let root: postcss.Root;
    try {
      root = postcss.parse(match[1]);
    } catch {
      continue;
    }
    root.walkRules((rule) => {
      const selectors = rule.selectors.flatMap((selector) => {
        const marker = ".group.flex.w-fit.cursor-pointer";
        const markerIndex = selector.indexOf(marker);
        if (markerIndex < 0) return [];

        let tailIndex = markerIndex + marker.length;
        while (tailIndex < selector.length) {
          const char = selector[tailIndex];
          if (
            /\s/.test(char) ||
            (char === ":" && selector[tailIndex - 1] !== "\\")
          ) {
            break;
          }
          tailIndex += 1;
        }
        let tail = selector.slice(tailIndex);
        tail = tail
          .replace(/\s+span\.font-bold::after\b/, "::before")
          .replace(/\s+svg\b/, " > svg");
        return [`.mufy_message_think[data-collapsed="true"]${tail}`];
      });
      if (selectors.length === 0) rule.remove();
      else rule.selectors = selectors;
    });
    root.walkAtRules((atRule) => {
      atRule.remove();
    });
    root.walkDecls("pointer-events", (declaration) => {
      declaration.remove();
    });
    const value = root.toString().trim();
    if (value) extracted.push(value);
  }
  return extracted.join("\n\n");
}

function extractHtmlContractSelectors(values: string[]): Set<string> {
  const selectors = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(/\bclass\s*=\s*["']([^"']+)["']/gi)) {
      for (const className of match[1].split(/\s+/)) {
        if (className) selectors.add(`.${className}`);
      }
    }
    for (const match of value.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
      if (match[1]) selectors.add(`#${match[1]}`);
    }
  }
  return selectors;
}

function selectorUsesContract(
  selector: string,
  contractSelectors: Set<string>,
): boolean {
  for (const match of selector.matchAll(/([.#]-?[_a-zA-Z]+[\w-]*)/g)) {
    if (contractSelectors.has(match[1])) return true;
  }
  return false;
}

/**
 * Mufy also treats codeRenderContent as a stylesheet source for HTML emitted
 * by the model. Dearm keeps that theater in an iframe, so those styles do not
 * naturally reach assistant bubbles. Recover only rules whose class/id is
 * explicitly present in the greeting or OutputSetting contract; unrelated
 * theater, player and floating-widget CSS stays sandboxed.
 */
export function extractEmbeddedReplyCss(
  html: string,
  contractSources: string[],
): string {
  const contractSelectors = extractHtmlContractSelectors(contractSources);
  if (contractSelectors.size === 0) return "";

  const extracted: string[] = [];
  for (const css of extractStyleBlocks(html)) {
    let root: postcss.Root;
    try {
      root = postcss.parse(css);
    } catch {
      continue;
    }

    let hasContractRule = false;
    root.walkRules((rule) => {
      const parentName = rule.parent?.type === "atrule" ? rule.parent.name : "";
      if (/keyframes$/i.test(parentName)) return;
      if (
        rule.selectors.some((selector) =>
          selectorUsesContract(selector, contractSelectors),
        )
      ) {
        hasContractRule = true;
      }
    });
    if (!hasContractRule) continue;

    // A reply widget's :root variables must not replace Dearm host tokens
    // (e.g. a white phone's --text-primary made narrative emphasis black).
    // Namespace declarations and references together, preserving widget colors.
    const privateVariables = new Map<string, string>();
    root.walkRules((rule) => {
      if (rule.selector.trim() !== ":root") return;
      rule.walkDecls(/^--/, (decl) => {
        privateVariables.set(
          decl.prop,
          `--mufy-reply-${extracted.length}-${decl.prop.slice(2)}`,
        );
      });
    });
    root.walkDecls((decl) => {
      decl.prop = privateVariables.get(decl.prop) ?? decl.prop;
      decl.value = decl.value.replace(
        /var\(\s*(--[\w-]+)/g,
        (match, name: string) =>
          privateVariables.has(name)
            ? `var(${privateVariables.get(name)}`
            : match,
      );
    });

    root.walkRules((rule) => {
      const parentName = rule.parent?.type === "atrule" ? rule.parent.name : "";
      if (/keyframes$/i.test(parentName) || rule.selector.trim() === ":root") {
        return;
      }
      const selectors = rule.selectors.filter((selector) =>
        selectorUsesContract(selector, contractSelectors),
      );
      if (selectors.length === 0) rule.remove();
      else {
        rule.selectors = selectors.map((selector) =>
          selector.trim() === ".hidden-text" &&
          contractSelectors.has(".chat-container-reforged")
            ? ".nj_ai_message_bubble .chat-container-reforged .hidden-text"
            : selector,
        );
      }
    });
    // Dearm deliberately blocks creator CSS from taking over pointer routing
    // or escaping above platform controls. These reply components do not need
    // either behavior; preserve their internal stacking within the safe cap.
    root.walkDecls("pointer-events", (declaration) => {
      declaration.remove();
    });
    root.walkDecls("z-index", (declaration) => {
      const value = Number.parseInt(declaration.value, 10);
      if (Number.isFinite(value) && value > 100) declaration.value = "100";
    });
    // `display:none` on a scrollbar pseudo-element is rejected as an overly
    // broad hide rule. A zero-width scrollbar is the same visual result.
    root.walkRules((rule) => {
      if (!rule.selector.includes("::-webkit-scrollbar")) return;
      rule.walkDecls("display", (declaration) => {
        if (declaration.value.trim().toLowerCase() === "none") {
          declaration.prop = "width";
          declaration.value = "0";
        }
      });
    });
    root.walkAtRules((atRule) => {
      if (atRule.nodes && atRule.nodes.length === 0) atRule.remove();
    });
    const value = root.toString().trim();
    if (value) extracted.push(value);
  }
  return extracted.join("\n\n");
}

function prepareGlobalCss(
  optimizationCode: string,
  codeRenderContent: string,
  replyContractSources: string[],
): {
  css: string | null;
  convertedSelectorCount: number;
} {
  const outsideStyles = optimizationCode
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .trim();
  if (outsideStyles) {
    throw new Error(
      "optimizationCode 含有 <style> 之外的内容；为避免误删原卡视觉，已停止迁移",
    );
  }
  if (
    optimizationCode.trim() &&
    extractStyleBlocks(optimizationCode).length === 0
  ) {
    throw new Error("optimizationCode 非空但没有完整的 <style> 块");
  }
  // Mufy normally has two separate visual channels:
  //   - optimizationCode: page-level skin, mapped to Dearm global CSS;
  //   - codeRenderContent: theater/sidebar/player HTML, kept inside its
  //     sandboxed opening component.
  //
  // Never promote arbitrary component CSS. A few older cards, however, put
  // explicit `.mufy_*` / `#mufy_*` host-contract rules in codeRenderContent;
  // those rules are page skin by definition and are selectively recovered.
  const explicitCss = extractStyleBlocks(optimizationCode).map(closeStyleBlockAtEof).join("\n\n");
  const embeddedHostCss = extractEmbeddedMufyHostCss(codeRenderContent);
  const thinkToggleCss = extractMufyThinkToggleCss(codeRenderContent);
  const embeddedReplyCss = extractEmbeddedReplyCss(
    codeRenderContent,
    replyContractSources,
  );
  const rawCss = [
    explicitCss,
    embeddedHostCss,
    thinkToggleCss,
    embeddedReplyCss,
  ]
    .filter(Boolean)
    .join("\n\n");
  const convertedSelectorCount = (rawCss.match(/mufy_/g) ?? []).length;
  const css = rawCss ? convertLegacyCss(rawCss).css.trim() : "";
  return { css: css || null, convertedSelectorCount };
}

function genderFromMufy(
  value: MufyRoleDetail["gender"],
): PreparedMufyMigration["character"]["gender"] {
  if (value === 1 || value === "1" || value === "male" || value === "男") {
    return "male";
  }
  if (value === 2 || value === "2" || value === "female" || value === "女") {
    return "female";
  }
  if (value === 3 || value === "3" || value === "other" || value === "其他") {
    return "other";
  }
  return "unset";
}

function itemCount(items: unknown): number {
  if (Array.isArray(items)) return items.length;
  const object = asObject(items);
  return Array.isArray(object?.items) ? object.items.length : 0;
}

function creatorNote(detail: MufyRoleDetail): string | null {
  const parts = [
    detail.creatorDescriptionTitle?.trim(),
    detail.creatorDescription?.trim(),
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join("\n") : null;
}

function routeStats(content: string, roleId: string) {
  if (!content.trim()) {
    return { route: null, iframeCount: 0, floatingCount: 0 };
  }
  const route = routeOpeningContentSplit(content, roleId);
  const iframeCount =
    route.inline?.kind === "iframe-multi"
      ? route.inline.srcdocs.length
      : route.inline?.kind === "iframe"
        ? 1
        : 0;
  return {
    route: route.inline?.kind ?? "floating-only",
    iframeCount,
    floatingCount: route.floating.length,
  };
}

const RUNTIME_MARKERS = [
  {
    tag: "侧边栏指令区",
    implementation:
      /<(?:div|aside|section|details|template)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:sidebar|injected-ghost-sidebar-root|censy-blue-glass-sidebar)/i,
  },
  {
    tag: "侧边栏播放器",
    implementation:
      /<(?:div|aside|section|details|template)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:player|island-container|ft-ghost-sidebar)/i,
  },
] as const;

export function prepareMufyMigration(input: {
  adaptRuntime?: boolean;
  preferLocalAge?: boolean;
  detail: MufyRoleDetail;
  promptRecord: PromptRecord;
  targetName?: string;
  nsfw?: boolean;
  contentType?: "original" | "self_designed" | "fanwork";
}): PreparedMufyMigration {
  const { detail, promptRecord } = input;
  // Some exports place an empty audio element alongside the host style blocks.
  // Keep that element in the sandboxed component instead of losing it or
  // rejecting the entire card. Other mixed content still requires review.
  const optimizationOutside = (detail.optimizationCode ?? "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").trim();
  const movableAudio = input.adaptRuntime && optimizationOutside &&
    /^(?:\s*<audio\b[^>]*>\s*<\/audio>\s*)+$/i.test(optimizationOutside)
    ? optimizationOutside : "";
  const runtimeDetail = movableAudio ? {
    ...detail,
    optimizationCode: [...(detail.optimizationCode ?? "").matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join("\n"),
    codeRenderContent: `${detail.codeRenderContent ?? ""}\n${movableAudio}`,
  } : detail;
  const fields = parseMufyPrompt(promptRecord.prompt);
  const issues: MigrationIssue[] = [];
  if(movableAudio)issues.push({level:"info",code:"HOST_AUDIO_PRESERVED_IN_COMPONENT",message:"全局样式外的空 audio 元素完整保留到沙箱组件；不代表外部音频已验证可播放"});
  const sourceName = detail.name.trim();
  const localAge = input.preferLocalAge ? localIdentityFacts(fields.persona).age : null;
  const mappedAge = localAge ?? (typeof detail.age === "number" && Number.isFinite(detail.age) ? detail.age : null);
  if (localAge !== null && localAge !== detail.age)
    issues.push({ level: "info", code: "AGE_FROM_AUTHORIZED_LOCAL_BASELINE", message: `采用已确定的本地人设年龄${localAge}；来源基础字段${String(detail.age)}保留在来源记录` });
  const targetName = (
    input.targetName ?? normalizeMufyCharacterName(sourceName)
  ).trim();
  if (!targetName) throw new Error("迁移后的角色名不能为空");

  if (
    promptRecord.characterName &&
    normalizeMufyCharacterName(promptRecord.characterName) !==
      normalizeMufyCharacterName(sourceName)
  ) {
    issues.push({
      level: "error",
      code: "NAME_MISMATCH",
      message: `详情角色“${sourceName}”与 Prompt 角色“${promptRecord.characterName}”不一致`,
    });
  }

  // Preserve the source payload byte-for-byte. `trim()` is only used for the
  // emptiness checks below; it must not silently rewrite author formatting.
  const detailGreeting = detail.greeting ?? "";
  if (input.adaptRuntime && !detail.renderedOpening && /<(?:TimeBox\b|meta>\s*◇|基础状态>|定制指令组件正则>)/i.test(detailGreeting)) issues.push({level:"error",code:"OPENING_RENDER_CONTRACT_REQUIRED",message:"来源开场包含原站转换组件；必须捕获实际渲染模板及展开态，不能仅以原始文本迁入后宣布完成"});
  if (input.adaptRuntime && detail.renderedOpening && !detail.sourceRules) {
    issues.push({level:"error",code:"SOURCE_RENDER_RULE_CAPTURE_REQUIRED",message:"已捕获开场不代表捕获后续渲染规则；必须记录角色独立规则接口的正常响应，正常空集合也需明确记录，禁止推测为空"});
  }
  const promptGreeting = fields.opening ?? "";
  const runtimeAdaptation = input.adaptRuntime ? adaptMufyRuntime(runtimeDetail) : { opening: detailGreeting, component: detail.codeRenderContent ?? "", repairs: [] };
  const opening = detailGreeting ? runtimeAdaptation.opening : promptGreeting;
  for (const repair of runtimeAdaptation.repairs) issues.push({level:"info",code:"AUTOMATIC_RUNTIME_ADAPTATION",message:repair});
  if (!opening) {
    issues.push({
      level: "error",
      code: "OPENING_MISSING",
      message: "详情 greeting 与 Prompt Greeting 均为空",
    });
  }
  const greetingMatchesPrompt =
    detailGreeting && promptGreeting
      ? sha256(detailGreeting) === sha256(promptGreeting)
      : null;
  const greetingTextSimilarity =
    detailGreeting && promptGreeting
      ? mufyTextSimilarity(detailGreeting, promptGreeting)
      : null;
  if (greetingMatchesPrompt === false) {
    issues.push({
      level: "warning",
      code: "GREETING_DIFFERS",
      message:
        "线上详情 greeting 与 Prompt Greeting 不同；按线上实际展示采用 detail.greeting",
    });
  }

  const optimizationCode = detail.optimizationCode ?? "";
  const codeRenderContent = detail.codeRenderContent ?? "";
  const { css, convertedSelectorCount } = prepareGlobalCss(
    runtimeDetail.optimizationCode ?? "",
    codeRenderContent,
    [opening, fields.outputSetting ?? ""],
  );
  const warningText = extractMufyWarningText(optimizationCode + "\n" + codeRenderContent);
  const openingComponent =
    [
      runtimeAdaptation.component.trim(),
      warningText ? (()=>{
        const contract=derivePublicHostWarningContract(optimizationCode+"\n"+codeRenderContent,warningText,runtimeDetail.sourceWarningObservation);
        return contract?buildPublicHostWarningFloating(contract):buildMufyWarningFloating(warningText);
      })() : "",
    ]
      .filter(Boolean)
      .join("\n\n") || null;
  if (!optimizationCode && !css) {
    issues.push({
      level: "warning",
      code: "GLOBAL_STYLE_MISSING",
      message: "Mufy 详情没有 optimizationCode；不会自创全局 CSS",
    });
  }
  if (!codeRenderContent) {
    issues.push({
      level: "warning",
      code: "THEATER_MISSING",
      message: "Mufy 详情没有 codeRenderContent；不会把开场白伪装成演绎室",
    });
  }
  if (!detail.avatarUrl?.trim()) {
    issues.push({
      level: "warning",
      code: "AVATAR_MISSING",
      message: "Mufy 详情没有角色头像",
    });
  }
  if (!detail.backgroundUrl?.trim()) {
    issues.push({
      level: "warning",
      code: "COVER_MISSING",
      message: "Mufy 详情没有角色背景图",
    });
  }

  for (const [tag, field] of Object.entries(MUFY_PROMPT_SECTIONS)) {
    if (field !== "persona" && !fields[field as keyof ParsedPromptFields]) {
      issues.push({
        level: "warning",
        code: `PROMPT_SECTION_${tag.toUpperCase()}_MISSING`,
        message: `Prompt 未提供 <${tag}>，对应寄情字段保持空值`,
      });
    }
  }

  const count = itemCount(detail.items);
  if (count > 0) {
    issues.push({
      level: "info",
      code: "ITEMS_PRESERVED_IN_SOURCE_ONLY",
      message: `Mufy 有 ${count} 个道具条目；寄情暂无对应表，本轮仅在原始详情备份中保留`,
    });
  }

  const route = routeStats(openingComponent ?? "", detail.characterId);
  const runtimeMarkers = RUNTIME_MARKERS.map(({ tag, implementation }) => ({
    tag,
    presentInPrompt: promptRecord.prompt.includes(`<${tag}>`),
    implementationFoundInDetail: implementation.test(openingComponent ?? ""),
  }));
  for (const marker of runtimeMarkers) {
    if (marker.presentInPrompt && !marker.implementationFoundInDetail) {
      issues.push({
        level: "error",
        code: "RUNTIME_COMPONENT_NOT_EXPORTED",
        message: `Prompt 要求 <${marker.tag}>，但角色详情没有对应运行时 HTML；需要从 Mufy 登录页面抓取该组件后再提交`,
      });
    }
  }
  let sanitizedCssLength = 0;
  let cssWarningCount = 0;
  let cssWarnings: string[] = [];
  if (css) {
    const sanitized = sanitizeAndScopeCss(css, `audit-${detail.characterId}`);
    sanitizedCssLength = sanitized.css.length;
    cssWarningCount = sanitized.warnings.length;
    cssWarnings = sanitized.warnings;
    if (cssWarningCount > 0) {
      issues.push({
        level: "warning",
        code: "CSS_SANITIZER_WARNINGS",
        message: `寄情 CSS 安全作用域检查产生 ${cssWarningCount} 条警告，详见运行报告`,
      });
    }
  }

  const tags = Array.isArray(detail.tags)
    ? detail.tags
        .filter((tag): tag is string => typeof tag === "string")
        .slice(0, 20)
    : [];
  const sectionLengths = Object.fromEntries(
    Object.keys(MUFY_PROMPT_SECTIONS).map((tag) => [
      tag,
      extractPromptSection(promptRecord.prompt, tag as MufyPromptTag)?.length ??
        0,
    ]),
  ) as Record<MufyPromptTag, number>;

  return {
    roleId: detail.characterId,
    sourceName,
    targetName,
    character: {
      name: targetName,
      gender: genderFromMufy(detail.gender),
      age: mappedAge,
      // Mufy detail does not expose an unambiguous NSFW boolean. Defaulting to
      // true is the safer catalog choice; the CLI provides --nsfw false.
      // SFW 版必须把它压成 false —— 否则这个「默认 true」会让每一张搬进来的
      // 卡都自动落成分级内容，见 lib/config/site.ts forceSfwNsfw。
      nsfw: forceSfwNsfw(input.nsfw ?? true),
      isAi: detail.isAi === true,
      // Mufy's `isOc` / `charaType` semantics are not reliable enough to map
      // into Dearm's three-way copyright label. Keep the established import
      // default and allow an explicit CLI override.
      contentType: input.contentType ?? "original",
      avatarUrl: detail.avatarUrl?.trim() || null,
      coverImageUrl: detail.backgroundUrl?.trim() || null,
      tags,
      bio: detail.description?.trim() || null,
      creatorNote: creatorNote(detail),
      persona: fields.persona,
      adversity: fields.adversity,
      defaultCognition: fields.defaultCognition,
      opening,
      plotSetting: fields.plotSetting,
      outputSetting: fields.outputSetting,
      sampleDialogue: fields.sampleDialogue,
    },
    beautification: {
      openingRender: detail.renderedOpening ? prepareRenderedOpening(detail.renderedOpening, detail.characterId, detailGreeting, opening) : undefined,
      replyRender: detail.sourceRules ? buildMufySourceRuleEnvelope(detail.sourceRules, detail.characterId, detail.optimizationCode ?? "") : undefined,
      globalCss: css,
      openingComponent,
      openingComponentName: "Mufy 原始小剧场",
    },
    audit: {
      promptLength: promptRecord.prompt.length,
      sectionLengths,
      detailGreetingLength: detailGreeting.length,
      promptGreetingLength: promptGreeting.length,
      greetingSource: detailGreeting ? "detail.greeting" : "prompt.Greeting",
      greetingMatchesPrompt,
      greetingTextSimilarity,
      optimizationCodeLength: optimizationCode.length,
      codeRenderContentLength: codeRenderContent.length,
      globalCssLength: css?.length ?? 0,
      convertedSelectorCount,
      sanitizedCssLength,
      cssWarningCount,
      cssWarnings,
      openingRoute: route.route,
      openingIframeCount: route.iframeCount,
      floatingComponentCount: route.floatingCount,
      itemCount: count,
      runtimeMarkers,
      sourceHashes: {
        prompt: sha256(promptRecord.prompt),
        greeting: sha256(detailGreeting),
        optimizationCode: sha256(optimizationCode),
        codeRenderContent: sha256(codeRenderContent),
      },
    },
    issues,
  };
}
