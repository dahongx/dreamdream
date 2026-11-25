import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type ModelMessage,
  streamText,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  normalizeLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  antiStickAdverbs,
  geminiAntiStickPromptSection,
  isPollutedByAdverbs,
} from "@/lib/ai/adverb-antistick";
import { buildSystemPrompt, resolveUserName } from "@/lib/ai/build-prompt";
import {
  masterInstructionLocaleFor,
  resolveConversationLocalePreference,
} from "@/lib/ai/conversation-locale";
import { stripEmbeddedUserTurns } from "@/lib/ai/embedded-user-turns";
import {
  extractGeminiFilterDiagnostics,
  type GeminiFilterDiagnostics,
} from "@/lib/ai/gemini-filter-diagnostics";
import { getModelHealthStatus, isModelAvailable } from "@/lib/ai/health-check";
import { truncateHistory } from "@/lib/ai/history-truncate";
import {
  DEARM_PROMPT_ADAPTER_VERSION,
  MASTER_PROMPT_PROVENANCE,
} from "@/lib/ai/master-template";
import { recordModelAttempt } from "@/lib/ai/model-status";
import { type NimirModelId, resolveModelId } from "@/lib/ai/models";
import {
  extractModelMessageText,
  INJECT_EVERY_TURN,
  wrapPlayerTurn,
} from "@/lib/ai/player-turn";
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
  GEMINI_CHAT_TEMPERATURE,
  regenerationReference,
  traceFingerprint,
} from "@/lib/ai/regeneration";
import { truncateRepeatedStateCycles } from "@/lib/ai/repeated-state-cycles";
import {
  isBlockedModelResponse,
  isExplicitModelRefusal,
} from "@/lib/ai/response-refusal";
import { appendResponseVariationCue } from "@/lib/ai/response-variation";
import {
  findLatestUsableStateSnapshotIndex,
  retainUsableStateSnapshot,
  stripHistoricalStateBlocks,
} from "@/lib/ai/state-history";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { isDeveloperEmail } from "@/lib/auth/dev-allowlist";
import {
  checkCurrencyBalance,
  deductCurrency,
  linkTransactionToMessage,
  refundCurrency,
  refundCurrencyAmount,
  settleTransactionCost,
} from "@/lib/billing/currency";
import {
  type ChatUIMessage,
  createPublicChatMeta,
  type DebugMeta,
} from "@/lib/chat/debug-meta";
import { prepareChatHistory } from "@/lib/chat/history-messages";
import {
  isOriginatingTurnCurrent,
  isRegenerationTargetCurrent,
  shouldSupersedeOriginatingUser,
} from "@/lib/chat/turn-lifecycle";
import { db } from "@/lib/db/client";
import { characters, chatSessions, messages, users } from "@/lib/db/schema";
import { getSessionActiveMask } from "@/lib/masks/queries";
import { applyRegex } from "@/lib/regex/apply";
import { filterRulesForUser } from "@/lib/regex/prompt";
import { loadRulesAndPrefs } from "@/lib/regex/queries";

// SSE upper bound. Vercel Pro caps at 800s; Hobby at 60s. Self-hosted (Docker)
// ignores this. We pick 300s — long enough for a several-thousand-token
// completion on Sonnet, short enough to free the worker if the model hangs.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const CHAT_LOCK_NS = 8101;
// Must outlive the full generation budget. A 90-second window expired while
// slow Gemini requests were still running (observed at nearly five minutes).
const CHAT_IN_FLIGHT_TTL_MS = (maxDuration + 60) * 1_000;

/**
 * Gemini SAFETY 或中转兜底判定（finalizeTurn 用于半成品拦截）：
 * - `content-filter` 是明确的 SAFETY/PROHIBITED 分类命中
 * - `other` 是中转层吞掉具体分类后的兜底（RECITATION / SPII / BLOCKLIST 都会
 *   落进这里）；只有配合零文本才认为是安全拒答，正常长文本 finishReason=other
 *   （某些代理会这样返回）就当正常结束不拦
 */
const isSafetyBlocked = isBlockedModelResponse;

/** 空 DebugMeta —— 客户端会正常收到 metadata chunk，safetyBlocked 计数不误增。 */
function emptyMeta(): DebugMeta {
  return createPublicChatMeta();
}

// 校验 useChat 上送的消息 id 是否是合法 UUID —— 旧客户端 / 异常 trace 可能传
// 来 16 位短串，直接灌进 uuid 列会触发 invalid input syntax 错误并打断整轮
// 流式。退到 DB 默认 random()，老消息的 ID 不再回写客户端，但至少不挂掉。
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

function uiMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// system prompt 现在走 user 位置（见下方 systemLeadMessage）。有开场白的卡，
// system(user) 后天然接开场白(assistant)，交替成立；无开场白的卡首条对话就是
// user，会和 system 轮撞成连续 user。这条极简 assistant 确认轮只在后者插入，
// 补上那一格，保证喂给模型的永远是严格 user/assistant 交替。
/**
 * POST /api/chat
 *
 * Body shape (from useChat's DefaultChatTransport):
 *   { messages: UIMessage[], sessionId: string }
 *
 * Pipeline (W4):
 * 1. Auth + ownership check on the session
 * 2. Take the last UI message (must be user-role) → persist to messages table
 * 3. Load character + rules + the user's visible-rule opt-outs
 * 4. Build system prompt fresh each turn — folds rule.output_guidance into a
 *    "## 扩展标签协议" tail section (after host frame + creator sections) so the
 *    model learns the short-XML contract; it extends the Dearm output adapter
 *    now placed at the top of the frame
 * 5. streamText → SSE
 * 6. onFinish: applyRegex on the final assistant text. Persist content +
 *    rendered_html + debug_info (raw output, matched / unmatched rules,
 *    system prompt — surfaced by the owner-only <DebugPanel>)
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    sessionId?: string;
    model?: string;
    currencyType?: "gold" | "silver";
    trigger?: "submit-message" | "regenerate-message";
    messageId?: string;
  };

  if (!body.sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const modelId = resolveModelId(body.model);

  // 尊重用户手动选择的模型：Gemini 不可用时明确报错，不再静默切换模型。
  const healthStatus = await getModelHealthStatus(modelId);
  if (modelId.startsWith("gemini-") && !isModelAvailable(healthStatus)) {
    console.warn(
      `[chat] Model ${modelId} is ${healthStatus}; request rejected`,
    );
    return Response.json(
      { error: "model_unavailable", modelId },
      { status: 503 },
    );
  }

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
  // 记录还在、能翻,但没有角色行就没有 system prompt / 正则 / 开场,续不了。
  // **必须拦在扣费之前** —— 下面那个「Character missing」410 在 deductCurrency
  // 之后,走到那儿用户已经为一条发不出去的消息付过钱了。
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

  // 通过双闸门，扣币（失败时退）
  const currencyPrice = currencyCheck.price ?? 0;
  const { transactionId: deductTxId } = await deductCurrency(
    userId,
    modelId,
    currencyType,
    { note: "聊天", sessionId: session.id },
  );

  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, session.characterId))
    .limit(1);
  if (!character)
    return Response.json({ error: "Character missing" }, { status: 410 });

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
  // Debug payload (incl. assembled systemPrompt — host-level prompt asset)
  // is streamed back ONLY to the developer allowlist. Same gate as the chat
  // page's debugMetaMap; non-developers never see these bytes on the wire.
  const canDebug = isDeveloperEmail(user?.email);

  const localeCookie = req.cookies.get(LOCALE_COOKIE)?.value;
  const acceptLanguage = req.headers.get("accept-language");
  const uiLocale = localeCookie
    ? normalizeLocale(localeCookie)
    : resolveLocaleFromAcceptLanguage(acceptLanguage);
  const responseLocale = resolveConversationLocalePreference(
    localeCookie,
    acceptLanguage,
  );
  console.log("[chat] locale resolution:", {
    localeCookie,
    uiLocale,
    responseLocale,
    acceptLanguage,
  });
  const ruleDict = await getDictionary(uiLocale);
  const { rules, userPrefs } = await loadRulesAndPrefs(
    character.id,
    userId,
    ruleDict,
  );
  const activeRules = filterRulesForUser(rules, userPrefs);
  const activeMask = await getSessionActiveMask(session.id, userId);

  // 防御：剔除空 parts 的消息再校验。上游模型失败时客户端可能残留
  // parts: [] 的 assistant 占位（老版本客户端没有 onError 清理），带上它
  // validateUIMessages 直接抛 ZodError → 整个会话每次发送都 500。空消息
  // 对模型上下文本来就无意义，静默丢弃。
  const nonEmptyMessages = Array.isArray(body.messages)
    ? body.messages.filter(
        (m: { parts?: unknown[] }) =>
          Array.isArray(m.parts) && m.parts.length > 0,
      )
    : body.messages;
  const validatedMessages = await validateUIMessages({
    messages: nonEmptyMessages,
  });
  // Keep visible SAFETY replies in history. Dropping one collapses
  // user -> assistant(partial) -> user into adjacent user turns; providers
  // merge those turns and answer the previous prompt again. Only an empty
  // safety placeholder is safe to discard.
  let uiMessages = prepareChatHistory(validatedMessages);
  const clientLast = uiMessages[uiMessages.length - 1];
  if (!clientLast || clientLast.role !== "user") {
    return Response.json(
      { error: "Last message must be from the user" },
      { status: 400 },
    );
  }
  const clientLastText = uiMessageText(clientLast);
  if (!clientLastText.trim()) {
    return Response.json({ error: "Empty user message" }, { status: 400 });
  }

  const isRegenerate = body.trigger === "regenerate-message";
  let rejectedAssistantText = "";
  let regenerateTargetAssistantId: string | null = null;
  let originatingUserMessageId: string | null = null;

  if (isRegenerate) {
    const [latestAssistant] = await db
      .select({ id: messages.id, content: messages.content })
      .from(messages)
      .where(
        and(
          eq(messages.sessionId, session.id),
          eq(messages.role, "assistant"),
          isNull(messages.supersededAt),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (!latestAssistant) {
      return Response.json(
        { error: "Assistant message not found" },
        { status: 404 },
      );
    }
    if (isUuid(body.messageId) && body.messageId !== latestAssistant.id) {
      return Response.json(
        { error: "Regenerate target is stale" },
        { status: 409 },
      );
    }
    rejectedAssistantText = latestAssistant.content;
    regenerateTargetAssistantId = latestAssistant.id;

    // Rebuild regenerate history from the database while omitting the rejected
    // reply in memory. Keep its DB row active until the replacement succeeds:
    // an upstream refusal must not destroy the user's existing answer.
    const authoritativeRows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        debugInfo: messages.debugInfo,
      })
      .from(messages)
      .where(
        and(eq(messages.sessionId, session.id), isNull(messages.supersededAt)),
      )
      .orderBy(asc(messages.createdAt));
    uiMessages = prepareChatHistory(
      authoritativeRows
        .filter((row) => row.id !== regenerateTargetAssistantId)
        .map((row) => {
          const debug = row.debugInfo as {
            truncatedBySafety?: boolean;
            stoppedByUser?: boolean;
          } | null;
          return {
            id: row.id,
            role: row.role,
            parts: [{ type: "text" as const, text: row.content }],
            metadata: {
              safetyBlocked: debug?.truncatedBySafety === true,
              stoppedByUser: debug?.stoppedByUser === true,
            },
          };
        }),
    );
    for (let i = uiMessages.length - 1; i >= 0; i -= 1) {
      if (uiMessages[i].role === "user") {
        originatingUserMessageId = uiMessages[i].id;
        break;
      }
    }
  } else {
    // Atomic race-safe：advisory lock(session 级) + 末条 in-flight 检查 +
    // 插 user 全部包在一个事务里。
    //
    // 为什么要 lock：纯 SELECT-then-INSERT 在两个真并发 POST 下都看到
    // 「末条还是 assistant」(opening),都 pass check,各插一条 user + 起
    // streamText,DB 里就出现 user-user-assistant-assistant 的串。HTTP/1.1
    // 单连接被浏览器串行化,真并发主要来自 HTTP/2 多路复用 + 客户端 stale
    // state 漏触发(虽然 ChatRoom.tsx 已上 sendingRef 作第一道防线)。
    // pg_try_advisory_xact_lock 失败 → 409;锁随 tx commit/rollback 自动放。
    //
    // 末条 in-flight TTL 覆盖完整生成预算和落库余量。旧请求若稍后晚到，
    // finalizeTurn 会再次校验它的 user 行是否仍为会话末尾，否则丢弃并退款。
    //
    // characters.conversationCount 故意留在 tx 外:它是聚合计数器,失败也
    // 不应回滚 user 写入。口径 = 累计所有 user message 条数(含 regenerate /
    // 编辑重发新产生的行),每条 user 消息插入成功后 +1。历史脏数据用
    // scripts/backfill-conversation-count.ts 重算。
    let conflict = false;

    await db.transaction(async (tx) => {
      const lockResult = await tx.execute<{ got: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(${CHAT_LOCK_NS}, hashtext(${session.id})) AS got`,
      );
      if (!lockResult[0]?.got) {
        conflict = true;
        return;
      }

      const [lastMsg] = await tx
        .select({ role: messages.role, createdAt: messages.createdAt })
        .from(messages)
        .where(
          and(
            eq(messages.sessionId, session.id),
            isNull(messages.supersededAt),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);
      if (
        lastMsg?.role === "user" &&
        Date.now() - new Date(lastMsg.createdAt).getTime() <
          CHAT_IN_FLIGHT_TTL_MS
      ) {
        conflict = true;
        return;
      }

      // 复用客户端 UUID 作为 DB 主键 —— 让 useChat 状态里的 m.id 与 messages.id
      // 直接对齐，刚发出去的 user 消息也能立刻被 edit / delete 服务端动作命中。
      // 若客户端没给合法 UUID（旧客户端 / 异常 trace），退到 DB 默认 random()。
      const [insertedUser] = await tx
        .insert(messages)
        .values({
          id: isUuid(clientLast.id) ? clientLast.id : undefined,
          sessionId: session.id,
          role: "user",
          content: clientLastText,
        })
        .returning({ id: messages.id });
      originatingUserMessageId = insertedUser?.id ?? null;
    });

    if (conflict) {
      return Response.json(
        { error: "previous_turn_in_flight" },
        { status: 409 },
      );
    }

    await db
      .update(characters)
      .set({
        conversationCount: sql`${characters.conversationCount} + 1`,
      })
      .where(eq(characters.id, character.id))
      .catch(() => {});
  }

  if (!isRegenerate) {
    // The browser can submit before a preceding edit/delete state update has
    // propagated through useChat. Rebuild from persisted active rows after
    // inserting the new turn so deleted or superseded client history cannot
    // leak back into the model context.
    const authoritativeRows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        debugInfo: messages.debugInfo,
      })
      .from(messages)
      .where(
        and(eq(messages.sessionId, session.id), isNull(messages.supersededAt)),
      )
      .orderBy(asc(messages.createdAt));
    uiMessages = prepareChatHistory(
      authoritativeRows.map((row) => {
        const debug = row.debugInfo as {
          truncatedBySafety?: boolean;
          stoppedByUser?: boolean;
        } | null;
        return {
          id: row.id,
          role: row.role,
          parts: [{ type: "text" as const, text: row.content }],
          metadata: {
            safetyBlocked: debug?.truncatedBySafety === true,
            stoppedByUser: debug?.stoppedByUser === true,
          },
        };
      }),
    );
  }

  const last = uiMessages[uiMessages.length - 1];
  if (!last || last.role !== "user") {
    return Response.json(
      { error: "Last message must be from the user" },
      { status: 409 },
    );
  }
  const lastText = uiMessageText(last);
  if (!lastText.trim()) {
    return Response.json({ error: "Empty user message" }, { status: 400 });
  }

  // Auto title back-fill: first user message on a still-unnamed session
  // becomes the session title. Saved sessions and renamed ones already have
  // a title; the `IS NULL` guard prevents overwriting.
  if (!session.title) {
    const trimmed = lastText.trim().replace(/\s+/g, " ").slice(0, 30);
    if (trimmed.length > 0) {
      await db
        .update(chatSessions)
        .set({ title: trimmed })
        .where(eq(chatSessions.id, session.id));
    }
  }

  // Gemini 3.1 Pro 中文副词黏滞退化的前置预防（与 finalizeTurn 里的后处理
  // 清洗互补）：只对该模型追加，其他模型完全不改动 system prompt，避免稀释
  // 主 host frame 指令预算。
  const systemPromptBase = buildSystemPrompt({
    character,
    user: user ?? { displayName: null, username: null, name: null },
    mask: activeMask,
    rules: activeRules,
    responseLocale,
  });
  const geminiAntiStick =
    responseLocale === "zh-Hans" || responseLocale === "zh-Hant"
      ? geminiAntiStickPromptSection(modelId)
      : "";
  const systemPrompt = geminiAntiStick
    ? `${systemPromptBase}\n\n${geminiAntiStick}`
    : systemPromptBase;
  const promptDebugBase = {
    promptAdapterVersion: DEARM_PROMPT_ADAPTER_VERSION,
    promptTemplateId: MASTER_PROMPT_PROVENANCE.templateId,
    promptTemplateSha256: MASTER_PROMPT_PROVENANCE.templateSha256,
    promptBundleSha256: MASTER_PROMPT_PROVENANCE.bundleSha256,
    promptInstructionLocale: masterInstructionLocaleFor(responseLocale),
    promptResponseLocale: responseLocale,
    promptLengthChars: systemPrompt.length,
    activeRuleCount: activeRules.length,
  } as const;

  // 每轮玩家消息包装（1:1 对齐 canonical 回合契约，见 player-turn.ts）：OOC 约定头 + 面具块 +
  // $指令 + 📝 台词标记 + 尾部格式提醒。只发给模型，不落库（DB 里 user 消息存原文）。
  const wrapCtx = {
    char: character.name,
    user: resolveUserName(user, activeMask, responseLocale),
  };
  const rawBaseMessages = await convertToModelMessages(uiMessages);
  // 只给模型保留最近一份可用状态快照：它是下一轮累计好感度/关系值的基准。
  // 更旧的状态 UI 继续剥离，避免多轮面板在上下文里滚雪球复读。若最新一轮
  // 截断在后置记忆区，但好感度核心模块已经闭合，则只保留该完整核心模块；
  // 核心模块本身也截断时才回退上一份。DB 原文和前端展示完全不动。
  const latestUsableStateIdx = findLatestUsableStateSnapshotIndex(
    rawBaseMessages,
    (message) => extractModelMessageText(message.content),
  );
  const strippedBaseMessages = rawBaseMessages.map((m, index) => {
    if (m.role !== "assistant") return m;
    const text = extractModelMessageText(m.content);
    if (!text) return m;
    // The first assistant row is the creator-authored opening, where <user>
    // may intentionally represent preset player dialogue. Ordinary historical
    // replies must not teach the model to echo player turns again.
    const withoutEmbeddedUser =
      index === 0 ? text : stripEmbeddedUserTurns(text);
    const prepared =
      index === latestUsableStateIdx
        ? retainUsableStateSnapshot(withoutEmbeddedUser)
        : stripHistoricalStateBlocks(withoutEmbeddedUser);
    if (prepared === text) return m;
    return { ...m, content: prepared } as ModelMessage;
  });
  // 滑窗截断历史 —— 见 lib/ai/history-truncate.ts。300K token 请求内存打爆
  // 事故（2026-07-04 / 07-05）后引入，超阈值时保留 opening + 最新若干条。
  const truncateResult = truncateHistory(strippedBaseMessages);
  const baseMessages = truncateResult.messages;
  if (truncateResult.truncated) {
    console.log(
      `[chat] history-truncated sessionId=${session.id} orig=${truncateResult.original} kept=${truncateResult.kept} chars=${truncateResult.charsKept}`,
    );
  }
  let lastUserIdx = -1;
  for (let i = baseMessages.length - 1; i >= 0; i--) {
    if (baseMessages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  const modelMessages = baseMessages.map((m, i) => {
    if (m.role !== "user") return m;
    if (!INJECT_EVERY_TURN && i !== lastUserIdx) return m;
    const wrapped = wrapPlayerTurn(
      extractModelMessageText(m.content),
      activeMask,
      wrapCtx,
      responseLocale,
    );
    return {
      ...m,
      content:
        i === lastUserIdx
          ? appendResponseVariationCue(wrapped, {
              key: crypto.randomUUID(),
              mode: isRegenerate ? "regenerate" : "fresh",
            })
          : wrapped,
    };
  });
  const startedAt = Date.now();
  let modelAttemptRecorded = false;
  const recordAttemptOnce = async (
    outcome: "success" | "failure",
    firstTokenAt: number,
  ) => {
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
    `[chat] model=${modelId} sessionId=${session.id} messages=${modelMessages.length}`,
  );

  // system prompt 放进 user 位置而不是 system 位置：部分模型/中转层对 system
  // role 的服从度和处理不一致，作为首条 user 消息前置能拿到更稳的指令遵循。
  // Anthropic/Google/OpenAI provider 都会把连续同角色轮合并，不破坏 user/assistant
  // 交替结构；cacheControl 仍挂在这块文本上，保留 Anthropic prompt 缓存。
  const useAnthropicCache = modelId.startsWith("claude-");
  // 与 user 消息同思路：预生成 UUID，既写进 DB 又作为 toUIMessageStream
  // 的 start.messageId，让 useChat 状态里的 assistant m.id == messages.id，
  // 刚流完的 AI 回复也能被 edit / delete 命中。
  const assistantMessageId = crypto.randomUUID();

  // 兜底：无开场白的卡首条对话是 user，system 轮后要补一条 assistant 确认轮，
  // 否则会出现连续 user。有开场白时首条是 assistant，天然交替，不插。
  const leadMessages = buildPromptLeadMessages({
    systemPrompt,
    firstConversationRole: modelMessages[0]?.role,
    useAnthropicCache,
    responseLocale,
  });

  // Anthropic：末条消息再打一个 cache 断点，让整段对话历史进前缀缓存
  // （system 块上那个断点只覆盖 system 本身，历史 messages 从未被缓存过）。
  // 截断窗口起点已量化稳定（history-truncate.ts），下一轮请求的前缀与本轮
  // 逐字节一致，Anthropic 自动回看最近已缓存断点命中并增量续缓存。
  const finalMessages: ModelMessage[] = [...leadMessages, ...modelMessages];
  if (useAnthropicCache && finalMessages.length > 1) {
    const last = finalMessages[finalMessages.length - 1];
    finalMessages[finalMessages.length - 1] = {
      ...last,
      providerOptions: {
        ...last.providerOptions,
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    } as ModelMessage;
  }

  const requestedTemperature = modelId.startsWith("gemini-")
    ? GEMINI_CHAT_TEMPERATURE
    : undefined;
  const promptDebug = {
    ...promptDebugBase,
    trigger: isRegenerate ? "regenerate-message" : "submit-message",
    historySource: "database",
    sampling: {
      temperature: requestedTemperature ?? null,
      topP: null,
      topK: null,
      seed: null,
    },
    requestPromptFingerprint: traceFingerprint(JSON.stringify(finalMessages)),
    lastUserFingerprint: traceFingerprint(lastText),
    clientLastUserFingerprint: traceFingerprint(clientLastText),
    rejectedResponseFingerprint: rejectedAssistantText
      ? traceFingerprint(rejectedAssistantText)
      : null,
    regenerationReferenceChars: rejectedAssistantText
      ? regenerationReference(rejectedAssistantText).length
      : 0,
  } as const;

  // 落库 + 结算 + 生成 DebugMeta 的核心逻辑，所有模型的 onFinish 复用。
  //
  // 关键行为：
  // - safetyBlocked 半成品保留到 DB 供刷新后还原，但退币；模型侧 history
  //   另行塑形，避免污染下一轮（2026-07-05 事故根因）
  // - 半成品文本此时已经流给客户端（真流式没有 fail-over 补救），前端靠
  //   metadata.safetyBlocked=true 标灰 + 触发重试上限提示
  // - DebugMeta 顶层 safetyBlocked 字段所有用户可见，客户端据此触发重试上限
  type FinalizeArgs = {
    usedModelId: NimirModelId;
    usedTxId: string;
    usedCurrencyPrice: number;
    text: string;
    // string (streamText onFinish) 或 ReasoningPart[] 等 v5 形状。只用它的
    // .length 记日志，用 unknown 避开 AI SDK 版本间字段形状差异。
    reasoning?: unknown;
    finishReason: string;
    usage: Parameters<typeof extractUsageDetails>[0] | null | undefined;
    responseMessages?: Array<{ role: string; content: unknown }>;
    providerFilterDiagnostics?: GeminiFilterDiagnostics;
    stoppedByUser?: boolean;
    waiveCharge?: boolean;
  };
  async function finalizeTurn(args: FinalizeArgs): Promise<DebugMeta> {
    const {
      usedModelId,
      usedTxId,
      usedCurrencyPrice,
      text: rawText,
      reasoning,
      finishReason,
      usage,
      responseMessages,
      providerFilterDiagnostics,
      stoppedByUser = false,
      waiveCharge = false,
    } = args;
    // Gemini 3.1 Pro 中文副词黏滞退化清洗（见 adverb-antistick.ts）：把
    // "极其极其极其..." 之类的连续/密集重复折叠掉。仅对该模型生效，其他模型
    // 完全不动（07 月 616 条 Sonnet 消息里 "极其" 平均 < 0.25/条，无污染）。
    // 清洗结果同时进入 rendered、DB content 和 debug_info.rawOutput —— 保证
    // 下一轮把 assistant 历史回喂时，不会再把重复词泵入上下文形成 echo chamber。
    let text = stripEmbeddedUserTurns(rawText);
    if (text !== rawText) {
      console.log(
        `[chat] removed embedded user turn sessionId=${session.id} before=${rawText.length} after=${text.length}`,
      );
    }
    const repeatedStateGuard = truncateRepeatedStateCycles(text);
    if (repeatedStateGuard.changed) {
      console.warn(
        `[chat] truncated repeated state cycles sessionId=${session.id} before=${repeatedStateGuard.originalChars} after=${repeatedStateGuard.keptChars} starts=${repeatedStateGuard.stateStartCount}`,
      );
      text = repeatedStateGuard.text;
    }
    if (
      usedModelId === "gemini-3.1-pro-preview" &&
      (responseLocale === "zh-Hans" || responseLocale === "zh-Hant") &&
      text
    ) {
      const cleaned = antiStickAdverbs(text);
      if (cleaned.changed) {
        console.log(
          `[chat] adverb-antistick model=${usedModelId} sessionId=${session.id} before=${cleaned.originalCount} after=${cleaned.cleanedCount} polluted=${isPollutedByAdverbs(text, cleaned.originalCount)}`,
        );
        text = cleaned.text;
      }
    }
    const ud = usage ? extractUsageDetails(usage) : {};
    const cost = usage ? await calculateCostMillicents(usedModelId, ud) : 0;
    const pricingForCny = usage ? await getModelPricing(usedModelId) : null;
    const costCny = pricingForCny
      ? calculateCnyMillicents(cost, pricingForCny.usdCnyRate)
      : 0;
    const reasoningLength =
      typeof reasoning === "string"
        ? reasoning.length
        : Array.isArray(reasoning)
          ? reasoning.length
          : 0;
    console.log(
      `[chat] finished model=${usedModelId} finishReason=${finishReason} text=${text.length}chars reasoning=${reasoningLength}chars tokens_in=${ud.inputTokens ?? "—"} tokens_out=${ud.outputTokens ?? "—"} cache_read=${ud.cacheReadTokens ?? 0} cache_write=${ud.cacheWriteTokens ?? 0} reasoning_tokens=${ud.reasoningTokens ?? 0} cost=${formatCostUsd(cost)} +${Date.now() - startedAt}ms`,
    );
    if (text.length === 0) {
      console.log(
        `[chat] EMPTY TEXT finishReason=${finishReason} — response.messages:`,
        JSON.stringify(
          responseMessages?.map((m) => ({
            role: m.role,
            contentTypes: Array.isArray(m.content)
              ? m.content.map((c: unknown) => (c as { type?: string }).type)
              : typeof m.content,
          })),
        ),
      );
    }
    const safetyBlocked = isSafetyBlocked(finishReason, text);
    const responseRefusal =
      isExplicitModelRefusal(text) || finishReason === "refusal";
    // SAFETY 命中的半成品也落库 —— 客户端已经流式渲染出内容，若不落库刷新
    // 就丢失（用户体感：昨天有回复今天没了）。落库 + debug_info.truncatedBySafety
    // 让 SSR 能重新渲染出灰气泡；组下一轮 history 时按 metadata.safetyBlocked
    // 过滤（见上方 uiMessages 过滤），防 07-05 事故复发的 echo chamber。
    // 计费/quota 仍走 refund 路径（Google 已经掐流不该收钱）。
    const {
      text: rendered,
      matchedRules,
      unmatchedRules,
    } = safetyBlocked
      ? { text, matchedRules: [], unmatchedRules: [] }
      : applyRegex(text, activeRules);
    const shouldPersist =
      (text.length > 0 || stoppedByUser) && !(isRegenerate && responseRefusal);
    let persisted = false;
    if (shouldPersist) {
      await db.transaction(async (tx) => {
        // Serialize this final tail check with new-turn insertion. Without the
        // shared lock, a newer user row could land between SELECT and INSERT.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${CHAT_LOCK_NS}, hashtext(${session.id}))`,
        );
        const [latestActiveMessage] = await tx
          .select({ id: messages.id, role: messages.role })
          .from(messages)
          .where(
            and(
              eq(messages.sessionId, session.id),
              isNull(messages.supersededAt),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);
        const turnIsCurrent = isRegenerate
          ? isRegenerationTargetCurrent(
              regenerateTargetAssistantId,
              latestActiveMessage,
            )
          : isOriginatingTurnCurrent(
              originatingUserMessageId,
              latestActiveMessage,
            );
        if (!turnIsCurrent) {
          return;
        }

        if (isRegenerate && regenerateTargetAssistantId) {
          const replaced = await tx
            .update(messages)
            .set({ supersededAt: new Date() })
            .where(
              and(
                eq(messages.id, regenerateTargetAssistantId),
                eq(messages.sessionId, session.id),
                eq(messages.role, "assistant"),
                isNull(messages.supersededAt),
              ),
            )
            .returning({ id: messages.id });
          if (replaced.length === 0) return;
        }

        await tx.insert(messages).values({
          id: assistantMessageId,
          sessionId: session.id,
          role: "assistant",
          content: text,
          renderedHtml: rendered === text ? null : rendered,
          model: usedModelId,
          tokensIn: ud.inputTokens ?? null,
          tokensOut: ud.outputTokens ?? null,
          cacheReadTokens: ud.cacheReadTokens ?? null,
          cacheWriteTokens: ud.cacheWriteTokens ?? null,
          reasoningTokens: ud.reasoningTokens ?? null,
          // SAFETY / 首字前主动停止不计费（退款走下面 refundCurrency）
          costMillicents: safetyBlocked || waiveCharge ? null : cost || null,
          costCnyMillicents:
            safetyBlocked || waiveCharge ? null : costCny || null,
          currencyType: currencyType,
          currencyAmount: safetyBlocked || waiveCharge ? 0 : usedCurrencyPrice,
          latencyMs: Date.now() - startedAt,
          debugInfo: {
            rawOutput: text,
            finishReason,
            systemPrompt,
            ...promptDebug,
            matchedRules: matchedRules.map(({ id, name }) => ({ id, name })),
            unmatchedRules: unmatchedRules.map(({ id, name }) => ({
              id,
              name,
            })),
            truncatedBySafety: safetyBlocked,
            responseRefusal,
            ...(repeatedStateGuard.changed
              ? {
                  repeatedStateCycleGuard: {
                    originalChars: repeatedStateGuard.originalChars,
                    keptChars: repeatedStateGuard.keptChars,
                    stateStartCount: repeatedStateGuard.stateStartCount,
                  },
                }
              : {}),
            ...(stoppedByUser ? { stoppedByUser: true } : {}),
            ...(providerFilterDiagnostics ? { providerFilterDiagnostics } : {}),
          },
        });
        await tx
          .update(chatSessions)
          .set({ lastMessageAt: new Date() })
          .where(eq(chatSessions.id, session.id));
        persisted = true;
      });
    }
    const staleTurnDiscarded = shouldPersist && !persisted;
    if (staleTurnDiscarded) {
      console.warn(
        `[chat] discarded stale assistant reply sessionId=${session.id} originUserMessageId=${originatingUserMessageId ?? "missing"}`,
      );
    }
    const chargeWaived = safetyBlocked || waiveCharge || staleTurnDiscarded;
    if (chargeWaived) {
      // Google 掐流或尚未出字就主动停止，用户不该为这轮付费。
      await refundCurrencyAmount(userId, currencyType, usedCurrencyPrice, {
        modelId: usedModelId,
        note: staleTurnDiscarded
          ? "退款 - 旧请求回复已失效"
          : waiveCharge
            ? "退款 - 生成在首字前停止"
            : responseRefusal
              ? "退款 - 模型未完成请求（拒答）"
              : "退款 - 回复未完整生成",
        sessionId: session.id,
      });
    } else if (persisted) {
      // assistant 行落地后再链流水（ProfileTabs 靠 messageId join 出角色名）
      await linkTransactionToMessage(usedTxId, assistantMessageId);
      await settleTransactionCost(usedTxId, costCny ?? 0);
    }
    return canDebug
      ? {
          debug: {
            rawOutput: text,
            systemPrompt,
            ...promptDebug,
            matchedRules: matchedRules.map(({ id, name }) => ({ id, name })),
            unmatchedRules: unmatchedRules.map(({ id, name }) => ({
              id,
              name,
            })),
            truncatedBySafety: safetyBlocked,
            ...(repeatedStateGuard.changed
              ? {
                  repeatedStateCycleGuard: {
                    originalChars: repeatedStateGuard.originalChars,
                    keptChars: repeatedStateGuard.keptChars,
                    stateStartCount: repeatedStateGuard.stateStartCount,
                  },
                }
              : {}),
            ...(stoppedByUser ? { stoppedByUser: true } : {}),
            ...(providerFilterDiagnostics ? { providerFilterDiagnostics } : {}),
          },
          model: usedModelId,
          tokensIn: ud.inputTokens ?? null,
          tokensOut: ud.outputTokens ?? null,
          cacheReadTokens: ud.cacheReadTokens ?? null,
          cacheWriteTokens: ud.cacheWriteTokens ?? null,
          reasoningTokens: ud.reasoningTokens ?? null,
          costMillicents: chargeWaived ? null : cost || null,
          costCnyMillicents: chargeWaived ? null : costCny || null,
          latencyMs: Date.now() - startedAt,
          safetyBlocked,
          stoppedByUser,
        }
      : {
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

  // Stream 抛错前如果我们刚为这一轮插过 user 行（!isRegenerate 分支），
  // 那条 user 行会一直挂在 session tail 上，把 in-flight guard 卡满
  // CHAT_IN_FLIGHT_TTL_MS —— 用户后续换任何模型 send 都会撞 409。
  // 这里 supersede 掉，让 guard 立即松开；行本身保留在 DB 里方便审计。
  async function supersedeOrphanUserOnStreamError(
    reason: string,
  ): Promise<void> {
    if (!shouldSupersedeOriginatingUser(isRegenerate, originatingUserMessageId))
      return;
    const orphanId = originatingUserMessageId as string;
    const updated = await db
      .update(messages)
      .set({ supersededAt: new Date() })
      .where(
        and(
          eq(messages.id, orphanId),
          eq(messages.role, "user"),
          isNull(messages.supersededAt),
        ),
      )
      .returning({ id: messages.id });
    if (updated.length > 0) {
      console.warn(
        `[chat] superseded orphan user row on ${reason} sessionId=${session.id} userMessageId=${orphanId}`,
      );
    }
  }

  const stream = createUIMessageStream<ChatUIMessage>({
    onError: (streamError) => {
      console.error(
        `[chat] UI stream error model=${modelId} sessionId=${session.id} +${Date.now() - startedAt}ms:`,
        streamError,
      );
      return "stream_error";
    },
    execute: async ({ writer }) => {
      const isGemini = modelId.startsWith("gemini-");

      // === 非 Gemini：单 streamText 真流式，直通 toUIMessageStream ===
      if (!isGemini) {
        let streamMeta: DebugMeta = emptyMeta();
        let streamedText = "";
        let settlement: Promise<DebugMeta> | null = null;
        const settleOnce = (work: () => Promise<DebugMeta>) => {
          settlement ??= work();
          return settlement;
        };
        const settleStopped = () =>
          settleOnce(() =>
            finalizeTurn({
              usedModelId: modelId,
              usedTxId: deductTxId,
              usedCurrencyPrice: currencyPrice,
              text: streamedText,
              finishReason: "stop",
              usage: null,
              stoppedByUser: true,
              waiveCharge: streamedText.length === 0,
            }),
          );
        // TTFT 埋点：首个可见 text chunk 到达时打点，用于诊断"首字慢"体感。
        // onChunk 在 UI stream 转发之前触发，接近真实用户可见时刻。
        let firstTokenAt = 0;
        const result = streamText({
          model: modelById(modelId),
          messages: finalMessages,
          providerOptions,
          temperature: requestedTemperature,
          abortSignal: req.signal,
          onChunk: ({ chunk }) => {
            if (chunk.type === "text-delta") {
              streamedText += chunk.text;
            }
            if (firstTokenAt === 0 && chunk.type === "text-delta") {
              firstTokenAt = Date.now();
              console.log(
                `[chat] TTFT model=${modelId} sessionId=${session.id} ttft=${firstTokenAt - startedAt}ms`,
              );
            }
          },
          onFinish: async ({
            text,
            reasoning,
            response,
            usage,
            finishReason,
          }) => {
            if (!isSafetyBlocked(finishReason, text)) {
              await recordAttemptOnce(
                text.length > 0 ? "success" : "failure",
                firstTokenAt,
              );
            }
            streamMeta = await settleOnce(() =>
              finalizeTurn({
                usedModelId: modelId,
                usedTxId: deductTxId,
                usedCurrencyPrice: currencyPrice,
                text,
                reasoning,
                finishReason,
                usage,
                responseMessages: response?.messages,
              }),
            );
          },
          onAbort: async () => {
            streamMeta = await settleStopped();
          },
          onError: async ({ error }) => {
            if (req.signal.aborted) {
              streamMeta = await settleStopped();
              return;
            }
            console.error(
              `[chat] stream error model=${modelId} +${Date.now() - startedAt}ms:`,
              error,
            );
            if (!isPromptPolicyRejection(error))
              await recordAttemptOnce("failure", firstTokenAt);
            streamMeta = await settleOnce(async () => {
              await refundCurrency(userId, modelId, currencyType, {
                note: "退款 - 流式异常",
                sessionId: session.id,
              });
              await supersedeOrphanUserOnStreamError("stream error");
              return emptyMeta();
            });
          },
        });
        writer.merge(
          result.toUIMessageStream<ChatUIMessage>({
            generateMessageId: () => assistantMessageId,
          }),
        );
        await Promise.resolve(result.finishReason).catch(() => "error");
        if (settlement) streamMeta = await settlement;
        writer.write({
          type: "message-metadata",
          messageMetadata: streamMeta,
        });
        if (isRegenerate && isExplicitModelRefusal(streamedText)) {
          writer.write({ type: "error", errorText: "content_restricted" });
        }
        return;
      }

      // === Gemini：fullStream 手工转发 ===
      // SAFETY 命中不再自动切 Sonnet 续写 —— 历史上"Gemini 半段 + Sonnet
      // prefill 续写"两次事故都写了两个状态栏 / 重开叙述 (见 memory
      // gemini-sonnet-continuation-double-status)。现在跟非 Gemini SAFETY
      // 一致处理：半段保留、退币、metadata.safetyBlocked=true，
      // 客户端连续 3 次触发硬上限提示。
      const textPartId = "0";
      writer.write({ type: "start", messageId: assistantMessageId });
      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id: textPartId });

      const closeStream = () => {
        writer.write({ type: "text-end", id: textPartId });
        writer.write({ type: "finish-step" });
        writer.write({ type: "finish" });
      };

      let geminiText = "";
      let geminiFinishReason = "";
      let geminiUsage:
        | Parameters<typeof extractUsageDetails>[0]
        | null
        | undefined = null;
      let geminiError: unknown = null;
      let geminiAborted = false;
      let geminiRawFinishReason: string | undefined;
      let geminiProviderMetadata: unknown;
      // TTFT 埋点：Gemini 首字很慢的常见根因是 thinking phase 先烧
      // reasoning_tokens 才吐 text；这里记录首个 text-delta 到达时刻，
      // 结合 finalizeTurn 的 reasoning_tokens 就能区分 "thinking 慢" vs
      // "text 生成慢" vs "上游中转慢"。
      let geminiFirstTokenAt = 0;

      const gResult = streamText({
        model: modelById(modelId),
        messages: finalMessages,
        providerOptions,
        temperature: requestedTemperature,
        abortSignal: req.signal,
        onAbort: () => {
          geminiAborted = true;
        },
        // 中转卡住时快速失败（默认 3 × 128s = 384s 太长）。
        // Gemini 走 OpenAI-compat 中转（NewAPI），providerOptions.google.*
        // (safetySettings / thinkingConfig) 全部无法透传；温度经
        // requestedTemperature 单独传给 streamText。中文长上下文的
        // repetition trap 目前靠 history-truncate 缓解。
        maxRetries: 1,
      });

      try {
        for await (const part of gResult.fullStream) {
          if (part.type === "text-delta") {
            if (geminiFirstTokenAt === 0) {
              geminiFirstTokenAt = Date.now();
              console.log(
                `[chat] TTFT model=${modelId} sessionId=${session.id} ttft=${geminiFirstTokenAt - startedAt}ms`,
              );
            }
            geminiText += part.text;
            writer.write({
              type: "text-delta",
              id: textPartId,
              delta: part.text,
            });
          } else if (part.type === "finish-step") {
            geminiRawFinishReason = part.rawFinishReason;
            geminiProviderMetadata = part.providerMetadata;
          } else if (part.type === "finish") {
            geminiFinishReason = part.finishReason;
            geminiRawFinishReason =
              part.rawFinishReason ?? geminiRawFinishReason;
            geminiUsage = part.totalUsage;
          } else if (part.type === "error") {
            geminiError = part.error;
          }
        }
      } catch (err) {
        geminiError = err;
      }

      closeStream();

      if (geminiAborted || req.signal.aborted) {
        const meta = await finalizeTurn({
          usedModelId: modelId,
          usedTxId: deductTxId,
          usedCurrencyPrice: currencyPrice,
          text: geminiText,
          finishReason: "stop",
          usage: geminiUsage,
          stoppedByUser: true,
          waiveCharge: geminiText.length === 0,
        });
        writer.write({
          type: "message-metadata",
          messageMetadata: meta,
        });
        return;
      }

      if (geminiError) {
        console.error(
          `[chat] gemini stream error model=${modelId} +${Date.now() - startedAt}ms:`,
          geminiError,
        );
        if (!isPromptPolicyRejection(geminiError))
          await recordAttemptOnce("failure", geminiFirstTokenAt);
        await refundCurrency(userId, modelId, currencyType, {
          note: "退款 - Gemini 调用异常",
          sessionId: session.id,
        });
        await supersedeOrphanUserOnStreamError("gemini stream error");
        writer.write({
          type: "message-metadata",
          messageMetadata: emptyMeta(),
        });
        writer.write({
          type: "error",
          errorText: isPromptPolicyRejection(geminiError)
            ? "content_restricted"
            : "model_unavailable",
        });
        return;
      }

      // finalizeTurn 内部会判 safetyBlocked：命中保留半段但退币，并写
      // metadata.safetyBlocked=true；不命中就正常入库落 debug_info。
      const gResponse = await Promise.resolve(gResult.response).catch(
        () => null,
      );
      const providerFilterDiagnostics = isSafetyBlocked(
        geminiFinishReason,
        geminiText,
      )
        ? extractGeminiFilterDiagnostics(
            geminiRawFinishReason,
            geminiProviderMetadata,
          )
        : undefined;
      if (!isSafetyBlocked(geminiFinishReason, geminiText)) {
        await recordAttemptOnce(
          geminiText.length > 0 ? "success" : "failure",
          geminiFirstTokenAt,
        );
      }
      if (providerFilterDiagnostics) {
        console.warn(
          `[chat] gemini filter diagnostics model=${modelId} sessionId=${session.id} details=${JSON.stringify(providerFilterDiagnostics)}`,
        );
      }
      const meta = await finalizeTurn({
        usedModelId: modelId,
        usedTxId: deductTxId,
        usedCurrencyPrice: currencyPrice,
        text: geminiText,
        finishReason: geminiFinishReason,
        usage: geminiUsage,
        responseMessages: gResponse?.messages,
        providerFilterDiagnostics,
      });
      writer.write({
        type: "message-metadata",
        messageMetadata: meta,
      });
      if (
        isRegenerate &&
        (isExplicitModelRefusal(geminiText) || geminiFinishReason === "refusal")
      ) {
        writer.write({ type: "error", errorText: "content_restricted" });
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream,
  });
}
