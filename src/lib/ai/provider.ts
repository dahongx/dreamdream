import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import type { ImageModel, LanguageModel } from "ai";
import { DEFAULT_MODEL_ID, type NimirModelId, resolveModelId } from "./models";
import { proxyFetch } from "./proxy-fetch";

/**
 * Provider abstraction — single seam so adding a new provider later is "drop
 * a new file + env switch", not "go edit every callsite".
 *
 * v1 wires Anthropic only. NIMIR_ANTHROPIC_BASE_URL is optional: blank → real
 * Anthropic API; set → custom relay (zhengmi / etc.). Key and URL never
 * appear in tracked files — read from env at call time.
 *
 * Naming: NIMIR_ prefix on purpose. Many devs export ANTHROPIC_* globally
 * for Claude Code / other tools, and shell env beats .env.local in
 * Next/Bun — NIMIR_* keeps this project's config its own.
 *
 * Models 走 `models.ts` 的注册表 —— per-call 临时切换由 client 传 model id
 * 到 API，API 用 `modelById(id)` 拿到对应 LanguageModel。
 * `defaultModel()` 仍保留无参签名，让暂时不接 picker 的调用点零改动。
 */

function getAnthropicProvider() {
  const apiKey = process.env.NIMIR_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NIMIR_ANTHROPIC_API_KEY is not set. Add it to .env.local before calling the chat API.",
    );
  }
  return createAnthropic({
    apiKey,
    baseURL: process.env.NIMIR_ANTHROPIC_BASE_URL || undefined,
    fetch: proxyFetch,
  });
}

function getDeepSeekProvider() {
  const apiKey = process.env.NIMIR_DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NIMIR_DEEPSEEK_API_KEY is not set. Add it to .env.local before calling DeepSeek models.",
    );
  }
  return createAnthropic({
    apiKey,
    baseURL:
      process.env.NIMIR_DEEPSEEK_BASE_URL || "http://107.167.18.218:3000/v1",
    fetch: proxyFetch,
  });
}

/**
 * Gemini 走 OpenAI-compat 中转（NewAPI）而非 Google 原生 REST。
 *
 * 背景：中转层（NewAPI 系）只接 /v1/chat/completions，Google 原生
 * /v1beta/models/{id}:generateContent 落到 SPA 首页直接失败。同时中转对
 * Google-only 字段（safetySettings / thinkingConfig）一律拒收
 * ("invalid param" 400），全部不能透传。
 *
 * 副作用：
 * - SAFETY OFF 无法从客户端强制，是否触发过滤由中转 + Google 上游决定。
 *   CLAUDE.md 「完全不做检测」的立场在 provider 层已尽力，剩下的是中转配置。
 * - NIMIR_GEMINI_THINKING_LEVEL / NIMIR_GEMINI_THINKING_BUDGET 两个环境
 *   变量在此路径下失效；env 名保留以便日后回切原生零改动。
 *
 * 走 streamText 真流式，一次响应可持续数分钟；不挂 per-attempt fetch 超时
 * （会中途掐流）。中转卡住的收敛靠 chat/route.ts 的 maxRetries: 1 + 上游
 * AI SDK 自身错误处理。
 */
function getGeminiOpenAIProvider() {
  const apiKey = process.env.NIMIR_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NIMIR_GOOGLE_API_KEY is not set. Add it to .env.local before calling Gemini models.",
    );
  }
  return createOpenAI({
    apiKey,
    baseURL:
      process.env.NIMIR_GOOGLE_BASE_URL || "http://107.167.18.218:3000/v1",
    fetch: proxyFetch,
  });
}

function getOpenAIProvider() {
  const apiKey = process.env.NIMIR_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NIMIR_OPENAI_API_KEY is not set. Add it to .env.local before generating images.",
    );
  }
  return createOpenAI({
    apiKey,
    baseURL: process.env.NIMIR_OPENAI_BASE_URL || undefined,
    fetch: proxyFetch,
  });
}

/**
 * Registry id（面向用户 / pricing / 历史 messages 的稳定 key）
 *   → provider 实际请求的 model id。
 * 只在 provider 调用瞬间做映射，registry / i18n / pricing / 历史数据保持原 id
 * （gemini-3.1-pro-preview），避免历史 cost / debug / cleanup 脚本失联。
 *
 * NewAPI 中转 "Gemini-逆 (distributor)" group 下：
 * - "gemini-3.1-pro" wire id 已经无 channel（503 model_not_found）
 * - "gemini-3-pro" 目前仍匹配到 channel（跟 test_gemini_3_pro.py 的 wire id
 *   一致，2026-09-15 验证）；额度耗尽会返回 429 而非 503，便于区分"路由缺失"
 *   和"上游限流"两类故障。
 * registry / i18n / pricing / 历史 messages 全部保持 "gemini-3.1-pro-preview"
 * 不动，避免历史 cost / debug / cleanup 脚本失联。
 */
const PROVIDER_MODEL_ID_OVERRIDES: Partial<Record<NimirModelId, string>> = {
  "gemini-3.1-pro-preview": "gemini-3-pro",
};

export function modelById(id: NimirModelId): LanguageModel {
  const providerModelId = PROVIDER_MODEL_ID_OVERRIDES[id] ?? id;
  if (id.startsWith("deepseek-ai/")) {
    return getDeepSeekProvider()(providerModelId);
  }
  if (id.startsWith("gemini-")) {
    // .chat() 显式走 /v1/chat/completions；@ai-sdk/openai 默认 provider(id)
    // 现在（v3.x）会路由到 /v1/responses（Responses API）。NewAPI 中转的
    // Gemini backend 只实现了 Chat Completions（跟 test_gemini_3_pro.py 对齐
    // 的路径），/v1/responses 直接返回 "not implemented" +
    // convert_request_failed 500。
    return getGeminiOpenAIProvider().chat(providerModelId);
  }
  if (id.startsWith("gpt-")) {
    return getOpenAIProvider()(providerModelId);
  }
  if (id.startsWith("gpt-")) {
    return getOpenAIProvider()(providerModelId);
  }
  return getAnthropicProvider()(providerModelId);
}

export function providerOptionsByModelId(
  id: NimirModelId,
): SharedV3ProviderOptions | undefined {
  if (id.startsWith("deepseek-ai/")) {
    return {
      anthropic: {
        thinking: { type: "disabled" as const },
      },
    };
  }

  // Gemini 走 OpenAI-compat 中转，Google-native providerOptions
  // (safetySettings / thinkingConfig) 全部无法透传，一律不注入。
  // 温度仍由 chat/route.ts 的 requestedTemperature 单独传给 streamText。
  return undefined;
}

export function imageModelById(
  id = process.env.NIMIR_OPENAI_IMAGE_MODEL ?? "gpt-image-2",
): ImageModel {
  return getOpenAIProvider().image(id);
}

export function defaultModel(): LanguageModel {
  return modelById(DEFAULT_MODEL_ID);
}

export { DEFAULT_MODEL_ID, resolveModelId };
export type { NimirModelId };
