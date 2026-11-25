/**
 * 会员开通的 DB 履约核心 —— 被「Stripe webhook 履约」和（未来）「admin 手动开通」
 * 共用。
 *
 * 注意：本文件**不是** "use server"。grantMembership 接收一个 Drizzle 事务句柄
 * （tx 不可序列化，不能当 server action），所以放在普通 server 模块里，供
 * route handler（webhook）和 server action 一起 import —— 后者再各自包一层
 * db.transaction。
 *
 * 这段逻辑原本内联在 membership/actions.ts:subscribeToTier 里（v1 免费占位）。
 * 接 Stripe 后免费入口删除，履约核心抽到这里，由真实付款的 webhook 触发。
 */

import { eq, sql } from "drizzle-orm";
import type { db } from "@/lib/db/client";
import { currencyTransactions, users } from "@/lib/db/schema";
import {
  MEMBERSHIP_DURATION_DAYS,
  type MembershipTier,
  TIER_SPECS,
} from "./constants";

/** db.transaction 回调拿到的事务句柄类型。 */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * 给用户开通 / 续费一档月卡（在调用方提供的事务内执行）。
 *
 * 行为（与原 subscribeToTier 一致）：
 *   1. 延长 membership：同档未过期 → 在原 expiresAt 上叠加 30 天；
 *      跨档或已过期 → 从今天起算 30 天。
 *   2. 一次性发放 instantGold（金币，对齐同类平台的一次性代币）到 gold_balance，
 *      并写一条 recharge 流水（让现有账本 / admin ledger UI 不变）。
 *
 * @param tx      调用方的 db.transaction 句柄（webhook 履约时与订单状态更新同事务，
 *                保证「发货」与「订单翻 paid」要么都成要么都回滚）。
 * @param userId  目标用户。
 * @param tier    月卡档位。
 * @param opts.source    来源标记，进流水 note，便于审计（'stripe' / 'admin'）。
 * @param opts.operatorId admin 手动开通时填操作员 ID（进 recharge 行的 operator_id）。
 * @returns 新的到期时间。
 */
export async function grantMembership(
  tx: DbTx,
  userId: string,
  tier: MembershipTier,
  opts: { source: "stripe" | "payproo" | "admin"; operatorId?: string },
): Promise<Date> {
  const spec = TIER_SPECS[tier];
  if (!spec) throw new Error(`未知会员等级: ${tier}`);

  const durationMs = MEMBERSHIP_DURATION_DAYS * 24 * 60 * 60 * 1000;

  const [user] = await tx
    .select({
      goldBalance: users.goldBalance,
      membershipTier: users.membershipTier,
      membershipExpiresAt: users.membershipExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");

  if (!user) throw new Error(`User not found: ${userId}`);

  // 同档续费叠加，跨档 / 已过期一律从今天起算。
  const now = Date.now();
  const base =
    user.membershipTier === tier &&
    user.membershipExpiresAt &&
    user.membershipExpiresAt.getTime() > now
      ? user.membershipExpiresAt.getTime()
      : now;
  const nextExpiry = new Date(base + durationMs);

  await tx
    .update(users)
    .set({
      membershipTier: tier,
      membershipExpiresAt: nextExpiry,
      goldBalance: sql`${users.goldBalance} + ${spec.benefits.instantGold}`,
    })
    .where(eq(users.id, userId));

  if (spec.benefits.instantGold > 0) {
    const sourceNote =
      opts.source === "stripe"
        ? "Stripe 支付"
        : opts.source === "payproo"
          ? "PayProo 支付"
          : "管理员开通";
    await tx.insert(currencyTransactions).values({
      userId,
      transactionType: "recharge",
      currencyType: "gold",
      amount: spec.benefits.instantGold,
      balanceAfter: user.goldBalance + spec.benefits.instantGold,
      operatorId: opts.operatorId ?? null,
      note: `开通${tierDisplayName(tier)}月卡（${sourceNote}）`,
    });
  }

  return nextExpiry;
}

/**
 * 会员档中文展示名。注意内部键名与展示名是反的：platinum 展示为「钻石会员」、
 * diamond 展示为「铂金会员」（历史原因，见 membership/constants.ts 注释）。
 */
export function tierDisplayName(tier: MembershipTier): string {
  if (tier === "gold") return "黄金会员";
  if (tier === "platinum") return "钻石会员";
  return "铂金会员";
}
