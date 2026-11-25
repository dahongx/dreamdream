import type { UIMessage } from "ai";
import type { GeminiFilterDiagnostics } from "@/lib/ai/gemini-filter-diagnostics";

/**
 * Shared debug/perf metadata types for the chat surface.
 *
 * Lives in lib/ (not the component) so the API route (server) can build the
 * payload without importing client components, and so the same type drives the
 * useChat message metadata channel — see src/app/api/chat/route.ts where the
 * debug payload is streamed back as a trailing `message-metadata` chunk.
 *
 * 安全边界：DebugInfo 含 systemPrompt（host 级 prompt 工程，属不可外泄资产）。
 * route 只对 isDeveloperEmail 白名单往流里写这些字段；page.tsx 的 debugMetaMap
 * 同样只对 canDebug 填充。非开发者拿不到任何 debug 字段。
 */

export interface DebugInfo {
  rawOutput: string;
  systemPrompt: string;
  promptAdapterVersion?: string;
  promptTemplateId?: string;
  promptTemplateSha256?: string;
  promptBundleSha256?: string;
  promptInstructionLocale?: "zh-Hans" | "en";
  promptResponseLocale?: "zh-Hans" | "zh-Hant" | "en" | "ja-JP" | "th-TH";
  promptLengthChars?: number;
  activeRuleCount?: number;
  trigger?: "submit-message" | "regenerate-message";
  historySource?: "client" | "database";
  sampling?: {
    temperature: number | null;
    topP: number | null;
    topK: number | null;
    seed: number | null;
  };
  requestPromptFingerprint?: string;
  lastUserFingerprint?: string;
  clientLastUserFingerprint?: string;
  rejectedResponseFingerprint?: string | null;
  regenerationReferenceChars?: number;
  matchedRules: Array<{ id: string; name: string }>;
  unmatchedRules: Array<{ id: string; name: string }>;
  /**
   * Gemini safety filter (or relay-side equivalent) truncated this turn.
   * Surface a regenerate hint to the user — see ChatRoom rendering.
   */
  truncatedBySafety?: boolean;
  /** The player deliberately stopped this generation before normal finish. */
  stoppedByUser?: boolean;
  /** Sanitized upstream diagnostics; never contains prompt or response text. */
  providerFilterDiagnostics?: GeminiFilterDiagnostics;
}

export interface DebugMeta {
  debug: DebugInfo | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  costMillicents: number | null;
  costCnyMillicents: number | null;
  latencyMs: number | null;
  /**
   * 这一轮由 SAFETY 拦截（Gemini content-filter 或非 Gemini 模型自身 refusal）。
   * 所有用户可见（不像 debug 只对 developer 暴露）—— 客户端据此维护
   * 「连续 content-filter 计数」触发 3 次硬上限。
   */
  safetyBlocked: boolean;
  /** Public, non-sensitive marker used to render and shape stopped replies. */
  stoppedByUser: boolean;
}

/** Build metadata that is safe to expose to every player. */
export function createPublicChatMeta({
  safetyBlocked = false,
  stoppedByUser = false,
}: {
  safetyBlocked?: boolean;
  stoppedByUser?: boolean;
} = {}): DebugMeta {
  return {
    debug: null,
    model: null,
    tokensIn: null,
    tokensOut: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    reasoningTokens: null,
    costMillicents: null,
    costCnyMillicents: null,
    latencyMs: null,
    safetyBlocked,
    stoppedByUser,
  };
}

/**
 * UIMessage specialized with DebugMeta as its metadata payload. The API route
 * streams a DebugMeta back on the `finish` of each developer-visible turn; the
 * client reads it off `message.metadata` so the debug panel appears without a
 * page refresh (previously the data only arrived via RSC on reload).
 */
export type ChatUIMessage = UIMessage<DebugMeta>;
