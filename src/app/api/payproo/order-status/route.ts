import { and, eq } from "drizzle-orm";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { db } from "@/lib/db/client";
import { paymentOrders } from "@/lib/db/schema";

export async function GET(req: Request): Promise<Response> {
  const userId = await getOptionalUserId();
  if (!userId) return Response.json({ error: "未登录" }, { status: 401 });

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId)
    return Response.json({ error: "缺少 order_id" }, { status: 400 });

  const [order] = await db
    .select({ status: paymentOrders.status, tier: paymentOrders.tier })
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.merchantOrderId, orderId),
        eq(paymentOrders.userId, userId),
      ),
    )
    .limit(1);

  return Response.json(order ?? { status: "unknown" });
}
