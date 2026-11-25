/**
 * 每日银币领取 —— 唯一保留的"旧 currency 模块"入口。
 *
 * 历史背景：仓库里曾经有两套并行的货币系统，分别走 `users.gold_coins/
 * silver_coins`（这里）和 `users.gold_balance/silver_balance`（lib/billing/
 * currency.ts）。聊天 / 美化包 / 图片生成都走 `*_balance`，所以本文件里早期
 * 实现的 deduct / recharge 等都是死代码。0028 migration 已把 *_coins 列删
 * 掉、把每日签到改为对 *_balance 操作；这个文件就只剩下签到逻辑。
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currencyTransactions, users } from "@/lib/db/schema";
import {
  FREE_DAILY_SILVER,
  type MembershipTier,
  TIER_SPECS,
} from "@/lib/membership/constants";

export interface DailyClaimResult {
  success: boolean;
  claimed: boolean;
  amount: number;
  newBalance: number;
  message: string;
}

/**
 * 获取当前日期字符串（东八区 UTC+8）
 *
 * 使用东八区而非 UTC 是因为：
 * 1. 主要用户在中国/亚洲
 * 2. 避免 UTC 跨日导致用户在本地时间同一天内可以签到两次
 * 3. 例如：北京时间 08/03 00:30 对应 UTC 08/02 16:30，如果用 UTC 判断，
 *    用户在 08/03 凌晨和下午都能签到（UTC 上是两天）
 */
function todayString(): string {
  const now = new Date();
  // 将 UTC 时间转换到东八区（直接加 8 小时）
  const utc8Time = new Date(now.getTime() + 8 * 60 * 60000);
  return utc8Time.toISOString().split("T")[0];
}

/**
 * 每日登录领取银币 —— 每天最多领取一次，按 UTC 0 点切日。
 * 金额根据会员等级区分（对齐同类平台的日常代币机制）：
 *   - 普通用户：20 银币/天
 *   - 黄金会员：90 银币/天
 *   - 钻石会员（platinum）：30 银币/天
 *   - 铂金会员（diamond）：30 银币/天
 * 注意：金额加到 `silver_balance`（聊天扣费用的那个余额），同时往
 * `currency_transactions` 流水表写一条 daily_claim 记录。
 */
export async function claimDailySilver(
  userId: string,
): Promise<DailyClaimResult> {
  const today = todayString();

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: users.id,
        silverBalance: users.silverBalance,
        lastDailyClaimDate: users.lastDailyClaimDate,
        membershipTier: users.membershipTier,
        membershipExpiresAt: users.membershipExpiresAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");

    if (!user) {
      return {
        success: false,
        claimed: false,
        amount: 0,
        newBalance: 0,
        message: "用户不存在",
      };
    }

    if (user.lastDailyClaimDate === today) {
      return {
        success: true,
        claimed: false,
        amount: 0,
        newBalance: user.silverBalance,
        message: "今天已经领取过了，明天再来吧",
      };
    }

    // 根据会员等级计算每日银币金额
    let dailyAmount = FREE_DAILY_SILVER;
    if (
      user.membershipTier &&
      user.membershipExpiresAt &&
      user.membershipExpiresAt.getTime() > Date.now()
    ) {
      const tierSpec = TIER_SPECS[user.membershipTier as MembershipTier];
      if (tierSpec) {
        dailyAmount = tierSpec.benefits.dailySilver;
      }
    }

    const newBalance = user.silverBalance + dailyAmount;

    await tx
      .update(users)
      .set({
        silverBalance: newBalance,
        lastDailyClaimDate: today,
      })
      .where(eq(users.id, userId));

    await tx.insert(currencyTransactions).values({
      userId,
      transactionType: "daily_claim",
      currencyType: "silver",
      amount: dailyAmount,
      balanceAfter: newBalance,
      note: "每日登录",
    });

    return {
      success: true,
      claimed: true,
      amount: dailyAmount,
      newBalance,
      message: `成功领取 ${dailyAmount} 银币`,
    };
  });
}

/** 给 UI（"今日已领取"灰按钮）判断今天能不能领。 */
export async function canClaimDailyToday(userId: string): Promise<{
  canClaim: boolean;
  lastClaimDate: string | null;
}> {
  const [user] = await db
    .select({ lastDailyClaimDate: users.lastDailyClaimDate })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { canClaim: false, lastClaimDate: null };
  const today = todayString();
  return {
    canClaim: user.lastDailyClaimDate !== today,
    lastClaimDate: user.lastDailyClaimDate,
  };
}
