/**
 * Public types — re-exported from schema inference + a few hand-rolled domain helpers.
 * Import via `@/types`.
 */

export type {
  Character,
  CharacterComment,
  CharacterCommentLike,
  CharacterOpeningSlotValue,
  ChatSession,
  CreatorCharacterCursor,
  CreatorEarningRecord,
  CreatorFansCursor,
  Message,
  MessageAttachment,
  NewCharacter,
  NewCharacterComment,
  NewChatSession,
  NewMessage,
  NewOpeningComponent,
  NewRegexRule,
  NewStudioSession,
  NewUser,
  NewUserMask,
  OpeningComponent,
  OpeningComponentOverride,
  RegexRule,
  StudioDraftPayload,
  StudioSession,
  User,
  UserMask,
  UserRegexPreference,
} from "@/lib/db/schema";

export type Gender = "male" | "female" | "other" | "unset";
export type Visibility = "public" | "private" | "unlisted";
export type ContentType = "original" | "self_designed" | "fanwork";
export type MessageRole = "user" | "assistant";
export type RegexRuntime = "sanitize" | "iframe";

/**
 * Per-message debug payload — written by the chat pipeline, surfaced in the
 * debug panel (visible only to the character's owner per v1-foundation §模块 8).
 */
export interface MessageDebugInfo {
  rawOutput: string;
  systemPrompt: string;
  finishReason?: string;
  matchedRules: Array<{ id: string; name: string }>;
  unmatchedRules: Array<{ id: string; name: string }>;
  truncatedBySafety?: boolean;
  promptAdapterVersion?: string;
  promptTemplateId?: string;
  promptTemplateSha256?: string;
  promptBundleSha256?: string;
  promptInstructionLocale?: "zh-Hans" | "en";
  promptResponseLocale?: "zh-Hans" | "zh-Hant" | "en" | "ja-JP" | "th-TH";
  promptLengthChars?: number;
  activeRuleCount?: number;
  lastContinuation?: { finishReason: string; appendedChars: number };
  toolCalls?: Array<{ name: string; argsJson: string; resultJson?: string }>;
}

export interface VariableMappingEntry {
  index: number;
  name: string;
  sample?: string;
}
