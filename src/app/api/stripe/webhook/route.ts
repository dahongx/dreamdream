/**
 * POST /api/stripe/webhook
 *
 * Stripe 事件回调 —— **真实付款履约的唯一可信信号**。支付宝/微信是异步重定向型，
 * 前端跳回 /shop?pay=success 只用于即时反馈，真正发月卡 + 银两在这里落库。
 *
 * 安全：用 raw body + stripe-signature 验签（不能用 req.json()，会破坏验签）。
 * 幂等：fulfillOrder 在事务里 `FOR UPDATE` 选 payment_orders 行，已 paid 直接
 * no-op —— Stripe 会重投/重放事件，绝不重复发货。
 *
 * 返回码语义：验签失败 → 400；履约抛错 → 500（让 Stripe 自动重试）；正常 → 200。
 *
 * ⚠️ webpack HMR 对 route handler 响应构造改动不可靠，改完先重启 dev 再测
 * （见 [[feedback_route_handler_response_change_needs_restart]]）。
 */

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { rechargeGold } from "@/lib/currency/recharge-gold";
import { db } from "@/lib/db/client";
import { paymentOrders } from "@/lib/db/schema";
import { grantMembership } from "@/lib/membership/grant";
import { getStripe } from "@/lib/stripe/client";

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("STRIPE_WEBHOOK_SECRET 未配置", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("缺少 stripe-signature", { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`签名校验失败: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        // 异步支付方式在 completed 时可能仍 unpaid（等用户在支付宝/微信侧确认），
        // 只有 payment_status==='paid' 才发货，其余等 async_payment_succeeded。
        if (session.payment_status === "paid") {
          await fulfillOrder(session);
        }
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrder(session.id, "failed");
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markOrder(session.id, "expired");
        break;
      }
      default:
        // 其它事件忽略 —— 仍回 200，避免 Stripe 反复重投。
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] 履约失败", event.type, err);
    return new Response("履约失败", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

/**
 * 幂等履约：在一个事务里翻订单状态 + 发月卡/金币，要么全成要么全回滚。
 * 找不到订单行（非本系统建的 session）→ 记日志后 no-op（仍回 200）。
 *
 * 支持两种订单类型：
 *   1. 月卡订单（order.tier 不为 null）→ 调用 grantMembership
 *   2. 金币包订单（session.metadata.packageId 存在）→ 调用 rechargeGold
 */
async function fulfillOrder(session: Stripe.Checkout.Session): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.stripeSessionId, session.id))
      .for("update");

    if (!order) {
      console.warn("[stripe webhook] 找不到订单，跳过", session.id);
      return;
    }
    if (order.status === "paid") {
      // 已履约 —— 重投/重放，幂等 no-op。
      return;
    }

    // 用户在「建单」到「履约」之间注销了账号。migration 0042 把
    // payment_orders.user_id 改成了 SET NULL（订单要留着报税对账），所以这里
    // 会拿到一个没有主人的订单。
    //
    // 三件事都不能做错：
    //   1. 不能 throw —— 抛错会让 webhook 返 500，Stripe 一直重投，这单永远
    //      卡在重试队列里。
    //   2. 不能发货 —— 没有 user 可发，grantMembership / rechargeGold 都要 userId。
    //   3. 不能标 paid/failed —— 钱在 Stripe 那边是真收了（不是 failed），但
    //      我们什么都没交付（不是 paid）。状态留在 pending 才是事实。
    // 能做的是把金额与 PaymentIntent 补进去，让人工退款有据可依，然后大声记日志。
    if (order.userId === null) {
      const orphanIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      await tx
        .update(paymentOrders)
        .set({
          stripePaymentIntentId: orphanIntentId,
          amountTotal: session.amount_total ?? order.amountTotal,
          currency: session.currency ?? order.currency,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));
      console.error(
        "[stripe webhook] 订单已收款但用户已注销，未发货，需人工退款",
        { orderId: order.id, stripeSessionId: session.id, orphanIntentId },
      );
      return;
    }

    // 判断订单类型并履约
    if (order.tier) {
      // 月卡订单
      await grantMembership(tx, order.userId, order.tier, { source: "stripe" });
    } else if (session.metadata?.packageId && session.metadata?.gold) {
      // 金币包订单
      const gold = parseInt(session.metadata.gold, 10);
      if (!Number.isNaN(gold) && gold > 0) {
        await rechargeGold(tx, order.userId, gold, {
          source: "stripe",
          packageId: session.metadata.packageId,
        });
      } else {
        console.error(
          "[stripe webhook] 金币包订单金币数量无效",
          session.metadata,
        );
        throw new Error("金币包订单金币数量无效");
      }
    } else {
      console.error("[stripe webhook] 无法识别的订单类型", session.metadata);
      throw new Error("无法识别的订单类型");
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    await tx
      .update(paymentOrders)
      .set({
        status: "paid",
        fulfilledAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
        amountTotal: session.amount_total ?? order.amountTotal,
        currency: session.currency ?? order.currency,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
  });
}

/** pending → failed/expired（不覆盖已 paid 的订单）。 */
async function markOrder(
  sessionId: string,
  status: "failed" | "expired",
): Promise<void> {
  await db
    .update(paymentOrders)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(paymentOrders.stripeSessionId, sessionId),
        eq(paymentOrders.status, "pending"),
      ),
    );
}
