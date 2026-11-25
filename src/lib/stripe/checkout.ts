"use server";

import { eq } from "drizzle-orm";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { paymentOrders, users } from "@/lib/db/schema";
import {
  CURRENCY,
  type MembershipTier,
  TIER_SPECS,
} from "@/lib/membership/constants";
import { GOLD_PACKAGES } from "@/lib/shop/direct-purchase-constants";
import {
  goldCheckoutProduct,
  membershipCheckoutProduct,
  stripeCheckoutLocale,
} from "./checkout-i18n";
import { getStripe } from "./client";

/**
 * 为指定月卡档位建一个 Stripe Checkout Session（一次性买断，mode:payment），
 * 写一行 pending 的 payment_orders，返回托管收银台 URL。前端拿到后跳转。
 *
 * 支付方式：显式启用 卡 / 支付宝 / 微信 —— 大陆用户硬需求。三者均支持一次性
 * 付款；支付宝/微信不支持订阅，故月卡只能买断（见 grant/constants 注释）。
 *
 * 履约不在这里：真正发月卡 + 银两由 webhook（checkout.session.completed）触发，
 * 因为支付宝/微信是异步重定向型，绝不能依赖前端跳回来发货。这里只建单。
 */
export async function createCheckoutSession(
  tier: MembershipTier,
): Promise<{ url: string }> {
  const userId = await getCurrentUserId();
  const { locale, dict } = await getRequestI18n();

  const spec = TIER_SPECS[tier];
  if (!spec) throw new Error("未知会员等级");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL 未配置 —— 无法构造支付回跳地址");
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const stripe = getStripe();
  const product = membershipCheckoutProduct(tier, dict.shop);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: stripeCheckoutLocale(locale),
    // 显式列出以保证支付宝、微信一定出现在收银台（不依赖 Dashboard 动态推断）。
    payment_method_types: ["card", "alipay", "wechat_pay"],
    payment_method_options: {
      // 微信支付在 Web 端 Checkout 必须声明 client。
      wechat_pay: { client: "web" },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          // 最小货币单位（HKD → 仙）。30→3000 / 68→6800 / 128→12800。
          unit_amount: Math.round(spec.priceHkd * 100),
          product_data: product,
        },
      },
    ],
    // 回跳：success 带 session_id 供成功页轮询到账；{CHECKOUT_SESSION_ID} 是
    // Stripe 模板占位符，必须原样保留、不能 URL-encode。
    success_url: `${appUrl}/shop?pay=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/shop?pay=cancel`,
    client_reference_id: userId,
    customer_email: user?.email ?? undefined,
    // webhook 履约靠 metadata 还原是谁买了哪档。
    metadata: { userId, tier },
  });

  if (!session.url) {
    throw new Error("Stripe 未返回 Checkout URL");
  }

  // 建单 pending —— webhook 凭 stripe_session_id 幂等翻 paid。
  await db.insert(paymentOrders).values({
    provider: "stripe",
    userId,
    tier,
    stripeSessionId: session.id,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? CURRENCY,
    status: "pending",
  });

  return { url: session.url };
}

/**
 * 为直购金币包建一个 Stripe Checkout Session（一次性买断，mode:payment）。
 *
 * 流程与月卡类似：
 *   1. 创建 Stripe Checkout Session
 *   2. 写一行 pending 的 payment_orders（金币包类型）
 *   3. 返回托管收银台 URL
 *   4. webhook 履约时发放金币
 */
export async function createGoldPackageCheckoutSession(
  packageId: string,
): Promise<{ url: string }> {
  const userId = await getCurrentUserId();
  const { locale, dict } = await getRequestI18n();

  const pkg = GOLD_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error("未知金币包");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL 未配置 —— 无法构造支付回跳地址");
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const stripe = getStripe();
  const product = goldCheckoutProduct(pkg.gold, locale, dict.shop);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: stripeCheckoutLocale(locale),
    payment_method_types: ["card", "alipay", "wechat_pay"],
    payment_method_options: {
      wechat_pay: { client: "web" },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: Math.round(pkg.priceHkd * 100),
          product_data: product,
        },
      },
    ],
    success_url: `${appUrl}/shop?pay=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/shop?pay=cancel`,
    client_reference_id: userId,
    customer_email: user?.email ?? undefined,
    // webhook 履约靠 metadata 还原是谁买了多少金币
    metadata: { userId, packageId, gold: pkg.gold },
  });

  if (!session.url) {
    throw new Error("Stripe 未返回 Checkout URL");
  }

  // 建单 pending —— 注意：金币包订单没有 tier 字段，用 metadata 区分
  await db.insert(paymentOrders).values({
    provider: "stripe",
    userId,
    tier: null, // 金币包订单不关联会员等级
    packageId,
    goldAmount: pkg.gold,
    stripeSessionId: session.id,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? CURRENCY,
    status: "pending",
  });

  return { url: session.url };
}
