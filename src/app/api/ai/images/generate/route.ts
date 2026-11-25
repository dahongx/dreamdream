import { generateImage } from "ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ai/generators/rate-limit";
import {
  calculateCnyMillicents,
  calculateImageCostMillicents,
  formatCostUsd,
  getModelPricing,
} from "@/lib/ai/pricing";
import { imageModelById } from "@/lib/ai/provider";
import { proxyFetch } from "@/lib/ai/proxy-fetch";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  checkCurrencyBalanceAmount,
  deductCurrencyAmount,
  imageCostFor,
  refundCurrencyAmount,
  settleTransactionCost,
} from "@/lib/billing/currency";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  target: z.enum(["cover", "avatar"]),
  prompt: z.string().min(1).max(4000),
  currencyType: z.enum(["gold", "silver"]).optional(),
});

function targetSize(target: "cover" | "avatar"): `${number}x${number}` {
  return target === "avatar" ? "1024x1024" : "1024x1536";
}

/**
 * Some relays (e.g. zhengmi) return `{ data: [{ url }] }` instead of
 * `{ data: [{ b64_json }] }`. The AI SDK's Zod schema rejects this.
 * Fall back to a raw fetch when the SDK call fails with a validation error.
 */
async function generateImageWithFallback(
  prompt: string,
  size: `${number}x${number}`,
  userId: string,
): Promise<{ bytes: Uint8Array; mediaType: string }> {
  try {
    const result = await generateImage({
      model: imageModelById(),
      prompt,
      n: 1,
      size,
      providerOptions: {
        openai: {
          outputFormat: "webp",
          outputCompression: 92,
          quality: "medium",
          moderation: "low",
          user: userId,
        },
      },
    });
    const image = result.image;
    return { bytes: image.uint8Array, mediaType: image.mediaType };
  } catch (sdkError) {
    const msg = sdkError instanceof Error ? sdkError.message : String(sdkError);
    if (
      !msg.includes("Type validation failed") &&
      !msg.includes("Invalid JSON response")
    )
      throw sdkError;

    console.log("[dearm] SDK validation failed, falling back to raw fetch");
    const baseURL =
      process.env.NIMIR_OPENAI_BASE_URL || "https://api.openai.com/v1";
    const apiKey =
      process.env.NIMIR_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
    const model = process.env.NIMIR_OPENAI_IMAGE_MODEL ?? "gpt-image-2";

    const apiRes = await proxyFetch(`${baseURL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, n: 1, size, quality: "medium" }),
    });
    if (!apiRes.ok) {
      const text = await apiRes.text().catch(() => "");
      throw new Error(`Image API ${apiRes.status}: ${text.slice(0, 200)}`);
    }
    const json = (await apiRes.json()) as {
      data: Array<{ url?: string; b64_json?: string }>;
    };
    const item = json.data?.[0];
    if (item?.b64_json) {
      const buf = Buffer.from(item.b64_json, "base64");
      return { bytes: new Uint8Array(buf), mediaType: "image/png" };
    }
    if (item?.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) throw new Error("Failed to download image from relay");
      const contentType = imgRes.headers.get("content-type") || "image/png";
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      return { bytes, mediaType: contentType };
    }
    throw new Error("No image data in relay response");
  }
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`${userId}:image`);
  if (!rl.allowed) {
    return Response.json(
      {
        error: `rate limit exceeded — try again at ${new Date(rl.resetAt).toISOString()}`,
      },
      { status: 429 },
    );
  }

  const raw = await req.json();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const currencyType = parsed.data.currencyType ?? "silver";
  const imgCurrencyCost = imageCostFor(currencyType);

  // 货币余额检查：确保用户有足够的金币/银币
  const currencyCheck = await checkCurrencyBalanceAmount(
    userId,
    currencyType,
    imgCurrencyCost,
  );
  if (!currencyCheck.allowed) {
    return Response.json(
      {
        error: "insufficient_currency",
        currencyType,
        required: currencyCheck.price,
        balance: currencyCheck.balance,
      },
      { status: 402 },
    );
  }

  // 图片生成走固定价、没有 messages 表 row —— 用 env 的图片模型 id + 中文
  // target 做 note，"图片生成 - 封面/头像"，让"货币消耗"列表里有可读描述。
  const imageModelId = process.env.NIMIR_OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const targetLabel = parsed.data.target === "avatar" ? "头像" : "封面";
  const { transactionId: deductTxId } = await deductCurrencyAmount(
    userId,
    currencyType,
    imgCurrencyCost,
    { modelId: imageModelId, note: `图片生成 - ${targetLabel}` },
  );

  const t0 = Date.now();
  try {
    const { bytes, mediaType } = await generateImageWithFallback(
      parsed.data.prompt,
      targetSize(parsed.data.target),
      userId,
    );
    const imgCost = calculateImageCostMillicents();
    // 图片模型一般不在 model_prices 表（env 锁定的 fixed id），getModelPricing
    // 会落到 FALLBACK_PRICING 兜底 7.2 汇率；没有 fallback 时显式用 7.2 —— 这
    // 行只算 ledger 展示的 CNY snapshot，不影响实际扣费金额（金/银币本身固定）。
    const pricing = await getModelPricing(imageModelId);
    const costCny = calculateCnyMillicents(imgCost, pricing?.usdCnyRate ?? 7.2);
    console.log(
      `[image] generated target=${parsed.data.target} size=${targetSize(parsed.data.target)} bytes=${bytes.byteLength} cost=${formatCostUsd(imgCost)} +${Date.now() - t0}ms`,
    );
    // 图片成功生成 → 把 CNY 成本结算到流水，让账本不再裸。
    await settleTransactionCost(deductTxId, costCny);
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new Response(body, {
      headers: {
        "Content-Type": mediaType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[dearm] image generation failed", error);
    await refundCurrencyAmount(userId, currencyType, imgCurrencyCost, {
      modelId: imageModelId,
      note: `退款 - 图片生成失败 (${targetLabel})`,
    });
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "image generation failed",
      },
      { status: 500 },
    );
  }
}
