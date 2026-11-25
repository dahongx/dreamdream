/**
 * 外部角色卡导入解析器 —— 纯函数、无副作用，给 import server actions 复用。
 *
 * 支持两种外部导出格式（字段名来自真实导出样本）：
 *   1. 美化（正则规则）导出 `regex-rules-*.json` —— 一个 JSON 数组，每条
 *      `{ ruleName, regexPattern, replaceString, enabled, visibility, mode, targetSymbol }`
 *   2. 角色卡导出 `*.xml` —— 见 {@link EXTERNAL_CARD_ROOT_TAG}，CDATA 包裹的
 *      中文标签元信息，`<正则规则>` 里**内嵌**同款正则 JSON 数组。
 *
 * 设计原则：所有 `parse*` 顶层函数返回 {@link ParseResult}，**绝不抛未捕获异常**
 * （坏文件不能崩页）；`map*` 只做字段映射。pattern 形如 `/.../g`，我们的
 * `buildRegExp`（regex/apply.ts）已支持这种 literal 形式，故直接透传。
 */

import { XMLParser } from "fast-xml-parser";
import { forceSfwNsfw } from "@/lib/config/site";
import {
  EXTERNAL_CARD_ROOT_TAG,
  LEGACY_SELECTOR_PREFIX,
  renameLegacySelectors,
} from "@/lib/import/legacy-format";
import { normalizeReplacementEnvelope } from "@/lib/regex/envelope";

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** 外部导出的正则规则条目。 */
export interface ExternalCardRule {
  ruleName?: string;
  regexPattern?: string;
  replaceString?: string;
  enabled?: boolean;
  visibility?: boolean;
  mode?: number;
  targetSymbol?: string;
}

/** 映射到我们 `regex_rules` insert 的形状（packId / id / 时间戳由 action 补齐）。 */
export interface ImportedRegexRule {
  name: string;
  targetText: string | null;
  pattern: string;
  replacement: string;
  outputGuidance: string | null;
  enabled: boolean;
  visible: boolean;
  orderIndex: number;
  variableMapping: Array<{ index: number; name: string; sample?: string }>;
}

/** 映射到我们 `characters` insert 的子集（owner / 时间戳 / 可见性由 action 补齐）。 */
export interface ImportedCharacter {
  name: string;
  gender: "male" | "female" | "other" | "unset";
  age: number | null;
  nsfw: boolean;
  isAi: boolean;
  contentType: "original" | "self_designed" | "fanwork";
  coverImageUrl: string | null;
  avatarUrl: string | null;
  tags: string[];
  bio: string | null;
  /** 作者的话（创作者对玩家说的话，展示性，不进 prompt）。 */
  creatorNote: string | null;
  persona: string;
  adversity: string | null;
  opening: string | null;
  defaultCognition: string | null;
  plotSetting: string | null;
  outputSetting: string | null;
  sampleDialogue: string | null;
}

const MAX_RULES = 200;
const MAX_TAGS = 30;
const NAME_MAX = 128;

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

/**
 * 把一条外部正则映射成我们的规则。不可用（缺 pattern 或 replacement）→ null，
 * 由调用方过滤并据此统计「跳过几条」。
 */
export function mapExternalCardRule(
  r: ExternalCardRule,
  orderIndex: number,
): ImportedRegexRule | null {
  const pattern =
    typeof r.regexPattern === "string" ? r.regexPattern.trim() : "";
  const replacement =
    typeof r.replaceString === "string" ? r.replaceString : "";
  if (!pattern || !replacement) return null;

  const rawName = typeof r.ruleName === "string" ? r.ruleName.trim() : "";
  const name = (rawName || "未命名规则").slice(0, NAME_MAX);
  const targetSymbol =
    typeof r.targetSymbol === "string" && r.targetSymbol
      ? r.targetSymbol
      : null;

  return {
    name,
    targetText: targetSymbol,
    pattern,
    // 外部格式的 replaceString 用 markdown 代码围栏 (```html ... ```) 当 iframe 外壳。
    // 寄情只在 replacement 整体是 <artifact>...</artifact> 时才路由进沙箱 iframe
    // （见 regex/segments.ts），否则掉进 sanitize 路径、<script>/<style> 被删、
    // 围栏被 react-markdown 当代码块原样吐出 —— 整个组件就废了。这里在导入时就把
    // 围栏归一成 artifact 外壳（与表单保存路径 schema.ts 的 transform 同源），
    // 让带 JS 的组件能真正渲染。非围栏的 replacement 原样透传。
    replacement: normalizeReplacementEnvelope(replacement),
    // 外部正则的本质是「渲染变换」(pattern→replacement)；「这个标签什么时候该吐」
    // 是 creator 写在角色卡正文里的事。导入只搬渲染半边，绝不替 creator 伪造一份
    // 触发指令 —— 否则它会和卡面正文里的同款说明在 system prompt 里重复 / 冲突
    // （扩展标签协议段 vs 输出设定段）。需要触发指导时，creator 进规则表单自己填。
    outputGuidance: null,
    // 来源平台默认开、默认对 user 不可见
    enabled: r.enabled !== false,
    visible: r.visibility === true,
    orderIndex,
    variableMapping: [],
  };
}

/**
 * 从正则 pattern 里提取打头的 XML 标签名。
 * 例如 `/<PhoneChat>([\s\S]*?)<\/PhoneChat>/g` → `PhoneChat`；
 * 非「标签型」pattern（符号匹配 / 文本样式等）→ null。
 *
 * 导入器本身不再用它（导入规则一律 render-only、不生成 outputGuidance）；保留
 * 并导出，给回填脚本 backfill-imported-rule-render.ts 的「去重存量指导」用 —— 那里
 * 在混合规则群里只能靠「标签是否被订阅角色卡文档化」当安全信号，需要这套判定。
 */
export function extractLeadingTag(pattern: string): string | null {
  const m = pattern.match(/^\/\s*\\?<(\w+)\\?>/);
  return m ? m[1] : null;
}

/**
 * 判断某标签是否已在给定的若干段正文里被 creator 文档化（写过 `<Tag`）。
 * 导出供回填脚本用 DB 列复用同一判定，避免逻辑漂移。
 */
export function tagDocumentedInText(
  tag: string,
  texts: Array<string | null | undefined>,
): boolean {
  const haystack = texts.filter((s): s is string => Boolean(s)).join("\n");
  return haystack.includes(`<${tag}`);
}

/** 解析外部正则 JSON 文本 → 我们的规则数组。 */
export function parseExternalRulesJson(
  text: string,
): ParseResult<ImportedRegexRule[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件不是合法 JSON" };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "格式不对：期望一个正则规则数组" };
  }

  const rules: ImportedRegexRule[] = [];
  for (const item of raw.slice(0, MAX_RULES)) {
    if (item && typeof item === "object") {
      const mapped = mapExternalCardRule(
        item as ExternalCardRule,
        rules.length,
      );
      if (mapped) rules.push(mapped);
    }
  }
  if (rules.length === 0) {
    return {
      ok: false,
      error: "没有可导入的有效规则（缺少 pattern 或 replacement）",
    };
  }
  return { ok: true, value: rules };
}

/**
 * 把外部平台的全局美化 / 小剧场 CSS 转成寄情可用的形态。
 *
 * 外部平台的界面选择器（`<前缀>chat_header` / `<前缀>ai_message_bubble` …）和
 * 寄情的（`nj_*`）是**镜像**，元素名一一对应，只差 {@link LEGACY_SELECTOR_PREFIX}
 * 这个前缀（见 docs/handover/selector-contract.md）。所以全量替换前缀即可——两个
 * 前缀都是唯一 token，直接字符串替换不会误伤别的内容。
 *
 * 本函数**只负责改名**。转换后必须再过 `sanitizeAndScopeCss`（styling/whitelist.ts）
 * 做安全校验 + scope —— 那一步会自动丢掉寄情没有对应元素的外部专有选择器
 * （如 `img[src='/chat-star.png']` 这类隐藏星标的规则）。
 */
export function convertLegacyCss(css: string): { css: string; note: string } {
  if (!css?.trim()) return { css: "", note: "" };
  const hadLegacyPrefix = css.includes(LEGACY_SELECTOR_PREFIX);
  const renamed = renameLegacySelectors(css);
  return {
    css: renamed,
    note: hadLegacyPrefix ? "已把外部选择器前缀转换成寄情的 nj_" : "",
  };
}

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  // 全部保留为字符串，自己显式转换；避免 "0"/"20"/"false" 被各自猜成不同类型
  parseTagValue: false,
  // 保留人设/逆境正文里的换行与缩进
  trimValues: false,
  // 不设 cdataPropName → CDATA 内容直接并入该标签的文本值
});

function mapGender(text: string | undefined): ImportedCharacter["gender"] {
  const t = (text ?? "").trim();
  if (t.includes("男")) return "male";
  if (t.includes("女")) return "female";
  if (t === "其它" || t === "其他") return "other";
  return "unset";
}

function mapContentType(
  v: string | undefined,
): ImportedCharacter["contentType"] {
  const t = (v ?? "").trim();
  if (t === "self_designed" || t === "fanwork") return t;
  return "original";
}

function toBool(v: unknown): boolean {
  return asString(v)?.trim().toLowerCase() === "true";
}

/**
 * 识别外部导出里被**加密**的字段：内容是 base64 包裹的
 * `{salt, iv, ciphertext}`（AES）。来源平台对「小剧场」「全局美化」做了加密导出
 * 以保护创作者美化资产——我们没有密钥、也不应破解，故只能识别并跳过。
 */
function isEncryptedField(value: string | undefined): boolean {
  if (!value) return false;
  const s = value.trim();
  if (s.length < 24 || /[^A-Za-z0-9+/=]/.test(s)) return false;
  try {
    const obj = JSON.parse(atob(s)) as Record<string, unknown>;
    return (
      !!obj &&
      typeof obj === "object" &&
      "salt" in obj &&
      "iv" in obj &&
      "ciphertext" in obj
    );
  } catch {
    return false;
  }
}

/** 取纯文本字段：加密 / 空 → null。保留正文换行格式时传 trim=false。 */
function plainText(value: string | undefined, trim = true): string | null {
  if (value == null || isEncryptedField(value)) return null;
  const out = trim ? value.trim() : value;
  return out ? out : null;
}

/**
 * 按候选标签名依次取第一个有值的纯文本字段（保留正文格式）。用于导出标签名
 * 不确定的字段——例如「样例对话&文风」含 `&`，导出 XML 里不可能是原样标签名，
 * 实际可能叫「样例对话文风 / 样例对话」等，故多挂几个候选兜底。用变量 key
 * 做动态访问（biome useLiteralKeys 只管字面量括号访问，变量不受限）。
 */
function firstPlainField(
  root: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = plainText(asString(root[k]), false);
    if (v) return v;
  }
  return null;
}

/** 从 `{ tag: "x" }` / `{ tag: ["x","y"] }` 收集标签字符串。 */
function collectTags(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const tag = (node as Record<string, unknown>).tag;
  const arr = Array.isArray(tag) ? tag : tag != null ? [tag] : [];
  return arr
    .map((t) => asString(t)?.trim())
    .filter((t): t is string => Boolean(t));
}

/** 解析外部角色卡 XML → 角色字段 + 内嵌正则规则。 */
export function parseExternalCharacterXml(text: string): ParseResult<{
  character: ImportedCharacter;
  rules: ImportedRegexRule[];
  /**
   * 外部 `<美化><样式代码>` 明文 CSS（裸源码，未做选择器前缀翻译）。
   * 没有该字段、字段为空或加密时为 null —— 加密的会出现在 lockedFields。
   * 调用方（importExternalCharacterAction）拿到后过 convertLegacyCss 再写进
   * pack.globalCss，避免「一键导入完角色但 CSS 全丢」的 UX 陷阱。
   */
  customStyles: string | null;
  /** Plaintext source theater, rendered through the existing sandbox slot. */
  openingComponent: string | null;
  /** 来源平台加密、无法自动导入、需作者手动搬的字段（人类可读名）。 */
  lockedFields: string[];
}> {
  let doc: Record<string, unknown>;
  try {
    doc = xmlParser.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "文件不是合法 XML" };
  }

  const root = doc?.[EXTERNAL_CARD_ROOT_TAG] as
    | Record<string, unknown>
    | undefined;
  if (!root || typeof root !== "object") {
    return {
      ok: false,
      error: `不是可识别的角色卡（缺少 <${EXTERNAL_CARD_ROOT_TAG}> 根节点）`,
    };
  }
  const meta = (root.元信息 as Record<string, unknown>) ?? {};

  const name = (asString(meta.名称) ?? "").trim();
  if (!name) {
    return { ok: false, error: "角色卡缺少名称" };
  }

  const ageNum = Number.parseInt(asString(meta.年龄) ?? "", 10);
  const tags = [
    ...collectTags(root.标签),
    ...collectTags(root.世界观标签),
    ...collectTags(root.模式标签),
  ];

  const character: ImportedCharacter = {
    name: name.slice(0, NAME_MAX),
    gender: mapGender(asString(meta.性别文本)),
    age: Number.isFinite(ageNum) ? ageNum : null,
    nsfw: forceSfwNsfw(toBool(meta.NSFW)),
    isAi: toBool(meta.AI),
    contentType: mapContentType(asString(meta.内容类型)),
    coverImageUrl: asString(meta.封面图)?.trim() || null,
    avatarUrl: asString(meta.头像)?.trim() || null,
    tags: [...new Set(tags)].slice(0, MAX_TAGS),
    bio: plainText(asString(root.角色介绍)),
    // 作者的话正文（外部 `<作者的话>`；`<作者的话标题>` 是自定义标题，丢弃，
    // 寄情用固定标题展示）。保留换行。
    creatorNote: plainText(asString(root.作者的话), false),
    persona: plainText(asString(root.人设), false) ?? "",
    adversity: plainText(asString(root.逆境处理), false),
    // 招呼语 = 外部「开场设计」（开场白文本）；默认认知 = 角色对 user 的预设
    opening: plainText(asString(root.招呼语)),
    defaultCognition: plainText(asString(root.默认认知)),
    // C 区高级设置（外部模板字段名见 single-card-template）。导出标签名待真实
    // 满填样本确认，样例对话因含 `&` 多挂候选名。
    plotSetting: firstPlainField(root, ["情节设定"]),
    outputSetting: firstPlainField(root, ["输出设定"]),
    // 导出实测：样例对话标签是「样例对话与文风」（用「与」代「&」，因 & 在 XML
    // 元素名非法）。其余为兜底候选。
    sampleDialogue: firstPlainField(root, [
      "样例对话与文风",
      "样例对话文风",
      "样例对话&文风",
      "样例对话",
    ]),
  };

  // <正则规则> 内嵌同款 JSON；解析失败不致命（角色照导，规则空）。
  // 规则一律 render-only（mapExternalCardRule 不生成 outputGuidance），触发指令交给卡面正文。
  let rules: ImportedRegexRule[] = [];
  const embedded = asString(root.正则规则);
  if (embedded?.trim()) {
    const r = parseExternalRulesJson(embedded);
    if (r.ok) rules = r.value;
  }

  // 来源平台加密的美化资产 → 识别出来告知作者手动搬，而不是静默丢失
  const lockedFields: string[] = [];
  if (isEncryptedField(asString(root.小剧场))) {
    lockedFields.push("小剧场");
  }
  const styleCode = (root.美化 as Record<string, unknown> | undefined)
    ?.样式代码;
  const styleCodeStr = asString(styleCode);
  let customStyles: string | null = null;
  if (isEncryptedField(styleCodeStr)) {
    lockedFields.push("全局美化");
  } else if (styleCodeStr?.trim()) {
    // 明文 CSS：留给 importExternalCharacterAction 过 convertLegacyCss 再写进
    // pack.globalCss。之前这块**完全被丢弃**（既不进 lockedFields 也不进
    // 任何字段），导致一键导入完成后 pack.globalCss 总是空，作者必须
    // 另外手工走「粘贴外部美化」按钮才看得到 CSS 效果。
    customStyles = styleCodeStr;
  }

  const openingComponent = plainText(asString(root.小剧场), false);
  return { ok: true, value: { character, rules, customStyles, openingComponent, lockedFields } };
}
