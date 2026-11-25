/**
 * 充值金币 —— 用于直购金币包支付成功后的履约。
 *
 * 与 grantMembership 类似，在事务里写入 currency_transactions 记录并更新余额。
 */

import { eq, sql } from "drizzle-orm";
import type { db } from "@/lib/db/client";
import { currencyTransactions, users } from "@/lib/db/schema";

/** db.transaction 回调拿到的事务句柄类型。 */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RechargeGoldOptions {
  /** 来源标识（如 "stripe", "payproo", "admin"） */
  source: string;
  /** 金币包 ID（如 "gold_1600"） */
  packageId?: string;
}

/**
 * 给用户充值金币。
 *
 * @param tx 数据库事务
 * @param userId 用户 ID
 * @param amount 充值金币数量
 * @param opts 选项
 */
export async function rechargeGold(
  tx: DbTx,
  userId: string,
  amount: number,
  opts: RechargeGoldOptions,
): Promise<void> {
  if (amount <= 0) {
    throw new Error("充值金币数量必须大于 0");
  }

  // 1. 获取当前余额并加锁
  const [user] = await tx
    .select({ goldBalance: users.goldBalance })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // 2. 更新用户金币余额
  await tx
    .update(users)
    .set({
      goldBalance: sql`${users.goldBalance} + ${amount}`,
    })
    .where(eq(users.id, userId));

  // 3. 写入充值记录
  const sourceNote =
    opts.source === "stripe"
      ? "Stripe 支付"
      : opts.source === "payproo"
        ? "PayProo 支付"
        : "管理员充值";
  await tx.insert(currencyTransactions).values({
    userId,
    transactionType: "recharge",
    currencyType: "gold",
    amount,
    balanceAfter: user.goldBalance + amount,
    note: opts.packageId
      ? `直购金币包 ${opts.packageId}（${sourceNote}）`
      : `金币充值（${sourceNote}）`,
  });
}
