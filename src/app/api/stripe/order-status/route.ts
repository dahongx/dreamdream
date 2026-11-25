/**
 * GET /api/stripe/order-status?session_id=cs_...
 *
 * 供 /shop 支付成功页轮询用 —— webhook 履约是异步的，用户跳回来的瞬间订单
 * 可能还是 pending，前端轮这个端点直到 paid 再 router.refresh() 展示新会员。
 *
 * 只允许查自己的订单（userId 双重过滤），防止枚举他人 session。
 */

import { and, eq } from "drizzle-orm";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { db } from "@/lib/db/client";
import { paymentOrders } from "@/lib/db/schema";

export async function GET(req: Request): Promise<Response> {
  const userId = await getOptionalUserId();
  if (!userId) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) {
    return Response.json({ error: "缺少 session_id" }, { status: 400 });
  }

  const [order] = await db
    .select({ status: paymentOrders.status, tier: paymentOrders.tier })
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.stripeSessionId, sessionId),
        eq(paymentOrders.userId, userId),
      ),
    )
    .limit(1);

  if (!order) {
    return Response.json({ status: "unknown" });
  }

  return Response.json({ status: order.status, tier: order.tier });
}
