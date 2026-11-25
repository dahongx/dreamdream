/**
 * Dearm 暴露给用户的模型档位（per-call 临时切换，不持久化）。
 *
 * id 是 provider-facing model id，provider.ts 根据 id 前缀路由到对应
 * Anthropic / Google / DeepSeek-compatible provider。
 *
 * label / hint 只是给 i18n 兜底；UI 优先读 dict.modelPicker.labels[id]。
 */

export const NIMIR_MODELS = [
  {
    id: "deepseek-ai/DeepSeek-V4-Pro",
    label: "DeepSeek V4 Pro",
    hint: "默认 · 国模",
  },
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    hint: "最强 · 慢",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    hint: "均衡 · 默认",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    hint: "最快 · 便宜",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    hint: "Google · 高阶",
  },
  {
    id: "gemini-3.1-pro-preview-thinking-128",
    label: "Gemini 3.1 Pro (thinking-128)",
    hint: "Google · 高阶 · 长思考",
  },
  {
    id: "gemini-3.1-pro-low",
    label: "Gemini 3.1 Pro (low)",
    hint: "Google · 高阶 · 低思考",
  },
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash",
    hint: "Google · 快",
  },
  {
    id: "gemini-3-flash-thinking-128",
    label: "Gemini 3 Flash (thinking-128)",
    hint: "Google · 快 · 长思考",
  },
  {
    id: "gemini-3.1-flash",
    label: "Gemini 3.1 Flash",
    hint: "Google · 快",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    hint: "Google · 快",
  },
  {
    id: "gemini-3.6-flash-high",
    label: "Gemini 3.6 Flash (high)",
    hint: "Google · 快 · 高思考",
  },
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    hint: "Google · 快",
  },
  {
    id: "gemini-3.7-flash-high",
    label: "Gemini 3.7 Flash (high)",
    hint: "Google · 快 · 高思考",
  },
  {
    id: "gemini-3.7-flash-medium",
    label: "Gemini 3.7 Flash (medium)",
    hint: "Google · 快 · 中思考",
  },
  {
    id: "gemini-3.7-flash-low",
    label: "Gemini 3.7 Flash (low)",
    hint: "Google · 快 · 低思考",
  },
  {
    id: "gemini-3.7-flash-tiered",
    label: "Gemini 3.7 Flash (tiered)",
    hint: "Google · 快 · 分档",
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    hint: "Google · 快 · 新",
  },
  {
    id: "gemini-3.8-flash-high",
    label: "Gemini 3.8 Flash (high)",
    hint: "Google · 快 · 新 · 高思考",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    hint: "Google · 快 · 新",
  },
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6-sol",
    hint: "OpenAI · 均衡",
  },
] as const;

export type NimirModelId = (typeof NIMIR_MODELS)[number]["id"];

export const NIMIR_MODEL_IDS = NIMIR_MODELS.map(
  (m) => m.id,
) as unknown as readonly [NimirModelId, ...NimirModelId[]];

/**
 * 对外隐藏的档位：仍保留在 NIMIR_MODELS 里供 provider 路由 / pricing / 旧消息
 * 回显（历史消息可能记着这些 id），只是不再进用户可选的下拉。
 * 保留通路是刻意的 —— 移除 id 会让存量 session 的 localStorage / debug_info
 * 里的旧 modelId 失去 label 与计费兜底。
 *
 * gemini-3.5-flash 是 2026-09-17 加进来才发现中转已下线的：模型还在 /v1/models
 * 列表里，但请求会返回 200 + "Gemini 3.5 Flash is no longer available" 文案。
 * 留在注册表里给历史消息兜底，不进下拉。
 */
const HIDDEN_MODEL_IDS = new Set<NimirModelId>([
  "deepseek-ai/DeepSeek-V4-Pro",
  "claude-haiku-4-5-20251001",
  "gemini-3.5-flash",
]);

/** 用户下拉读这份：注册表里的 Gemini 全系 + Claude opus/sonnet + GPT。 */
export const NIMIR_VISIBLE_MODELS = NIMIR_MODELS.filter(
  (m) => !HIDDEN_MODEL_IDS.has(m.id),
);

export const DEFAULT_MODEL_ID: NimirModelId = "claude-sonnet-4-6";

export function isNimirModelId(x: unknown): x is NimirModelId {
  return (
    typeof x === "string" && (NIMIR_MODEL_IDS as readonly string[]).includes(x)
  );
}

export function resolveModelId(requested: unknown): NimirModelId {
  return isNimirModelId(requested) ? requested : DEFAULT_MODEL_ID;
}
