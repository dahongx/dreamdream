import type { Character, RegexRule, User, UserMask } from "@/lib/db/schema";
import { buildRegexGuidanceSection } from "@/lib/regex/prompt";
import {
  buildResponseLanguageSection,
  type ConversationLocale,
  masterInstructionLocaleFor,
} from "./conversation-locale";
import { type MasterRoleSection, renderMasterPrompt } from "./master-template";
import { DEARM_OUTPUT_PROTOCOL } from "./output-protocol";

/**
 * Opening field format (Dearm 渲染协议对齐):
 *   <message>角色台词</message>
 *   <narration>第三人称叙述</narration>
 *   <think>角色内心</think>
 *   <scenario>场景设定段</scenario>
 *   <system>额外 system 指令</system>
 *
 * - canonical Greeting 会收到完整 opening，供模型学习 creator 的格式与开场语境。
 * - 本解析器只服务玩家可见的首条 assistant seed：从中去掉 scenario / system，
 *   其余（含 <message> / <narration> / <think> + 自由文本）原样交给
 *   MessageRenderer。这样 metadata 不会在聊天气泡里重复展示。
 *
 * 关键澄清：opening 里的 <message> 和 LLM 输出里的 <message> 是同一个标签，
 * 同一套渲染路由。不再像旧版那样把 opening <message> 当 meta 字段特殊处理。
 *
 * 详见 docs/contracts/chat-render-spec.md §11.7
 */

export interface ParsedOpening {
  /** opening 去掉 scenario / system 后的剩余部分，保留 message/narration/think
   *  等标签原样。整段塞进 messages 表第一行的 content。 */
  firstAssistantBody: string;
  scenarios: string[];
  systems: string[];
}

const META_TAG_RE = /<(scenario|system)>([\s\S]*?)<\/\1>/gi;

export function parseOpening(
  opening: string | null | undefined,
): ParsedOpening {
  const out: ParsedOpening = {
    firstAssistantBody: "",
    scenarios: [],
    systems: [],
  };
  if (!opening) return out;

  const remaining = opening.replace(META_TAG_RE, (_full, tag, body) => {
    const trimmed = (body as string).trim();
    if (trimmed) {
      const lower = (tag as string).toLowerCase();
      if (lower === "scenario") out.scenarios.push(trimmed);
      else out.systems.push(trimmed);
    }
    return "";
  });

  out.firstAssistantBody = remaining.trim();
  return out;
}

/**
 * 解析 {{user}} 应该落成的字面名字。优先级：当前会话面具名 → 账号 displayName →
 * username → Auth.js name → 兜底 "用户"。面具是玩家为这次扮演选的「我是谁」，所以
 * 压过账号名；没设面具就退回账号展示名。system prompt、开场白、每轮玩家消息包装
 * （player-turn.ts）共用这一条链路，保证模型读到的玩家称呼一致。
 */
export function resolveUserName(
  user: Pick<User, "displayName" | "username" | "name"> | null | undefined,
  mask?: Pick<UserMask, "name"> | null,
  locale: ConversationLocale = "zh-Hant",
): string {
  return (
    mask?.name ||
    user?.displayName ||
    user?.username ||
    user?.name ||
    {
      "zh-Hans": "用户",
      "zh-Hant": "使用者",
      "ja-JP": "ユーザー",
      "th-TH": "ผู้ใช้",
      en: "User",
    }[locale]
  );
}

/**
 * Replace {{char}} / {{user}} (case-insensitive, optional inner spaces) with
 * character / user names. Common role-play card convention.
 *
 * canonical master 和 creator section 都可能含 {{char}} / {{user}}。interpolate
 * 在六槽组装完成后统一跑一遍，但不清洗任何无关注释、变量或代码。
 *
 * Robust to paste-damaged variants seen in real cards:
 *   - 全角花括号       ｛{ char }}      → normalize ｛｝ to {}
 *   - 空 HTML 注释宏阻断 {<!-- -->{char}} → strip empty <!-- --> so it collapses
 *   - 大小写 / 内部空格  {{ CHAR }}      → /i + \s*
 */
export function interpolate(
  text: string,
  ctx: { char: string; user: string },
): string {
  return text
    .replace(/\{<!--\s*-->\{\s*(char|user)\s*\}\}/gi, (_, key: string) =>
      key.toLowerCase() === "char" ? ctx.char : ctx.user,
    )
    .replace(/[｛{][｛{]\s*(char|user)\s*[｝}][｝}]/gi, (_, key: string) =>
      key.toLowerCase() === "char" ? ctx.char : ctx.user,
    );
}

interface BuildSystemPromptInput {
  character: Pick<
    Character,
    | "name"
    | "persona"
    | "adversity"
    | "defaultCognition"
    | "plotSetting"
    | "outputSetting"
    | "sampleDialogue"
    | "opening"
  >;
  user: Pick<User, "displayName" | "username" | "name">;
  /**
   * 面具只在 SupplementalContext 的 `<UserInfo>` 用结构化字段。
   * 自由形式的面具块 + `mask.instruction`（$指令）改为每轮玩家消息注入，
   * 见 src/lib/ai/player-turn.ts —— 与「§五结构化 + 每轮 user 块」双重出现一致。
   */
  mask?: Pick<
    UserMask,
    "name" | "gender" | "description" | "preference"
  > | null;
  /**
   * All regex rules for the character. Only `enabled = true` rules with
   * non-empty `output_guidance` are folded into the system prompt — see
   * regex/prompt.ts. Pass `[]` when no rules exist.
   */
  rules?: RegexRule[];
  /** Natural-language output locale. UI locale is intentionally separate. */
  responseLocale?: ConversationLocale;
}

function joinSectionParts(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n\n");
}

function supplementalTag(
  tag: string,
  content: string | null | undefined,
): string | null {
  if (!content?.trim()) return null;
  return `<${tag}>\n${content}\n</${tag}>`;
}

/**
 * Assemble the roleplay prompt from the versioned, structured single-master
 * asset. The canonical template controls all fixed prose and the exact six-slot
 * order; this adapter only maps Dearm-owned fields into those declared slots.
 */
export function buildSystemPrompt({
  character,
  user,
  mask = null,
  rules = [],
  responseLocale = "zh-Hans",
}: BuildSystemPromptInput): string {
  const sections: Record<MasterRoleSection, string> = {
    CharaPrompt: joinSectionParts([
      character.persona,
      supplementalTag("DefaultCognition", character.defaultCognition),
    ]),
    // The canonical Greeting rules already tell the model this opening was
    // shown and must not be repeated. Keeping the complete opening preserves
    // creator HTML/tag/style examples instead of discarding visible content.
    Greeting: character.opening ?? "",
    OutputSetting: joinSectionParts([
      DEARM_OUTPUT_PROTOCOL,
      character.outputSetting,
      buildRegexGuidanceSection(rules),
    ]),
    StyleSamples: character.sampleDialogue ?? "",
    PlotSetting: character.plotSetting ?? "",
    SupplementalContext: joinSectionParts([
      buildResponseLanguageSection(responseLocale),
      supplementalTag("AdversityHandling", character.adversity),
      buildUserInfoSection(user, mask, responseLocale),
    ]),
  };

  const assembled = renderMasterPrompt({
    characterName: character.name,
    instructionLocale: masterInstructionLocaleFor(responseLocale),
    sections,
  });
  return interpolate(assembled, {
    char: character.name,
    user: resolveUserName(user, mask, responseLocale),
  });
}

/**
 * `<UserInfo>` —— active mask 的结构化呈现，放入 canonical
 * SupplementalContext。自由形式面具块 + `$指令` 仍走每轮 user 消息。
 * UserName 始终解析（面具名 → 账号名 → 兜底）；其余字段仅在面具提供时出现。
 * 描述/喜好用 {{user}} 占位由 interpolate 落成面具名（从模型视角是「关于玩家这个人」
 * 的客观信息）。自由形式面具块 + $指令 不在这里 —— 走每轮 user 消息（player-turn.ts）。
 */
function buildUserInfoSection(
  user: Pick<User, "displayName" | "username" | "name">,
  mask: Pick<UserMask, "name" | "gender" | "description" | "preference"> | null,
  responseLocale: ConversationLocale,
): string {
  const rows = [
    ["UserName", resolveUserName(user, mask, responseLocale)],
    ["UserGender", mask?.gender],
    ["UserDescription", mask?.description],
    ["UserPreference", mask?.preference],
  ]
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `<${label}>${value}</${label}>`);
  return `<UserInfo>\n${rows.join("\n")}\n</UserInfo>`;
}
