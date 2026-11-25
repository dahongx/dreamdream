import { eq } from "drizzle-orm";
import { rechargeGold } from "@/lib/currency/recharge-gold";
import { db } from "@/lib/db/client";
import { paymentOrders } from "@/lib/db/schema";
import { grantMembership } from "@/lib/membership/grant";
import { getPayProoConfig, verifyPayload } from "@/lib/payproo/client";

interface PayProoNotification {
  appId: number;
  currency: string;
  orderId: string;
  orderNo: string;
  amount: string;
  fee: string;
  status: number;
  payTime: string;
  errorMsg: string;
  payModel: string;
  sign: string;
}

export async function POST(req: Request): Promise<Response> {
  let payload: PayProoNotification;
  try {
    payload = (await req.json()) as PayProoNotification;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!payload.sign) return new Response("missing sign", { status: 400 });

  try {
    const config = getPayProoConfig();
    const { sign, ...unsigned } = payload;
    if (!verifyPayload(unsigned, sign, config)) {
      return new Response("invalid sign", { status: 400 });
    }
    if (
      payload.appId !== config.appId ||
      payload.currency !== config.currency
    ) {
      return new Response("invalid order context", { status: 400 });
    }

    await fulfillPayProoOrder(payload);
    return new Response("SUCCESS", { status: 200 });
  } catch (error) {
    console.error("[payproo webhook] 履约失败", error);
    return new Response("retry", { status: 500 });
  }
}

async function fulfillPayProoOrder(
  notification: PayProoNotification,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.merchantOrderId, notification.orderId))
      .for("update");

    if (!order || order.provider !== "payproo") {
      console.warn("[payproo webhook] 找不到订单，跳过", notification.orderId);
      return;
    }
    if (order.status === "paid") return;

    if (order.userId === null) {
      console.error("[payproo webhook] 用户已注销，订单未发货，需人工退款", {
        orderId: order.id,
        merchantOrderId: notification.orderId,
      });
      await tx
        .update(paymentOrders)
        .set({
          payprooOrderNo: notification.orderNo,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));
      return;
    }

    const notifiedAmount = Number(notification.amount);
    if (
      !Number.isFinite(notifiedAmount) ||
      Math.round(notifiedAmount * 100) !== order.amountTotal ||
      order.currency?.toLowerCase() !== notification.currency.toLowerCase() ||
      (order.payprooOrderNo !== null &&
        order.payprooOrderNo !== notification.orderNo)
    ) {
      throw new Error("PayProo 回调订单字段不匹配");
    }

    if (notification.status === 3) {
      await tx
        .update(paymentOrders)
        .set({
          status: "failed",
          payprooOrderNo: notification.orderNo,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));
      return;
    }
    if (notification.status !== 2) {
      return;
    }

    if (order.tier) {
      await grantMembership(tx, order.userId, order.tier, {
        source: "payproo",
      });
    } else if (order.goldAmount && order.goldAmount > 0) {
      await rechargeGold(tx, order.userId, order.goldAmount, {
        source: "payproo",
        packageId: order.packageId ?? undefined,
      });
    } else {
      throw new Error("PayProo 金币订单缺少金币数量");
    }

    await tx
      .update(paymentOrders)
      .set({
        status: "paid",
        payprooOrderNo: notification.orderNo,
        amountTotal: Math.round(Number(notification.amount) * 100),
        currency: notification.currency.toLowerCase(),
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
  });
}
