import type { NimirModelId } from "./models";

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
  reasoningPerMTok: number;
  // USD→CNY exchange rate used to compute messages.cost_cny_millicents at
  // write time. Editable per-model in admin so a provider invoiced in RMB
  // vs USD can carry its own conversion (and admin can tune for the
  // settlement window's actual rate).
  usdCnyRate: number;
}

// USD per 1M tokens — fallback used only if the model_prices DB row is
// missing (e.g. fresh CI without migration, DB outage). In production the
// authoritative source is the `model_prices` table, editable by admins
// from /settings. Keep this aligned with the seed values in
// drizzle/0019_model_prices.sql so behavior matches across both paths.
//
// Anthropic：cache_write 按 5-min TTL 档（1.25× input）；reasoning_token 计入 output。
// Google：cache_read 按 input × 10%；Google 是按 storage/hr 收费而非 per-write，
//   且 vercel ai-sdk 的 Google provider 不上报 cache_write_tokens，所以这里设为 0。
// DeepSeek：cache_write = cache miss input（无独立写入计费）。
// Sources: anthropic.com/pricing, ai.google.dev/pricing, api-docs.deepseek.com
const FALLBACK_PRICING: Record<NimirModelId, ModelPricing> = {
  "claude-opus-4-7": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheReadPerMTok: 0.5,
    cacheWritePerMTok: 6.25,
    reasoningPerMTok: 25,
    usdCnyRate: 7.2,
  },
  "claude-sonnet-4-6": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadPerMTok: 0.3,
    cacheWritePerMTok: 3.75,
    reasoningPerMTok: 15,
    usdCnyRate: 7.2,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheReadPerMTok: 0.1,
    cacheWritePerMTok: 1.25,
    reasoningPerMTok: 5,
    usdCnyRate: 7.2,
  },
  // Gemini Pro 是分档计费：≤200K 一档，>200K 整条请求（input + output）翻倍。
  // 我们没法在记账时点知道请求是否会跨档（流式 + 多轮 cache），所以**默认走最贵的 >200K 档**，
  // 保证账面不会低估实际 Google 账单。代价是 ≤200K 的请求会被略微高估。
  "gemini-3.1-pro-preview": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  // Gemini Flash 系列单档计价（无 ≤200K / >200K 分档），cache_read 仍按 input × 10%。
  "gemini-3-flash": {
    inputPerMTok: 0.5,
    outputPerMTok: 3,
    cacheReadPerMTok: 0.05,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 3,
    usdCnyRate: 7.2,
  },
  "gemini-3.5-flash": {
    inputPerMTok: 1.5,
    outputPerMTok: 9,
    cacheReadPerMTok: 0.15,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 9,
    usdCnyRate: 7.2,
  },
  // 2026-09-17 接入的中转 Gemini 全系：**一律按 gemini-3.1-pro-preview 同价**
  // （$4 in / $18 out / $0.40 cache read，走 >200K 保守档；per-call 1 金币 /
  // 2 银币）。这是产品决定，不是 Google 官方价 —— 这批 id 不在 Google 价目表
  // 里，中转也没给价目接口：
  //   - 同一个「Gemini 档位」不分 Pro / Flash 计价，跟 UI 上其它 Gemini 档的
  //     扣费保持一致，避免用户看到同名家族价格不一致。
  //   - thinking-128 / low / high / medium 只是思考预算不同，per-token 单价一样；
  //     预算影响的是 reasoning token 数量，会通过 reasoning tokens 自然计进成本。
  //   - 真实 Google 价大概率比这低（Flash 档官方只要 $0.50-$1.50 in），所以这套
  //     价格是**偏高**的保守值。要改成真实成本价，走 /settings 计费配置覆盖。
  "gemini-3.1-pro-preview-thinking-128": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.1-pro-low": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3-flash-thinking-128": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.1-flash": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.6-flash": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.6-flash-high": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.7-flash": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.7-flash-high": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.7-flash-medium": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.7-flash-low": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.7-flash-tiered": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.8-flash": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "gemini-3.8-flash-high": {
    inputPerMTok: 4,
    outputPerMTok: 18,
    cacheReadPerMTok: 0.4,
    cacheWritePerMTok: 0,
    reasoningPerMTok: 18,
    usdCnyRate: 7.2,
  },
  "deepseek-ai/DeepSeek-V4-Pro": {
    inputPerMTok: 0.435,
    outputPerMTok: 0.87,
    cacheReadPerMTok: 0.003625,
    cacheWritePerMTok: 0.435,
    reasoningPerMTok: 0.87,
    usdCnyRate: 7.2,
  },
  "gpt-5.6-sol": {
    inputPerMTok: 2.5,
    outputPerMTok: 10,
    cacheReadPerMTok: 1.25,
    cacheWritePerMTok: 2.5,
    reasoningPerMTok: 10,
    usdCnyRate: 7.2,
  },
};

const IMAGE_COST_MILLICENTS = 4000; // $0.04 per image (medium quality)

const CACHE_TTL_MS = 30_000;
// Integer-micro encoding: 1.0 → 1_000_000. Used for both USD prices and
// the USD→CNY rate so DB columns stay int and conversions are lossless.
const MICRO_DIVISOR = 1_000_000;

let pricingCache: Map<string, ModelPricing> | null = null;
let cacheLoadedAt = 0;
let inflight: Promise<Map<string, ModelPricing>> | null = null;

function fromMicroUsd(microUsd: number): number {
  return microUsd / MICRO_DIVISOR;
}

async function loadPricingFromDb(): Promise<Map<string, ModelPricing>> {
  const map = new Map<string, ModelPricing>();
  // Lazy import so this module stays importable in contexts without
  // DATABASE_URL (e.g. unit tests of pure helpers, build-time tree-shaking).
  try {
    const { db } = await import("@/lib/db/client");
    const { modelPrices } = await import("@/lib/db/schema");
    const rows = await db.select().from(modelPrices);
    for (const r of rows) {
      map.set(r.modelId, {
        inputPerMTok: fromMicroUsd(r.inputPerMTokMicroUsd),
        outputPerMTok: fromMicroUsd(r.outputPerMTokMicroUsd),
        cacheReadPerMTok: fromMicroUsd(r.cacheReadPerMTokMicroUsd),
        cacheWritePerMTok: fromMicroUsd(r.cacheWritePerMTokMicroUsd),
        reasoningPerMTok: fromMicroUsd(r.reasoningPerMTokMicroUsd),
        usdCnyRate: r.usdCnyRateMicro / MICRO_DIVISOR,
      });
    }
  } catch (err) {
    // DB unavailable (build, cold CI, transient outage). Caller falls back
    // to FALLBACK_PRICING per-model. Log so it shows up in monitoring.
    console.warn(
      "[pricing] DB load failed, using fallback table:",
      err instanceof Error ? err.message : err,
    );
  }
  return map;
}

async function ensureCache(): Promise<Map<string, ModelPricing>> {
  const now = Date.now();
  if (pricingCache && now - cacheLoadedAt < CACHE_TTL_MS) {
    return pricingCache;
  }
  if (inflight) return inflight;
  inflight = loadPricingFromDb().then((map) => {
    pricingCache = map;
    cacheLoadedAt = Date.now();
    inflight = null;
    return map;
  });
  return inflight;
}

/**
 * Invalidate the in-process pricing cache. Call from admin server actions
 * after writing a new price so the next billing computation in this
 * process picks it up immediately. Other processes catch up within one
 * CACHE_TTL_MS window.
 */
export function invalidatePricingCache(): void {
  pricingCache = null;
  cacheLoadedAt = 0;
}

export async function getModelPricing(
  modelId: string,
): Promise<ModelPricing | null> {
  const map = await ensureCache();
  const fromDb = map.get(modelId);
  if (fromDb) return fromDb;
  return FALLBACK_PRICING[modelId as NimirModelId] ?? null;
}

export interface TokenUsageDetails {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

export function extractUsageDetails(usage: {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    reasoningTokens?: number;
    textTokens?: number;
  };
}): TokenUsageDetails {
  return {
    inputTokens: usage.inputTokens ?? undefined,
    outputTokens: usage.outputTokens ?? undefined,
    cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? undefined,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? undefined,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? undefined,
  };
}

/**
 * Calculate cost in millicents (1 USD = 100_000 millicents).
 * Integer storage avoids floating-point drift in aggregations.
 *
 * Reads the per-model price from the DB-backed cache (refreshed every
 * CACHE_TTL_MS). Falls back to FALLBACK_PRICING for models not in the DB
 * so a missing seed never silently zeroes out costs.
 */
export async function calculateCostMillicents(
  modelId: string,
  details: TokenUsageDetails,
): Promise<number> {
  const pricing = await getModelPricing(modelId);
  if (!pricing) return 0;

  const inputTokens = details.inputTokens ?? 0;
  const outputTokens = details.outputTokens ?? 0;
  const cacheRead = details.cacheReadTokens ?? 0;
  const cacheWrite = details.cacheWriteTokens ?? 0;
  const reasoning = details.reasoningTokens ?? 0;

  // Non-cached input = total input - cache tokens
  const plainInput = Math.max(0, inputTokens - cacheRead - cacheWrite);
  const textOutput = Math.max(0, outputTokens - reasoning);

  const costUsd =
    (plainInput / 1_000_000) * pricing.inputPerMTok +
    (cacheRead / 1_000_000) * pricing.cacheReadPerMTok +
    (cacheWrite / 1_000_000) * pricing.cacheWritePerMTok +
    (textOutput / 1_000_000) * pricing.outputPerMTok +
    (reasoning / 1_000_000) * pricing.reasoningPerMTok;

  return Math.round(costUsd * 100_000);
}

export function calculateImageCostMillicents(): number {
  return IMAGE_COST_MILLICENTS;
}

/**
 * Convert a USD cost (in millicents) to a CNY cost (also in millicents-
 * equivalent CNY-per-100_000) using the model's frozen rate.
 *
 * Stored alongside cost_millicents at write time so later rate edits
 * never retroactively rewrite past CNY accounting.
 */
export function calculateCnyMillicents(
  usdMillicents: number,
  rate: number,
): number {
  return Math.round(usdMillicents * rate);
}

export function formatCostUsd(millicents: number): string {
  return `$${(millicents / 100_000).toFixed(4)}`;
}

export function formatCostCny(millicents: number, rate = 7.2): string {
  return `¥${((millicents / 100_000) * rate).toFixed(4)}`;
}
