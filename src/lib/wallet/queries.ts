import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  characters,
  chatSessions,
  currencyTransactions,
  messages,
  modelPrices,
  users,
} from "@/lib/db/schema";

export interface UserWalletInfo {
  role: "regular" | "beta_tester" | "admin";
  totalCostCnyMillicents: number;
  goldBalance: number;
  silverBalance: number;
  membershipTier: "gold" | "platinum" | "diamond" | null;
  membershipExpiresAt: Date | null;
}

export interface DailyUsageRecord {
  date: string;
  model: string;
  messageCount: number;
  tokensIn: number;
  tokensOut: number;
  costCnyMillicents: number;
  goldSpent: number;
  silverSpent: number;
}

export interface MessageUsageRecord {
  id: string;
  createdAt: Date;
  model: string;
  /** 角色已随创作者注销被删时为 null（会话保留、角色行没了）。 */
  characterName: string | null;
  tokensIn: number;
  tokensOut: number;
  currencyType: "gold" | "silver" | null;
  currencyAmount: number;
  costCnyMillicents: number;
}

export interface CurrencyTransactionRecord {
  id: string;
  createdAt: Date;
  transactionType: "daily_claim" | "recharge" | "model_usage";
  eventKind:
    | "daily_claim"
    | "recharge"
    | "chat"
    | "continue"
    | "pack"
    | "image"
    | "refund"
    | "model_usage";
  characterName: string | null;
  // 调用的模型；非 model_usage（签到 / 充值）以及没记录 model_id 的历史数据为 null。
  // 优先用 model_prices.display_name（如 "Claude Sonnet 4.6"），没配过价直接落回 model_id。
  model: string | null;
  goldAmount: number;
  silverAmount: number;
  goldBalanceAfter: number | null;
  silverBalanceAfter: number | null;
}

export function classifyCurrencyTransactionEvent(input: {
  transactionType: CurrencyTransactionRecord["transactionType"];
  note: string | null;
  characterName: string | null;
}): CurrencyTransactionRecord["eventKind"] {
  if (input.transactionType === "daily_claim") return "daily_claim";
  if (input.transactionType === "recharge") return "recharge";
  if (input.note?.startsWith("退款")) return "refund";
  if (input.note?.startsWith("续写")) return "continue";
  if (input.note?.startsWith("聊天") || input.characterName) return "chat";
  if (input.note?.startsWith("美化包")) return "pack";
  if (input.note?.startsWith("图片生成")) return "image";
  return "model_usage";
}

/**
 * 获取用户钱包基础信息（会员等级、总消耗、货币余额）
 */
export async function getUserWalletInfo(
  userId: string,
): Promise<UserWalletInfo> {
  const [user] = await db
    .select({
      role: users.role,
      goldBalance: users.goldBalance,
      silverBalance: users.silverBalance,
      membershipTier: users.membershipTier,
      membershipExpiresAt: users.membershipExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  // 计算用户所有消息的总消耗（只算 assistant 消息且有 model 的）
  const [costResult] = await db
    .select({
      totalCostCnyMillicents: sql<number>`COALESCE(SUM(${messages.costCnyMillicents}), 0)::int`,
    })
    .from(messages)
    .innerJoin(chatSessions, eq(chatSessions.id, messages.sessionId))
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(messages.role, "assistant"),
        isNotNull(messages.model),
      ),
    );

  return {
    role: user.role,
    totalCostCnyMillicents: costResult?.totalCostCnyMillicents ?? 0,
    goldBalance: user.goldBalance,
    silverBalance: user.silverBalance,
    membershipTier: user.membershipTier,
    membershipExpiresAt: user.membershipExpiresAt,
  };
}

/**
 * 获取用户按日期聚合的消费记录（最近 30 天）
 */
export async function getUserDailyUsage(
  userId: string,
  limit = 30,
): Promise<DailyUsageRecord[]> {
  // 按 Asia/Shanghai 时区切日
  const dayExpr = sql<string>`to_char(${messages.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      date: dayExpr,
      model: messages.model,
      messageCount: sql<number>`count(*)::int`,
      tokensIn: sql<number>`COALESCE(SUM(${messages.tokensIn}), 0)::int`,
      tokensOut: sql<number>`COALESCE(SUM(${messages.tokensOut}), 0)::int`,
      costCnyMillicents: sql<number>`COALESCE(SUM(${messages.costCnyMillicents}), 0)::int`,
      goldSpent: sql<number>`COALESCE(SUM(CASE WHEN ${messages.currencyType} = 'gold' THEN ${messages.currencyAmount} ELSE 0 END), 0)::int`,
      silverSpent: sql<number>`COALESCE(SUM(CASE WHEN ${messages.currencyType} = 'silver' THEN ${messages.currencyAmount} ELSE 0 END), 0)::int`,
    })
    .from(messages)
    .innerJoin(chatSessions, eq(chatSessions.id, messages.sessionId))
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(messages.role, "assistant"),
        isNotNull(messages.model),
      ),
    )
    .groupBy(dayExpr, messages.model)
    .orderBy(desc(dayExpr))
    .limit(limit);

  return rows.map((row) => ({
    date: row.date,
    model: row.model ?? "unknown",
    messageCount: row.messageCount,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costCnyMillicents: row.costCnyMillicents,
    goldSpent: row.goldSpent,
    silverSpent: row.silverSpent,
  }));
}

/**
 * 获取用户的详细消息使用记录（每条消息一条记录）
 */
export async function getUserMessageUsage(
  userId: string,
  limit = 100,
): Promise<MessageUsageRecord[]> {
  const rows = await db
    .select({
      id: messages.id,
      createdAt: messages.createdAt,
      model: messages.model,
      characterName: characters.name,
      tokensIn: messages.tokensIn,
      tokensOut: messages.tokensOut,
      currencyType: messages.currencyType,
      currencyAmount: messages.currencyAmount,
      costCnyMillicents: messages.costCnyMillicents,
    })
    .from(messages)
    .innerJoin(chatSessions, eq(chatSessions.id, messages.sessionId))
    // leftJoin：角色随创作者注销被删后 chat_sessions.character_id 变 null
    // （migration 0042）。innerJoin 会把这些消息的用量记录整片吞掉 —— 花过的钱
    // 从账里凭空消失，比显示一个没有角色名的条目糟糕得多。
    .leftJoin(characters, eq(characters.id, chatSessions.characterId))
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(messages.role, "assistant"),
        isNotNull(messages.model),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    model: row.model ?? "unknown",
    characterName: row.characterName,
    tokensIn: row.tokensIn ?? 0,
    tokensOut: row.tokensOut ?? 0,
    currencyType: row.currencyType as "gold" | "silver" | null,
    currencyAmount: row.currencyAmount ?? 0,
    costCnyMillicents: row.costCnyMillicents ?? 0,
  }));
}

/**
 * 获取用户的货币交易流水记录
 */
export async function getUserCurrencyTransactions(
  userId: string,
  limit = 100,
): Promise<CurrencyTransactionRecord[]> {
  // 角色名 join：优先用流水自己冗余的 sessionId（聊天/续写扣费 + 退款都
  // 写了），fallback 走 messageId → messages.sessionId（老数据 + 健壮兜底）。
  // 两条路径并存：写入侧已经在 sessionId 这一列稳定下来，但 messageId 这条
  // 旧通路仍能 cover 历史数据，直到 backfill 脚本把全量补齐。
  const sessionIdCoalesced = sql<
    string | null
  >`COALESCE(${currencyTransactions.sessionId}, ${messages.sessionId})`;
  const rows = await db
    .select({
      id: currencyTransactions.id,
      createdAt: currencyTransactions.createdAt,
      transactionType: currencyTransactions.transactionType,
      currencyType: currencyTransactions.currencyType,
      amount: currencyTransactions.amount,
      balanceAfter: currencyTransactions.balanceAfter,
      note: currencyTransactions.note,
      messageId: currencyTransactions.messageId,
      modelId: currencyTransactions.modelId,
      modelDisplayName: modelPrices.displayName,
      characterName: characters.name,
    })
    .from(currencyTransactions)
    .leftJoin(messages, eq(messages.id, currencyTransactions.messageId))
    .leftJoin(chatSessions, eq(chatSessions.id, sessionIdCoalesced))
    .leftJoin(characters, eq(characters.id, chatSessions.characterId))
    .leftJoin(
      modelPrices,
      eq(modelPrices.modelId, currencyTransactions.modelId),
    )
    .where(eq(currencyTransactions.userId, userId))
    .orderBy(desc(currencyTransactions.createdAt))
    .limit(limit);

  // 按时间分组，将同一时刻的金币和银币交易合并
  const grouped = new Map<
    string,
    {
      id: string;
      createdAt: Date;
      transactionType: string;
      eventKind: CurrencyTransactionRecord["eventKind"];
      characterName: string | null;
      model: string | null;
      goldAmount: number;
      silverAmount: number;
      goldBalanceAfter: number | null;
      silverBalanceAfter: number | null;
    }
  >();

  for (const row of rows) {
    const key = `${row.createdAt.toISOString()}-${row.transactionType}-${row.messageId || ""}`;
    const existing = grouped.get(key);

    // 生成结构化事件。note 是历史内部数据（早期固定写简中），不能直接当 UI 文案；
    // 这里只用稳定前缀归类，真正的显示文本由当前 locale 的词典生成。
    // model_usage 现在涵盖三类 note：
    //   - 聊天/续写扣费 / 同源退款：流水冗余了 sessionId → 直接 JOIN 出 characterName
    //     （老数据 sessionId 为 NULL，回退到 messageId → messages.sessionId 路径）
    //   - 美化包/图片生成扣费：无 sessionId/messageId → note 已含分类（如"美化包 - 替换 HTML"）
    //   - 退款（amount > 0）：note 已含 "退款 -" 前缀
    const eventKind = classifyCurrencyTransactionEvent({
      transactionType: row.transactionType,
      note: row.note,
      characterName: row.characterName,
    });

    // 模型展示名：优先 admin 配过价的 display_name，没配过就退回 model_id 字面。
    // 非 model_usage 行 model_id 本来就是 NULL，这里也保持 null（UI 渲染「—」）。
    const model = row.modelDisplayName ?? row.modelId ?? null;

    if (existing) {
      // 合并同一时刻的金币和银币交易
      if (row.currencyType === "gold") {
        existing.goldAmount = row.amount;
        existing.goldBalanceAfter = row.balanceAfter;
      } else {
        existing.silverAmount = row.amount;
        existing.silverBalanceAfter = row.balanceAfter;
      }
      // 同一调用的金 / 银两行 model 一致；如果某一行漏写 model_id，用另一行补上。
      if (existing.model == null && model != null) {
        existing.model = model;
      }
    } else {
      grouped.set(key, {
        id: row.id,
        createdAt: row.createdAt,
        transactionType: row.transactionType,
        eventKind,
        characterName: row.characterName,
        model,
        goldAmount: row.currencyType === "gold" ? row.amount : 0,
        silverAmount: row.currencyType === "silver" ? row.amount : 0,
        goldBalanceAfter: row.currencyType === "gold" ? row.balanceAfter : null,
        silverBalanceAfter:
          row.currencyType === "silver" ? row.balanceAfter : null,
      });
    }
  }

  return Array.from(grouped.values()).map((record) => ({
    ...record,
    transactionType: record.transactionType as
      | "daily_claim"
      | "recharge"
      | "model_usage",
  }));
}
