-- PayProo 支付通道接入。
--
-- payment_orders 原本只保存 Stripe Checkout Session。PayProo 使用商户订单号
-- 作为请求/通知/查询的稳定关联键，因此扩展为渠道无关的订单模型。
-- 所有现有 Stripe 订单保留原字段；新增字段可为空以兼容历史订单。

ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS "merchant_order_id" text,
  ADD COLUMN IF NOT EXISTS "payproo_order_no" text,
  ADD COLUMN IF NOT EXISTS "package_id" text,
  ADD COLUMN IF NOT EXISTS "gold_amount" integer;
--> statement-breakpoint
ALTER TABLE "payment_orders"
  ALTER COLUMN "stripe_session_id" DROP NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_merchant_order_uidx"
  ON "payment_orders" ("merchant_order_id");
--> statement-breakpoint
ALTER TABLE "payment_orders" ENABLE ROW LEVEL SECURITY;
