import { streamText } from "ai";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  LOCALE_COOKIE,
  normalizeLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/i18n/config";
import { checkRateLimit } from "@/lib/ai/generators/rate-limit";
import {
  GENERATOR_TYPES,
  type GeneratorType,
  resolveGenerator,
} from "@/lib/ai/generators/registry";
import { NIMIR_MODEL_IDS, resolveModelId } from "@/lib/ai/models";
import {
  calculateCnyMillicents,
  calculateCostMillicents,
  extractUsageDetails,
  formatCostUsd,
  getModelPricing,
} from "@/lib/ai/pricing";
import { modelById, providerOptionsByModelId } from "@/lib/ai/provider";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  checkCurrencyBalance,
  deductCurrency,
  refundCurrency,
  settleTransactionCost,
} from "@/lib/billing/currency";
import { db } from "@/lib/db/client";
import type { MessageAttachment } from "@/lib/db/schema";
import { openingComponents, regexRules } from "@/lib/db/schema";
import {
  appendSessionTurn,
  getSessionMessages,
} from "@/lib/packs/assistant-messages";
import { getSessionPackOwner } from "@/lib/packs/session-queries";

// Vercel honors this; self-hosted Docker ignores it.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate
 *
 * Streaming SSE endpoint for the 4 creator-side AI helpers:
 *   - target-text       — XML skeleton generator
 *   - replacement-html  — produces the HTML/CSS replacement string
 *   - global-css        — produces a creator-style CSS block
 *   - output-guidance   — produces the system-prompt instruction text
 *
 * Auth: any signed-in user. Rate-limited to 20 calls/user/hour.
 * Prompt templates are sealed in the backend (registry.resolveGenerator)
 * so creators can't influence them via injection.
 *
 * Response: plain text/event-stream — the client just appends incoming
 * deltas to the target textarea. No structured output protocol yet.
 */

const attachmentSchema = z.object({
  url: z.string().url(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

const bodySchema = z.object({
  type: z.enum(GENERATOR_TYPES as [GeneratorType, ...GeneratorType[]]),
  prompt: z.string().min(1).max(2000),
  context: z.record(z.string(), z.unknown()).optional(),
  /** Studio AI 助手专用：标识当前 pack-assistant 会话。 */
  sessionId: z.string().uuid().optional(),
  /** Studio AI 助手专用：本轮 user 上传的参考图（已 R2 上传）。最多 4 张。 */
  attachments: z.array(attachmentSchema).max(4).optional(),
  model: z.enum(NIMIR_MODEL_IDS).optional(),
  currencyType: z.enum(["gold", "silver"]).optional(),
});

/** 个人主页"货币消耗"列表里显示的生成器中文名。新增生成器类型时记得补一项，
 *  不然会落到 "未知" 兜底。 */
const GENERATOR_LABEL: Record<GeneratorType, string> = {
  "target-text": "目标文本",
  "replacement-html": "替换 HTML",
  "global-css": "全局 CSS",
  "output-guidance": "输出引导",
  "pack-assistant": "AI 助手",
  "image-prompt": "图片提示词",
};
function generatorLabel(type: GeneratorType): string {
  return GENERATOR_LABEL[type] ?? "未知";
}

/** 校验附件 URL 必须来自我们自己的存储，防止 creator 篡改请求往模型灌任意外部 URL。
 *  当前上传走 Supabase Storage 公开桶（见 lib/r2/client.ts），URL 形如
 *  `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/...`；兼容历史 R2 域。
 *  注意：迁移前这里只认 R2_PUBLIC_HOST，迁到 Supabase 后线上 URL 对不上会误报
 *  「附件 URL 不在允许的域内」——故改为同时认 Supabase 公开前缀。 */
function isAllowedAttachmentUrl(url: string): boolean {
  const allowed: string[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    allowed.push(
      `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/`,
    );
  }
  // 历史：迁移前的 R2 公开域，旧图仍可能引用
  const r2Host = process.env.R2_PUBLIC_HOST;
  if (r2Host) {
    allowed.push(r2Host.startsWith("http") ? r2Host : `https://${r2Host}`);
  }
  // 都没配（本地 dev 可能两者皆无）→ 跳过校验
  if (allowed.length === 0) return true;
  return allowed.some((prefix) => url.startsWith(prefix));
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    console.error("[generate] auth failed");
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(userId);
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

  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale
    ? normalizeLocale(cookieLocale)
    : resolveLocaleFromAcceptLanguage(req.headers.get("accept-language"));

  const resolved = resolveGenerator({
    type: parsed.data.type,
    prompt: parsed.data.prompt,
    context: parsed.data.context,
    locale,
  });

  const modelId = resolveModelId(parsed.data.model);
  const currencyType = parsed.data.currencyType ?? "silver";
  const providerOptions = providerOptionsByModelId(modelId);

  // 货币余额检查：确保用户有足够的金币/银币
  const currencyCheck = await checkCurrencyBalance(
    userId,
    modelId,
    currencyType,
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

  // 美化包/AI 助手的扣费在"货币消耗"列表里没有 messageId 可链，所以把
  // 生成器类型作为人类可读的 note 一起入库（"美化包 - 替换 HTML" 等）。
  const { transactionId: deductTxId } = await deductCurrency(
    userId,
    modelId,
    currencyType,
    { note: `美化包 - ${generatorLabel(parsed.data.type)}` },
  );
  console.log(
    `[generate] type=${parsed.data.type} model=${modelId} attachments=${parsed.data.attachments?.length ?? 0} +${Date.now() - t0}ms`,
  );

  // pack-assistant 走多轮：DB 拉历史 + 当前 user prompt 拼 messages array；
  // 流结束后把本轮 user + assistant 持久化。其他 generator 仍走单条 prompt。
  if (parsed.data.type === "pack-assistant") {
    const sessionId = parsed.data.sessionId;
    if (!sessionId) {
      return Response.json({ error: "sessionId required" }, { status: 400 });
    }
    const row = await getSessionPackOwner(sessionId);
    if (!row || row.ownerUserId !== userId) {
      return Response.json(
        { error: "找不到该会话，或你没有访问权限" },
        { status: 403 },
      );
    }
    const { session } = row;
    if (session.status !== "active") {
      return Response.json(
        { error: "该会话已结束，无法继续对话" },
        { status: 409 },
      );
    }

    // 编辑模式下把目标 rule 注入 prompt，让 AI 知道在迭代谁。
    // 新建模式（无 targetRuleId）下，若 session 已有 draftPayload（前一轮
    // 接受的 rule proposal），把它也当作 TARGET_RULE 注入 —— 让 AI 知道
    // 在迭代上一版而不是从零重做。
    let targetRule: unknown = null;
    if (session.targetRuleId) {
      const [rule] = await db
        .select()
        .from(regexRules)
        .where(
          and(
            eq(regexRules.id, session.targetRuleId),
            eq(regexRules.packId, session.packId),
          ),
        )
        .limit(1);
      if (rule) {
        targetRule = {
          name: rule.name,
          pattern: rule.pattern,
          replacement: rule.replacement,
          targetText: rule.targetText,
          outputGuidance: rule.outputGuidance,
          variableMapping: rule.variableMapping,
          visible: rule.visible,
          enabled: rule.enabled,
        };
      }
    } else if (
      session.type === "component" &&
      session.draftPayload &&
      typeof session.draftPayload === "object" &&
      (session.draftPayload as { kind?: string }).kind === "rule"
    ) {
      const draft = session.draftPayload as {
        kind: "rule";
        rule: {
          name: string;
          pattern: string;
          replacement: string;
          targetText?: string | null;
          outputGuidance?: string | null;
          variableMapping?: unknown;
          visible?: boolean;
          enabled?: boolean;
        };
      };
      targetRule = {
        name: draft.rule.name,
        pattern: draft.rule.pattern,
        replacement: draft.rule.replacement,
        targetText: draft.rule.targetText ?? null,
        outputGuidance: draft.rule.outputGuidance ?? null,
        variableMapping: draft.rule.variableMapping ?? [],
        visible: draft.rule.visible ?? false,
        enabled: draft.rule.enabled ?? true,
      };
    }

    // 开场组件会话：把目标开场组件（编辑模式的 DB 行，或新建模式上一轮
    // 接受的 draft）注入为 TARGET_OPENING，让 AI 知道在迭代谁。
    let targetOpening: unknown = null;
    if (session.type === "opening") {
      if (session.targetOpeningComponentId) {
        const [oc] = await db
          .select()
          .from(openingComponents)
          .where(
            and(
              eq(openingComponents.id, session.targetOpeningComponentId),
              eq(openingComponents.packId, session.packId),
            ),
          )
          .limit(1);
        if (oc) {
          targetOpening = {
            name: oc.name,
            content: oc.content,
            enabled: oc.enabled,
          };
        }
      } else if (
        session.draftPayload &&
        typeof session.draftPayload === "object" &&
        (session.draftPayload as { kind?: string }).kind === "opening"
      ) {
        const draft = session.draftPayload as {
          kind: "opening";
          opening: { name: string; content: string; enabled?: boolean };
        };
        targetOpening = {
          name: draft.opening.name,
          content: draft.opening.content,
          enabled: draft.opening.enabled ?? true,
        };
      }
    }

    const sessionResolved = resolveGenerator({
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      locale,
      context: {
        ...(parsed.data.context ?? {}),
        sessionType: session.type,
        targetRule,
        targetOpening,
      },
    });

    // 校验本轮附件 URL 必须来自我们自己的 R2 域 —— 防止 creator 灌任意 URL
    const userAttachments = parsed.data.attachments ?? null;
    if (userAttachments) {
      for (const a of userAttachments) {
        if (!isAllowedAttachmentUrl(a.url)) {
          return Response.json(
            { error: "附件 URL 不在允许的域内" },
            { status: 400 },
          );
        }
      }
    }

    const history = await getSessionMessages(sessionId);

    /** AI SDK 6 多模态：含图时 content 必须是 part 数组；纯文本仍可传 string。
     *
     *  ⚠️ zhengmi 等中继可能不支持 image URL source —— 即使我们传 image URL，
     *  让 SDK 透传到 anthropic，对方也只把 URL 当字符串忽略。强制 server 端
     *  先 fetch 图片字节再以 Uint8Array 形式传给 SDK，anthropic provider
     *  会转 base64 source 走老协议，所有中继都兼容。
     *
     *  下载失败的图直接跳过（不阻塞整轮）。 */
    async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
      try {
        console.log(`[generate] fetching image: ${url}`);
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`[generate] image fetch failed: ${res.status} ${url}`);
          return null;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        console.log(`[generate] image fetched: ${bytes.length} bytes`);
        return bytes;
      } catch (e) {
        console.error(`[generate] image fetch error:`, e);
        return null;
      }
    }

    async function buildUserContent(
      text: string,
      attachments: MessageAttachment[] | null,
    ): Promise<
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image"; image: Uint8Array; mediaType: string }
        >
    > {
      if (!attachments?.length) return text;
      const parts: Array<
        | { type: "text"; text: string }
        | { type: "image"; image: Uint8Array; mediaType: string }
      > = [{ type: "text", text }];
      const usableUrls: string[] = [];
      for (const a of attachments) {
        const bytes = await fetchImageBytes(a.url);
        if (!bytes) continue;
        parts.push({ type: "image", image: bytes, mediaType: a.mimeType });
        usableUrls.push(a.url);
      }
      // 把参考图的可引用直链也作为文本交给模型。这些 URL 来自 Dearm 自己的
      // 存储（已过 isAllowedAttachmentUrl 校验）、长期有效、聊天端能正常加载。
      // 只把图片「字节」给模型时它仅能看图重绘 —— 拿到链接后，creator 说「用
      // 这张图」时模型才能 <img src="..."> 把原图嵌进组件，而不是照着重画。
      if (usableUrls.length > 0) {
        parts.push({
          type: "text",
          text:
            `〔参考图直链〕以上 ${usableUrls.length} 张参考图的可引用链接：\n` +
            usableUrls.map((u, i) => `图${i + 1}: ${u}`).join("\n") +
            `\n若 creator 想把图片本身用进组件（"用这张图 / 把图放进来 / 显示这张图"），请在 replacement / content 里用 <img src="对应链接"> 直接引用，不要照着重画；若只是要"照这个风格 / 配色做"，把图当视觉参考即可。`,
        });
      }
      return parts;
    }

    const historyMessages = await Promise.all(
      history.map(async (m) => {
        if (m.role === "user") {
          const atts = (m.attachments as MessageAttachment[] | null) ?? null;
          return {
            role: "user" as const,
            content: await buildUserContent(m.content, atts),
          };
        }
        return { role: "assistant" as const, content: m.content };
      }),
    );

    const messages = [
      ...historyMessages,
      {
        role: "user" as const,
        content: await buildUserContent(parsed.data.prompt, userAttachments),
      },
    ];

    console.log(
      `[generate] calling streamText model=${modelId} messages=${messages.length} +${Date.now() - t0}ms`,
    );
    const result = streamText({
      model: modelById(modelId),
      system: sessionResolved.systemPrompt,
      messages,
      providerOptions,
      onFinish: async ({ text, usage }) => {
        const ud = usage ? extractUsageDetails(usage) : {};
        const cost = usage ? await calculateCostMillicents(modelId, ud) : 0;
        // CNY 成本：拿 pricing 快照里的汇率；首次美化包/历史无 usage → 0
        const pricing = usage ? await getModelPricing(modelId) : null;
        const costCny = pricing
          ? calculateCnyMillicents(cost, pricing.usdCnyRate)
          : 0;
        console.log(
          `[generate] assistant finished model=${modelId} text=${text.length}chars tokens_in=${ud.inputTokens ?? "—"} tokens_out=${ud.outputTokens ?? "—"} cache_read=${ud.cacheReadTokens ?? 0} cache_write=${ud.cacheWriteTokens ?? 0} cost=${formatCostUsd(cost)} +${Date.now() - t0}ms`,
        );
        await appendSessionTurn(
          sessionId,
          parsed.data.prompt,
          text,
          userAttachments,
        );
        // 美化包没有 message 载体，账本里之前一直裸；现在把 CNY 成本结算
        // 回流水自己一列，admin / 玩家都能看到 "美化包 ¥0.18" 这种实开销。
        await settleTransactionCost(deductTxId, costCny);
      },
      onError: async ({ error }) => {
        console.error(`[generate] stream error +${Date.now() - t0}ms:`, error);
        await refundCurrency(userId, modelId, currencyType, {
          note: `退款 - 美化包流式错误 (${generatorLabel(parsed.data.type)})`,
        });
      },
    });
    return result.toTextStreamResponse();
  }

  console.log(
    `[generate] calling streamText (non-assistant) model=${modelId} +${Date.now() - t0}ms`,
  );
  const result = streamText({
    model: modelById(modelId),
    system: resolved.systemPrompt,
    prompt: resolved.userPrompt,
    providerOptions,
    onFinish: async ({ usage }) => {
      const ud = usage ? extractUsageDetails(usage) : {};
      const cost = usage ? await calculateCostMillicents(modelId, ud) : 0;
      const pricing = usage ? await getModelPricing(modelId) : null;
      const costCny = pricing
        ? calculateCnyMillicents(cost, pricing.usdCnyRate)
        : 0;
      console.log(
        `[generate] finished type=${parsed.data.type} model=${modelId} tokens_in=${ud.inputTokens ?? "—"} tokens_out=${ud.outputTokens ?? "—"} cache_read=${ud.cacheReadTokens ?? 0} cache_write=${ud.cacheWriteTokens ?? 0} cost=${formatCostUsd(cost)} +${Date.now() - t0}ms`,
      );
      // 非 pack-assistant 类型（替换 HTML / 全局 CSS / output guidance / target
      // text 生成器）：同样把 CNY 成本结算到流水。
      await settleTransactionCost(deductTxId, costCny);
    },
    onError: async ({ error }) => {
      console.error(`[generate] stream error +${Date.now() - t0}ms:`, error);
      await refundCurrency(userId, modelId, currencyType, {
        note: `退款 - 生成器流式错误 (${generatorLabel(parsed.data.type)})`,
      });
    },
  });

  return result.toTextStreamResponse();
}
