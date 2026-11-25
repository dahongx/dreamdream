import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currencyTransactions, modelPrices, users } from "@/lib/db/schema";

export type CurrencyType = "gold" | "silver";

/** 没配 model_prices 时的兜底，与 admin 默认一致。 */
const FALLBACK_GOLD_COST = 1;
const FALLBACK_SILVER_COST = 2;

/** 图片生成走固定价（没有 modelId 概念，走 env 的 image 模型）。
 *  TODO 可视化：若要支持 admin 调，挂到 platform_settings 表。 */
export const IMAGE_GOLD_COST = 3;
export const IMAGE_SILVER_COST = 6;

export function imageCostFor(currencyType: CurrencyType): number {
  return currencyType === "gold" ? IMAGE_GOLD_COST : IMAGE_SILVER_COST;
}

/** 查某个 model 的单次调用币价。未配置走兜底。 */
export async function priceFor(
  modelId: string,
  currencyType: CurrencyType,
): Promise<number> {
  const [priceRow] = await db
    .select({
      goldCostPerCall: modelPrices.goldCostPerCall,
      silverCostPerCall: modelPrices.silverCostPerCall,
    })
    .from(modelPrices)
    .where(eq(modelPrices.modelId, modelId))
    .limit(1);
  return currencyType === "gold"
    ? (priceRow?.goldCostPerCall ?? FALLBACK_GOLD_COST)
    : (priceRow?.silverCostPerCall ?? FALLBACK_SILVER_COST);
}

async function getBalance(
  userId: string,
  currencyType: CurrencyType,
): Promise<number | null> {
  const [user] = await db
    .select({
      goldBalance: users.goldBalance,
      silverBalance: users.silverBalance,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;
  return currencyType === "gold" ? user.goldBalance : user.silverBalance;
}

export interface CurrencyCheck {
  allowed: boolean;
  price?: number;
  balance?: number;
}

/**
 * Check if user has sufficient balance for the selected currency type.
 * Returns { allowed: true, price } if sufficient, { allowed: false } otherwise.
 */
export async function checkCurrencyBalance(
  userId: string,
  modelId: string,
  currencyType: CurrencyType,
): Promise<CurrencyCheck> {
  const price = await priceFor(modelId, currencyType);
  return checkCurrencyBalanceAmount(userId, currencyType, price);
}

/** 按固定 amount 校验余额（图片生成等无 modelId 场景用）。 */
export async function checkCurrencyBalanceAmount(
  userId: string,
  currencyType: CurrencyType,
  amount: number,
): Promise<CurrencyCheck> {
  const balance = await getBalance(userId, currencyType);
  if (balance == null) return { allowed: false };
  return {
    allowed: balance >= amount,
    price: amount,
    balance,
  };
}

/** 货币变动元信息：调用方可附带 modelId / messageId / sessionId / note 一起入流水表。
 *  没有 messageId 概念的场景（如美化包生成、图片生成）就只塞 note，
 *  让 ProfileTabs 的"货币消耗"列表能给出可读描述。
 *
 *  sessionId 是冗余字段：聊天/续写扣费时连同 messageId 一起写入，让账本 UI
 *  在 message 还没入库（onError 异常路径）时也能 JOIN chat_sessions 拿角色名。 */
export interface CurrencyMutationOpts {
  modelId?: string | null;
  messageId?: string | null;
  sessionId?: string | null;
  note?: string | null;
}

export interface DeductResult {
  transactionId: string;
  balanceAfter: number;
}

/** 单次事务里：扣余额 + 写一条 currency_transactions（amount 取负）。
 *  曾经只改 *_balance 列不写流水，直接导致个人主页"货币消耗"看不到
 *  对话/美化包/图片的扣费记录——这是该函数的核心修复点。 */
async function mutateCurrency(
  userId: string,
  currencyType: CurrencyType,
  signedAmount: number,
  opts: CurrencyMutationOpts,
): Promise<DeductResult> {
  return db.transaction(async (tx) => {
    let balanceAfter: number;
    if (currencyType === "gold") {
      const [updated] = await tx
        .update(users)
        .set({ goldBalance: sql`${users.goldBalance} + ${signedAmount}` })
        .where(eq(users.id, userId))
        .returning({ balance: users.goldBalance });
      if (!updated) throw new Error(`mutateCurrency: user ${userId} not found`);
      balanceAfter = updated.balance;
    } else {
      const [updated] = await tx
        .update(users)
        .set({
          silverBalance: sql`${users.silverBalance} + ${signedAmount}`,
        })
        .where(eq(users.id, userId))
        .returning({ balance: users.silverBalance });
      if (!updated) throw new Error(`mutateCurrency: user ${userId} not found`);
      balanceAfter = updated.balance;
    }

    const [txRow] = await tx
      .insert(currencyTransactions)
      .values({
        userId,
        transactionType: "model_usage",
        currencyType,
        amount: signedAmount,
        balanceAfter,
        modelId: opts.modelId ?? null,
        messageId: opts.messageId ?? null,
        sessionId: opts.sessionId ?? null,
        note: opts.note ?? null,
      })
      .returning({ id: currencyTransactions.id });

    return { transactionId: txRow.id, balanceAfter };
  });
}

/**
 * Deduct currency from user's balance. Should only be called after
 * checkCurrencyBalance confirms sufficient balance.
 *
 * 返回 transactionId：聊天/续写场景下 onFinish 拿到 assistant message id
 * 后会回写到流水的 message_id 字段（参见 linkTransactionToMessage）。
 */
export async function deductCurrency(
  userId: string,
  modelId: string,
  currencyType: CurrencyType,
  opts: Omit<CurrencyMutationOpts, "modelId"> = {},
): Promise<DeductResult> {
  const price = await priceFor(modelId, currencyType);
  return mutateCurrency(userId, currencyType, -price, {
    ...opts,
    modelId,
  });
}

export async function deductCurrencyAmount(
  userId: string,
  currencyType: CurrencyType,
  amount: number,
  opts: CurrencyMutationOpts = {},
): Promise<DeductResult> {
  return mutateCurrency(userId, currencyType, -amount, opts);
}

/**
 * Refund currency back to user's balance (used when message generation fails
 * or is blocked by safety filter). 同步写一条正数 amount 的流水。
 */
export async function refundCurrency(
  userId: string,
  modelId: string,
  currencyType: CurrencyType,
  opts: Omit<CurrencyMutationOpts, "modelId"> = {},
): Promise<DeductResult> {
  const price = await priceFor(modelId, currencyType);
  return mutateCurrency(userId, currencyType, +price, {
    ...opts,
    modelId,
    note: opts.note ?? "退款",
  });
}

export async function refundCurrencyAmount(
  userId: string,
  currencyType: CurrencyType,
  amount: number,
  opts: CurrencyMutationOpts = {},
): Promise<DeductResult> {
  return mutateCurrency(userId, currencyType, +amount, {
    ...opts,
    note: opts.note ?? "退款",
  });
}

/** 聊天/续写流式回包完成后，把 deduct 时拿到的 transactionId 关联到 assistant
 *  message id —— ProfileTabs 的 description 通过 messageId join 出角色名。 */
export async function linkTransactionToMessage(
  transactionId: string,
  messageId: string,
): Promise<void> {
  await db
    .update(currencyTransactions)
    .set({ messageId })
    .where(eq(currencyTransactions.id, transactionId));
}

/**
 * 把这笔扣费对应的真实 CNY 成本（millicents）回填到 currency_transactions。
 * 写入时机：deduct 时还不知道 cost（tokens 未知），等流式 onFinish / 非流式
 * 调用完成后拿到 usage 算出来再 settle。失败路径不调用，行保持 NULL。
 *
 * 与 messages.cost_cny_millicents 的关系：
 *   - 聊天/续写：两边都写，messages 是给消息维度（debug / 分析）用，
 *     currency_transactions 是给账本维度（按流水查 cost）用。
 *   - 美化包/图片：没有 message，只有 currency_transactions 这一份。
 *
 * 0 cost 也写（区别于 NULL）—— 让 ledger UI 能区分「已结算但 0 成本」
 * 和「未结算 / 失败」。
 */
export async function settleTransactionCost(
  transactionId: string,
  costCnyMillicents: number,
): Promise<void> {
  await db
    .update(currencyTransactions)
    .set({ costCnyMillicents })
    .where(eq(currencyTransactions.id, transactionId));
}
