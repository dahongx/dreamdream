import { consumeStream, type ModelMessage, streamText } from "ai";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  normalizeLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { buildSystemPrompt, resolveUserName } from "@/lib/ai/build-prompt";
import {
  masterInstructionLocaleFor,
  normalizeConversationLocale,
} from "@/lib/ai/conversation-locale";
import { truncateHistory } from "@/lib/ai/history-truncate";
import {
  DEARM_PROMPT_ADAPTER_VERSION,
  MASTER_PROMPT_PROVENANCE,
} from "@/lib/ai/master-template";
import { recordModelAttempt } from "@/lib/ai/model-status";
import { resolveModelId } from "@/lib/ai/models";
import { wrapPlayerTurn } from "@/lib/ai/player-turn";
import {
  calculateCnyMillicents,
  calculateCostMillicents,
  extractUsageDetails,
  formatCostUsd,
  getModelPricing,
} from "@/lib/ai/pricing";
import { buildPromptLeadMessages } from "@/lib/ai/prompt-lead";
import { modelById, providerOptionsByModelId } from "@/lib/ai/provider";
import { isPromptPolicyRejection } from "@/lib/ai/provider-errors";
import {
  isBlockedModelResponse,
  isExplicitModelRefusal,
} from "@/lib/ai/response-refusal";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  checkCurrencyBalance,
  deductCurrency,
  linkTransactionToMessage,
  refundCurrency,
  refundCurrencyAmount,
  settleTransactionCost,
} from "@/lib/billing/currency";
import { db } from "@/lib/db/client";
import { characters, chatSessions, messages, users } from "@/lib/db/schema";
import { getSessionActiveMask } from "@/lib/masks/queries";
import { applyRegex } from "@/lib/regex/apply";
import { filterRulesForUser } from "@/lib/regex/prompt";
import { loadRulesAndPrefs } from "@/lib/regex/queries";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/chat/continue
 *
 * 「续写」末条 assistant 消息。跟 /api/chat 的根本区别：
 *   - 不插 user 消息（语义上不是新一轮对话，是把同一条 AI 回复接着生成完整）
 *   - 不新建 assistant 行 —— 拿末条 assistant 当 prefill，模型在它后面续，
 *     onFinish 把生成的新文本 append 到原 row 的 content
 *   - tokens / cost / latency 在原 row 上 **累加**（同一条消息分多次生成）
 *
 * 适用场景：模型上一次回复被 max_tokens / safety / 网络中断 截断在半句，玩家
 * 想接着看下去而不是重新生成。
 *
 * 限制：依赖 provider 支持「assistant-as-last-message」（Anthropic / OpenAI
 * chat completions 都支持，Gemini 走它的多轮 contents 数组也允许，但极端情
 * 况若 provider 拒绝就会从 onError 走 quota refund 路径）。
 *
 * Body: { sessionId, model?, currencyType? }
 * Response: raw text/plain SSE-less stream(toTextStreamResponse) —— 客户端
 * 用 fetch + reader 直接读 chunk 接到原气泡尾部即可,不走 useChat 协议。
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    sessionId?: string;
    model?: string;
    currencyType?: "gold" | "silver";
  };

  if (!body.sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const modelId = resolveModelId(body.model);
  const currencyType = body.currencyType ?? "silver";
  const providerOptions = providerOptionsByModelId(modelId);

  const userId = await getCurrentUserId();

  const [session] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, body.sessionId))
    .limit(1);
  if (!session)
    return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.userId !== userId)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  // 孤儿会话:角色卡随创作者注销一起被删,character_id 置 null(migration 0042)。
  // 拦在扣费之前 —— 下面那条「角色不存在」虽然会退款,但先扣后退多一次账本
  // 往返、也在流水里留下一对没意义的扣/退。
  if (session.characterId === null)
    return Response.json({ error: "Character missing" }, { status: 410 });

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

  const currencyPrice = currencyCheck.price ?? 0;
  // continue 没有新 message id —— 拿到 lastAssistant 后立刻把流水链到那条
  // assistant 消息（即被续写的那条）。先扣再补 messageId。
  const { transactionId: deductTxId } = await deductCurrency(
    userId,
    modelId,
    currencyType,
    { note: "续写", sessionId: session.id },
  );

  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, session.characterId))
    .limit(1);
  if (!character) {
    await refundCurrency(userId, modelId, currencyType, {
      note: "退款 - 角色不存在",
      sessionId: session.id,
    });
    return Response.json({ error: "Character missing" }, { status: 410 });
  }

  const [user] = await db
    .select({
      displayName: users.displayName,
      username: users.username,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const localeCookie = req.cookies.get(LOCALE_COOKIE)?.value;
  const uiLocale = localeCookie
    ? normalizeLocale(localeCookie)
    : resolveLocaleFromAcceptLanguage(req.headers.get("accept-language"));
  const responseLocale = normalizeConversationLocale(uiLocale);
  const ruleDict = await getDictionary(uiLocale);
  const { rules, userPrefs } = await loadRulesAndPrefs(
    character.id,
    userId,
    ruleDict,
  );
  const activeRules = filterRulesForUser(rules, userPrefs);
  const activeMask = await getSessionActiveMask(session.id, userId);

  // 全量拉 session 活跃消息,服务端权威 —— 用户那侧 useChat 可能跟 DB 有漂移,
  // 续写要的是真实存盘的消息序列。
  const dbMessages = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.sessionId, session.id), isNull(messages.supersededAt)),
    )
    .orderBy(asc(messages.createdAt));

  const lastAssistant = dbMessages[dbMessages.length - 1];
  if (!lastAssistant || lastAssistant.role !== "assistant") {
    await refundCurrency(userId, modelId, currencyType, {
      note: "退款 - 无可续写的消息",
      sessionId: session.id,
    });
    return Response.json(
      { error: "No assistant message to continue" },
      { status: 400 },
    );
  }
  // 此刻 lastAssistant 必然已经在 messages 表里，把流水链上去。
  await linkTransactionToMessage(deductTxId, lastAssistant.id);

  // Anthropic prefill 严格禁止末尾空白(连 \n 都会 400)。trimEnd 仅作发给模型
  // 用,保存回 DB 时仍以原始 lastAssistant.content 为前缀,不污染玩家可见的字
  // 面差异。
  const trimmedPrefill = lastAssistant.content.replace(/\s+$/, "");

  const systemPrompt = buildSystemPrompt({
    character,
    user: user ?? { displayName: null, username: null, name: null },
    mask: activeMask,
    rules: activeRules,
    responseLocale,
  });
  const promptDebug = {
    promptAdapterVersion: DEARM_PROMPT_ADAPTER_VERSION,
    promptTemplateId: MASTER_PROMPT_PROVENANCE.templateId,
    promptTemplateSha256: MASTER_PROMPT_PROVENANCE.templateSha256,
    promptBundleSha256: MASTER_PROMPT_PROVENANCE.bundleSha256,
    promptInstructionLocale: masterInstructionLocaleFor(responseLocale),
    promptResponseLocale: responseLocale,
    promptLengthChars: systemPrompt.length,
    activeRuleCount: activeRules.length,
  } as const;

  // 每轮玩家消息包装（1:1 对齐 canonical 回合契约，见 player-turn.ts），与主 chat 路径一致。
  // 末条 assistant 走 prefill 分支不变；user 回合套 wrapPlayerTurn（只发模型不落库）。
  const wrapCtx = {
    char: character.name,
    user: resolveUserName(user, activeMask, responseLocale),
  };
  const allModelMessages: ModelMessage[] = dbMessages.map((m, i, arr) => {
    const isLast = i === arr.length - 1;
    if (m.role === "assistant") {
      return {
        role: "assistant" as const,
        content: isLast ? trimmedPrefill : m.content,
      };
    }
    return {
      role: "user" as const,
      content: wrapPlayerTurn(m.content, activeMask, wrapCtx, responseLocale),
    };
  });

  // 截历史时必须保住末条 assistant（prefill 目标）——把它单独摘出、截中间、
  // 再拼回。首条 opening 由 truncateHistory 自己保留。
  const prefill = allModelMessages[allModelMessages.length - 1];
  const trunc = truncateHistory(allModelMessages.slice(0, -1));
  const modelMessages: ModelMessage[] = [...trunc.messages, prefill];
  if (trunc.truncated) {
    console.log(
      `[chat/continue] history-truncated sessionId=${session.id} orig=${trunc.original + 1} kept=${modelMessages.length}`,
    );
  }

  const useAnthropicCache = modelId.startsWith("claude-");
  // Anthropic：cache 断点打在 prefill 前最后一条稳定消息上——prefill 每次
  // 续写都在变长，断点打在它身上永远命中不了；打在它前面，连续续写可以
  // 整段命中已缓存历史（截断窗口起点已量化稳定，见 history-truncate.ts）。
  if (useAnthropicCache && modelMessages.length > 1) {
    const idx = modelMessages.length - 2;
    const stableLast = modelMessages[idx];
    modelMessages[idx] = {
      ...stableLast,
      providerOptions: {
        ...stableLast.providerOptions,
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    } as ModelMessage;
  }
  const leadMessages = buildPromptLeadMessages({
    systemPrompt,
    firstConversationRole: modelMessages[0]?.role,
    useAnthropicCache,
    responseLocale,
  });
  const finalMessages: ModelMessage[] = [...leadMessages, ...modelMessages];

  const startedAt = Date.now();
  let firstTokenAt = 0;
  let modelAttemptRecorded = false;
  const recordAttemptOnce = async (outcome: "success" | "failure") => {
    if (modelAttemptRecorded) return;
    modelAttemptRecorded = true;
    await recordModelAttempt({
      modelId,
      outcome,
      ttftMs: firstTokenAt > 0 ? firstTokenAt - startedAt : null,
      durationMs: Date.now() - startedAt,
    });
  };
  console.log(
    `[chat/continue] model=${modelId} sessionId=${session.id} messages=${modelMessages.length} prefix=${lastAssistant.content.length}chars`,
  );

  let streamedText = "";
  let settlement: Promise<void> | null = null;
  const settleOnce = (work: () => Promise<void>) => {
    settlement ??= work();
    return settlement;
  };
  const finalizeContinuation = async ({
    text,
    usage,
    finishReason,
  }: {
    text: string;
    usage: Parameters<typeof extractUsageDetails>[0] | null | undefined;
    finishReason: string;
  }) => {
    const ud = usage ? extractUsageDetails(usage) : {};
    const cost = usage ? await calculateCostMillicents(modelId, ud) : 0;
    const pricingForCny = usage ? await getModelPricing(modelId) : null;
    const costCny = pricingForCny
      ? calculateCnyMillicents(cost, pricingForCny.usdCnyRate)
      : 0;
    console.log(
      `[chat/continue] finished model=${modelId} finishReason=${finishReason} text=${text.length}chars cost=${formatCostUsd(cost)} +${Date.now() - startedAt}ms`,
    );

    const blocked = isBlockedModelResponse(finishReason, text);
    const refusal = isExplicitModelRefusal(text) || finishReason === "refusal";
    if (text.length === 0 || blocked) {
      await refundCurrencyAmount(userId, currencyType, currencyPrice, {
        modelId,
        messageId: lastAssistant.id,
        sessionId: session.id,
        note: blocked
          ? "退款 - 续写未完成请求（模型限制或拒答）"
          : finishReason === "stop"
            ? "退款 - 续写在首字前停止"
            : "退款 - 续写空响应",
      });
      if (text.length === 0 || refusal) return;
    }

    const newContent = lastAssistant.content + text;
    const {
      text: rendered,
      matchedRules,
      unmatchedRules,
    } = applyRegex(newContent, activeRules);
    const previousDebug =
      lastAssistant.debugInfo &&
      typeof lastAssistant.debugInfo === "object" &&
      !Array.isArray(lastAssistant.debugInfo)
        ? (lastAssistant.debugInfo as Record<string, unknown>)
        : {};

    await db
      .update(messages)
      .set({
        content: newContent,
        renderedHtml: rendered === newContent ? null : rendered,
        tokensIn: (lastAssistant.tokensIn ?? 0) + (ud.inputTokens ?? 0),
        tokensOut: (lastAssistant.tokensOut ?? 0) + (ud.outputTokens ?? 0),
        cacheReadTokens:
          (lastAssistant.cacheReadTokens ?? 0) + (ud.cacheReadTokens ?? 0),
        cacheWriteTokens:
          (lastAssistant.cacheWriteTokens ?? 0) + (ud.cacheWriteTokens ?? 0),
        reasoningTokens:
          (lastAssistant.reasoningTokens ?? 0) + (ud.reasoningTokens ?? 0),
        costMillicents:
          (lastAssistant.costMillicents ?? 0) + (blocked ? 0 : cost),
        costCnyMillicents:
          (lastAssistant.costCnyMillicents ?? 0) + (blocked ? 0 : costCny),
        currencyAmount:
          (lastAssistant.currencyAmount ?? 0) + (blocked ? 0 : currencyPrice),
        latencyMs: (lastAssistant.latencyMs ?? 0) + (Date.now() - startedAt),
        debugInfo: {
          ...previousDebug,
          rawOutput: newContent,
          finishReason,
          truncatedBySafety: blocked,
          systemPrompt,
          ...promptDebug,
          matchedRules: matchedRules.map(({ id, name }) => ({ id, name })),
          unmatchedRules: unmatchedRules.map(({ id, name }) => ({
            id,
            name,
          })),
          lastContinuation: {
            finishReason,
            appendedChars: text.length,
            stoppedByUser: finishReason === "stop",
          },
        },
      })
      .where(eq(messages.id, lastAssistant.id));

    await db
      .update(chatSessions)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatSessions.id, session.id));
    if (!blocked) await settleTransactionCost(deductTxId, costCny);
  };

  const result = streamText({
    model: modelById(modelId),
    messages: finalMessages,
    providerOptions,
    abortSignal: req.signal,
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") {
        streamedText += chunk.text;
        if (firstTokenAt === 0) firstTokenAt = Date.now();
      }
    },
    onFinish: ({ text, usage, finishReason }) =>
      settleOnce(async () => {
        const safetyBlocked = isBlockedModelResponse(finishReason, text);
        if (!safetyBlocked) {
          await recordAttemptOnce(text.length > 0 ? "success" : "failure");
        }
        await finalizeContinuation({ text, usage, finishReason });
      }),
    onAbort: () =>
      settleOnce(() =>
        finalizeContinuation({
          text: streamedText,
          usage: null,
          finishReason: "stop",
        }),
      ),
    onError: ({ error }) =>
      settleOnce(async () => {
        if (req.signal.aborted) {
          await finalizeContinuation({
            text: streamedText,
            usage: null,
            finishReason: "stop",
          });
          return;
        }
        console.error(
          `[chat/continue] stream error model=${modelId} +${Date.now() - startedAt}ms:`,
          error,
        );
        if (!isPromptPolicyRejection(error)) await recordAttemptOnce("failure");
        await refundCurrency(userId, modelId, currencyType, {
          messageId: lastAssistant.id,
          sessionId: session.id,
          note: "退款 - 续写流式错误",
        });
      }),
  });

  const response = result.toTextStreamResponse();
  if (!response.body) return response;
  const [clientStream, persistenceStream] = response.body.tee();
  void consumeStream({ stream: persistenceStream });
  return new Response(clientStream, response);
}
