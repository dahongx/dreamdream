-- Stripe 支付订单表 —— 真实付款的「钱」侧记录
--
-- 与 currency_transactions（余额变动账本）分工：payment_orders 记一次支付的
-- 完整生命周期（建单 → 履约），并作为 webhook 履约的幂等锚点。
--
-- 幂等：stripe_session_id UNIQUE。Stripe webhook 可能重投/重放，fulfillOrder
-- 在事务里 `SELECT ... FOR UPDATE` 这行，已 paid 直接 no-op，绝不重复发月卡。
--
-- 只接一次性买断月卡（Checkout mode:payment）—— 支付宝/微信不支持订阅，
-- 故没有续费订阅 ID 字段。
--
-- 非破坏性：纯新增表，不动既有列（见 [[feedback_no_cascading_deletes_in_migration]]）。

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tier" text NOT NULL,
  "stripe_session_id" text NOT NULL,
  "stripe_payment_intent_id" text,
  "amount_total" integer,
  "currency" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "fulfilled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_session_uidx" ON "payment_orders" ("stripe_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_orders_user_created_idx" ON "payment_orders" ("user_id", "created_at" DESC);
