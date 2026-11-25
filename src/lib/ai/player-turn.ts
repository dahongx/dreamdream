import type { UserMask } from "@/lib/db/schema";
import { interpolate } from "./build-prompt";
import type { ConversationLocale } from "./conversation-locale";

/**
 * 每轮玩家消息包装 —— 与 canonical user 回合契约对齐；现行来源见
 * docs/handover/master-prompt.md。
 *
 * canonical 模板的玩家身份是「双重注入」：①系统层 §五 结构化 <UserInfo>（build-prompt.ts）；
 * ②每一条 user 消息前置「OOC 约定头 + 自由面具块 + $指令 + 📝 台词标记 + 尾部格式
 * 提醒」。本模块复刻 ②。
 *
 * 三条铁律：
 *  - 包装只发给模型，不落库（DB 里 user 消息仍存原始文本）。
 *  - $指令 逻辑 = 纯 prompt：不写 parser、不 strip，靠约定头 + host §五「用户输入理解」
 *    让模型识别 OOC。玩家内联的 $.../(...) 原样保留。
 *  - 面具块占位符过 interpolate（{{user}} → 面具名），与 system prompt 同一条命名链。
 */

/**
 * true = 每条 user 消息都包装（1:1 复刻上游每轮重复）。
 * 切 false 则只包装最新一条 user 消息，省多轮历史的重复 token。
 */
export const INJECT_EVERY_TURN = true;

export const OOC_CONVENTION_HEADER = `---
注意：玩家使用 ($...)、(...)、（...）、＄... 或 $指令 来表达场外诉求（OOC）。
以下是玩家的剧情控制/OOC诉求（如有）：
---`;

export const TRAILING_FORMAT_REMINDER = `---
保持正文与状态栏输出与开场白(Greeting)格式一致，并参照 OutputSetting 的输出格式，严格遵循 xml/html 标签结构与顺序。
如果玩家的番外请求正常，请正常生成番外。`;

interface PlayerTurnCopy {
  oocHeader: string;
  trailingReminder: string;
  instructionHeading: string;
  inputHeading: string;
  fields: {
    name: string;
    gender: string;
    description: string;
    preference: string;
  };
}

const PLAYER_TURN_COPY: Record<ConversationLocale, PlayerTurnCopy> = {
  "zh-Hans": {
    oocHeader: OOC_CONVENTION_HEADER,
    trailingReminder: TRAILING_FORMAT_REMINDER,
    instructionHeading: "【玩家常驻指令 · 每轮必须严格遵守】",
    inputHeading: "📝 玩家剧情/台词输入：\n---",
    fields: {
      name: "姓名",
      gender: "性别",
      description: "{{user}}的描述",
      preference: "{{user}}的喜好",
    },
  },
  "zh-Hant": {
    oocHeader: `---
注意：玩家會使用 ($...)、(...)、（...）、＄... 或以 $ 開頭的指令來表達場外需求（OOC）。
以下是玩家的劇情控制／OOC 需求（如有）：
---`,
    trailingReminder: `---
正文與狀態欄的輸出須與開場白（Greeting）格式一致，並參照 OutputSetting 的輸出格式，嚴格遵循 XML/HTML 標籤結構與順序。
若玩家提出合理的番外要求，請正常生成番外。`,
    instructionHeading: "【玩家常駐指令 · 每輪都必須嚴格遵守】",
    inputHeading: "📝 玩家劇情／台詞輸入：\n---",
    fields: {
      name: "姓名",
      gender: "性別",
      description: "{{user}}的描述",
      preference: "{{user}}的喜好",
    },
  },
  en: {
    oocHeader: `---
Note: The player uses ($...), (...), full-width parentheses, or instructions beginning with $ to express out-of-character requests (OOC).
The player's story-control or OOC requests, if any, follow below:
---`,
    trailingReminder: `---
Keep the main text and status-panel output consistent with the Greeting format. Follow OutputSetting exactly, including the XML/HTML tag structure and order.
If the player's side-story request is valid, write the side story normally.`,
    instructionHeading:
      "【Standing player instructions · Follow strictly every turn】",
    inputHeading: "📝 Player action / dialogue input:\n---",
    fields: {
      name: "Name",
      gender: "Gender",
      description: "Description of {{user}}",
      preference: "Preferences of {{user}}",
    },
  },
  "ja-JP": {
    oocHeader: `---
注意：プレイヤーは ($...)、(...)、全角括弧、または $ で始まる指示を使って、物語外の要望（OOC）を伝えます。
以下は、プレイヤーによる物語制御／OOCの要望です（ある場合）：
---`,
    trailingReminder: `---
本文とステータス欄は Greeting の形式に合わせ、OutputSetting で指定された XML/HTML タグの構造と順序を厳守してください。
プレイヤーから妥当な番外編の要望がある場合は、通常どおり番外編を書いてください。`,
    instructionHeading: "【プレイヤーの常設指示 · 毎ターン必ず厳守すること】",
    inputHeading: "📝 プレイヤーの行動／台詞：\n---",
    fields: {
      name: "名前",
      gender: "性別",
      description: "{{user}}の人物像",
      preference: "{{user}}の好み",
    },
  },
  "th-TH": {
    oocHeader: `---
หมายเหตุ: ผู้เล่นใช้ ($...), (...), วงเล็บแบบเต็มความกว้าง หรือคำสั่งที่ขึ้นต้นด้วย $ เพื่อบอกความต้องการนอกบทบาท (OOC)
คำขอควบคุมเนื้อเรื่องหรือคำขอ OOC ของผู้เล่น (ถ้ามี) อยู่ด้านล่าง:
---`,
    trailingReminder: `---
รักษารูปแบบเนื้อหาหลักและแผงสถานะให้สอดคล้องกับ Greeting และทำตามโครงสร้างรวมถึงลำดับแท็ก XML/HTML ที่กำหนดใน OutputSetting อย่างเคร่งครัด
หากคำขอเรื่องเสริมของผู้เล่นเหมาะสม ให้เขียนเรื่องเสริมตามปกติ`,
    instructionHeading: "【คำสั่งถาวรของผู้เล่น · ต้องปฏิบัติตามอย่างเคร่งครัดทุกเทิร์น】",
    inputHeading: "📝 การกระทำ / บทพูดของผู้เล่น:\n---",
    fields: {
      name: "ชื่อ",
      gender: "เพศ",
      description: "คำอธิบายของ {{user}}",
      preference: "ความชอบของ {{user}}",
    },
  },
};

type MaskForTurn = Pick<
  UserMask,
  "name" | "gender" | "description" | "preference" | "instruction"
> | null;

/** $指令块标题 —— 让模型把面具的 standing 指令当「必须遵守的常驻命令」而非人设附注。 */
export const MASK_INSTRUCTION_HEADING = "【玩家常驻指令 · 每轮必须严格遵守】";

/**
 * 自由形式面具块：姓名/性别/{{user}}的描述/{{user}}的喜好（人设行）+ mask.instruction（standing $指令）。
 * $指令 单独成块并加显式标注 MASK_INSTRUCTION_HEADING，与人设行用空行隔开 —— 不再裸贴在
 * 人设后面（那样模型易把它当人设附注忽略，否定式指令尤甚，是「面具指令不执行」的主因之一）。
 * 无面具时返回空串（包装里跳过该段，对齐「面具块（如有）」）。
 */
function buildMaskBlock(mask: MaskForTurn, copy: PlayerTurnCopy): string {
  if (!mask) return "";
  const rows = [
    [copy.fields.name, mask.name],
    [copy.fields.gender, mask.gender],
    [copy.fields.description, mask.description],
    [copy.fields.preference, mask.preference],
  ]
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}：${value}`);

  const persona = rows.join("\n");
  const instruction = mask.instruction?.trim() ?? "";
  const instructionBlock = instruction
    ? `${copy.instructionHeading}\n${instruction}`
    : "";
  return [persona, instructionBlock].filter(Boolean).join("\n\n");
}

/**
 * 把一条 user 消息文本包装成 canonical 的每轮 user 回合形态。
 * ctx 提供 {{char}} / {{user}} 的字面名（用 resolveUserName 解析后传入）。
 */
export function wrapPlayerTurn(
  text: string,
  mask: MaskForTurn,
  ctx: { char: string; user: string },
  locale: ConversationLocale = "zh-Hant",
): string {
  const copy = PLAYER_TURN_COPY[locale];
  const maskBlock = buildMaskBlock(mask, copy);
  const wrapped = [
    copy.oocHeader,
    maskBlock,
    copy.inputHeading,
    text,
    copy.trailingReminder,
  ]
    .filter((segment) => segment?.trim())
    .join("\n");
  return interpolate(wrapped, ctx);
}

/**
 * 从 convertToModelMessages 产出的 user content（string 或 text parts 数组）里取纯文本。
 * 本平台 user 消息是纯文本（无附件），collapse 成字符串即可。
 */
export function extractModelMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (p): p is { type: "text"; text: string } =>
          Boolean(p) &&
          typeof p === "object" &&
          (p as { type?: unknown }).type === "text",
      )
      .map((p) => p.text)
      .join("");
  }
  return "";
}
