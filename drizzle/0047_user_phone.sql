-- 台湾 PayProo 收单要求支付用户手机号；资料字段可选，只有台湾付款前强制校验。
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(32);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
