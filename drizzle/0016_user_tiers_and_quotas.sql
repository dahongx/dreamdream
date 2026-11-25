-- 用户分级 + 配额 + 邀请码体系。
--
-- 两级用户：regular(默认) / beta_tester(内测体验官)。
-- regular 每日 10 轮 AI 对话(含生图),beta_tester 500 轮。
-- 邀请码由 admin 生成,用户兑换后升级为 beta_tester。
--
-- 新列均有 DEFAULT,handle_new_user() trigger 无需改动。

-- 1) users 表新增分级与配额字段
ALTER TABLE "users" ADD COLUMN "role" text NOT NULL DEFAULT 'regular';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_usage_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "usage_date" date NOT NULL DEFAULT CURRENT_DATE;
--> statement-breakpoint

-- 2) 邀请码表
CREATE TABLE "invite_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(32) NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "max_uses" integer NOT NULL DEFAULT 1,
  "used_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invite_codes_code_uidx" ON "invite_codes"("code");
--> statement-breakpoint

-- 3) 邀请码兑换记录(审计日志 + 防重复兑换)
CREATE TABLE "invite_code_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code_id" uuid NOT NULL REFERENCES "invite_codes"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "redeemed_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invite_code_redemptions_user_code_uidx" ON "invite_code_redemptions"("user_id", "code_id");
