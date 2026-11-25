"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getRequestI18n } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { paymentOrders, users } from "@/lib/db/schema";
import { type MembershipTier, TIER_SPECS } from "@/lib/membership/constants";
import { GOLD_PACKAGES } from "@/lib/shop/direct-purchase-constants";
import {
  goldCheckoutProduct,
  membershipCheckoutProduct,
} from "@/lib/stripe/checkout-i18n";
import { getPayProoConfig, postPayProo, verifyPayload } from "./client";

interface ApplyResponse {
  code?: string;
  status: string;
  error: string;
  msg: string;
  data: {
    orderId: string;
    orderNo: string;
    payUrl: string;
    qrCode: string | null;
    sign: string;
  } | null;
}

function makeMerchantOrderId(): string {
  return `dearm${randomUUID().replaceAll("-", "")}`;
}

function appUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) throw new Error("NEXT_PUBLIC_APP_URL 未配置");
  return value.replace(/\/+$/, "");
}

function payModel(region: "hk" | "tw"): string {
  const value = (
    process.env.PAYPROO_PAY_MODEL?.trim() || "ALIPAY"
  ).toUpperCase();
  const allowed =
    region === "tw"
      ? ["BANKTRANSFER", "OTC_STORE", "JKOPAY", "CREDIT_CARD", "APPLEPAY"]
      : ["WECHAT", "ALIPAY", "OCTOPUS"];
  if (!allowed.includes(value)) {
    throw new Error(
      `PAYPROO_PAY_MODEL 不适用于 ${region}: ${allowed.join("、")}`,
    );
  }
  return value;
}

function payType(region: "hk" | "tw"): string {
  const value = (
    process.env.PAYPROO_PAY_TYPE?.trim() ||
    (region === "tw" ? "CARD" : "EWALLET")
  ).toUpperCase();
  const allowed =
    region === "tw" ? ["VA", "OTC", "EWALLET", "CARD"] : ["EWALLET"];
  if (!allowed.includes(value)) {
    throw new Error(`PAYPROO_PAY_TYPE 不适用于 ${region}`);
  }
  return value;
}

function assertSignedApplyResponse(
  response: ApplyResponse,
  config: ReturnType<typeof getPayProoConfig>,
  merchantOrderId: string,
): NonNullable<ApplyResponse["data"]> {
  if (!response.data || response.status !== "1" || response.code === "0") {
    throw new Error(response.msg || `PayProo 下单失败: ${response.error}`);
  }
  const { sign, ...data } = response.data;
  if (!sign || !verifyPayload(data, sign, config)) {
    throw new Error("PayProo 下单响应签名校验失败");
  }
  if (data.orderId !== merchantOrderId) {
    throw new Error("PayProo 下单响应订单号不匹配");
  }
  return response.data;
}

async function createPayProoOrder(input: {
  tier: MembershipTier | null;
  packageId: string | null;
  gold: number | null;
  amount: number;
  subject: string;
  body: string;
}): Promise<{ url: string }> {
  const userId = await getCurrentUserId();
  const config = getPayProoConfig();
  const merchantOrderId = makeMerchantOrderId();

  const [user] = await db
    .select({ email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db.insert(paymentOrders).values({
    provider: "payproo",
    merchantOrderId,
    userId,
    tier: input.tier,
    packageId: input.packageId,
    goldAmount: input.gold,
    amountTotal: Math.round(input.amount * 100),
    currency: config.currency.toLowerCase(),
    status: "pending",
  });

  try {
    if (config.region === "tw" && (!user?.email || !user.phone)) {
      throw new Error("台湾 PayProo 支付需要先在设置中填写邮箱和手机号");
    }
    const selectedPayType = payType(config.region);
    const selectedPayModel = payModel(config.region);
    const payload: Record<string, string | number | undefined> = {
      appId: config.appId,
      orderId: merchantOrderId,
      name: `user${userId.replaceAll("-", "")}`,
      phone: user?.phone ?? undefined,
      email: user?.email ?? undefined,
      amount:
        config.region === "tw"
          ? String(Math.round(input.amount))
          : input.amount.toFixed(2),
      payType: selectedPayType,
      payModel: selectedPayModel,
      callBackUrl: `${appUrl()}/shop?pay=success&order_id=${encodeURIComponent(merchantOrderId)}`,
      subject: input.subject,
      body: input.body,
    };
    if (
      config.region === "tw" &&
      selectedPayType === "EWALLET" &&
      selectedPayModel === "JKOPAY"
    ) {
      payload.userId = userId.replaceAll("-", "");
    }
    // 台湾收银台默认繁体中文。PayProo 文档只定义 `en_US` 这一种
    // 非默认语言值，不发送自定义 `zh_TW`，避免收银台拒绝未知枚举。
    const response = await postPayProo<ApplyResponse>(
      config.collectApplyPath,
      payload,
      config,
    );
    const data = assertSignedApplyResponse(response, config, merchantOrderId);

    await db
      .update(paymentOrders)
      .set({ payprooOrderNo: data.orderNo, updatedAt: new Date() })
      .where(eq(paymentOrders.merchantOrderId, merchantOrderId));

    return { url: data.payUrl };
  } catch (error) {
    await db
      .update(paymentOrders)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentOrders.merchantOrderId, merchantOrderId));
    throw error;
  }
}

export async function createPayProoMembershipOrder(
  tier: MembershipTier,
): Promise<{ url: string }> {
  const { dict } = await getRequestI18n();
  const spec = TIER_SPECS[tier];
  if (!spec) throw new Error("未知会员等级");
  const product = membershipCheckoutProduct(tier, dict.shop);
  return createPayProoOrder({
    tier,
    packageId: null,
    gold: null,
    amount: spec.priceHkd,
    subject: product.name,
    body: product.description ?? "",
  });
}

export async function createPayProoGoldOrder(
  packageId: string,
): Promise<{ url: string }> {
  const { locale, dict } = await getRequestI18n();
  const pkg = GOLD_PACKAGES.find((item) => item.id === packageId);
  if (!pkg) throw new Error("未知金币包");
  const product = goldCheckoutProduct(pkg.gold, locale, dict.shop);
  return createPayProoOrder({
    tier: null,
    packageId,
    gold: pkg.gold,
    amount: pkg.priceHkd,
    subject: product.name,
    body: product.description ?? "",
  });
}
