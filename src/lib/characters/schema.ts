import { z } from "zod";
import { SFW_MODE } from "@/lib/config/site";
import { normalizeCharacterTags } from "./tags";

/**
 * Zod schema for the character form.
 * Aligned with characters table in src/lib/db/schema.ts and the 16-field UI
 * groups (A/B/C/D) from docs/exec-plans/v1-foundation.md §四 模块 3.
 *
 * Empty strings on optional textareas come back as undefined so we don't write
 * "" rows that confuse downstream consumers (e.g. system prompt assembly).
 */

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

export interface CharacterFormMessages {
  nameRequired: string;
  personaRequired: string;
}

export function createCharacterFormSchema(messages: CharacterFormMessages) {
  return z.object({
    // A. meta
    name: z.string().min(1, messages.nameRequired).max(128),
    gender: z.enum(["male", "female", "other", "unset"]).default("unset"),
    age: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.coerce.number().int().min(0).max(9999).nullable().optional(),
    ),
    // SFW 版把 nsfw 钉死为 false —— 这是写入层而非展示层的收口。
    // 只藏角标不够：creator 若仍能自报 nsfw=true，库里就会存在成人类卡，
    // 而 SFW 版不该有这种东西。放在 schema 里意味着 create 与 update 两条
    // 链路都自动生效，不必记得在每处 action 里补一刀。
    nsfw: z.coerce
      .boolean()
      .default(false)
      .transform((v) => (SFW_MODE ? false : v)),
    isAi: z.coerce.boolean().default(false),
    contentType: z
      .enum(["original", "self_designed", "fanwork"])
      .default("original"),
    coverImageUrl: optionalUrl,
    avatarUrl: optionalUrl,
    tags: z.preprocess(
      normalizeCharacterTags,
      z.array(z.string().refine((tag) => tag.length <= 32)).max(20),
    ),
    bio: optionalText,
    // 作者的话（展示性，给玩家看，不进 prompt）
    creatorNote: optionalText,
    visibility: z.enum(["public", "private", "unlisted"]).default("private"),

    // B. persona (LLM-bound)
    persona: z.string().min(1, messages.personaRequired),
    adversity: optionalText,
    defaultCognition: optionalText,
    opening: optionalText,

    // C. advanced
    plotSetting: optionalText,
    outputSetting: optionalText,
    sampleDialogue: optionalText,
  });
}

export const characterFormSchema = createCharacterFormSchema({
  nameRequired: "请填角色名",
  personaRequired: "人设不能为空",
});

export type CharacterFormInput = z.input<typeof characterFormSchema>;
export type CharacterFormParsed = z.output<typeof characterFormSchema>;
