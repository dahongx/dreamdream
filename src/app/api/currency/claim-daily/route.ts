/**
 * POST /api/currency/claim-daily
 *
 * 每日登录领取银币
 */

import { getCurrentUserId } from "@/lib/auth/current-user";
import { claimDailySilver } from "@/lib/currency/transactions";

export async function POST() {
  const userId = await getCurrentUserId();

  const result = await claimDailySilver(userId);

  if (!result.success) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  return Response.json({
    claimed: result.claimed,
    amount: result.amount,
    newBalance: result.newBalance,
    message: result.message,
  });
}
