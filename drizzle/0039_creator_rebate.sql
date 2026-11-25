-- 创作者返利系统 —— 独立「创作收益」余额 + 每日结算记录 + 防刷游标。
--
-- 背景：对标同类平台的「创作推广收益」。用户跟角色对话消耗金币、点赞、收藏、
-- 关注作者，都按规则返利给作者。每天早 8 点（Asia/Shanghai）遍历所有角色
-- 结算一次，形成 creator_earning_records 记录 + 累加到 users.creator_earnings。
--
-- 四块新增，全部非破坏性（见 [[feedback_no_cascading_deletes_in_migration]]）：
--
-- 1. users.creator_earnings —— 独立收益余额。numeric(14,2) 支持小数（返利
--    单位可到 0.6 / 8.6），刻意不动整数的 gold_balance，两套余额互不污染。
--
-- 2. creator_earning_records —— 收益详情 tab 的数据源。一条 = 某角色某天的
--    一笔进账（对话/点赞/收藏），或账号级的粉丝返利（character_id = NULL、
--    kind = 'fans'）。
--
-- 3. creator_character_cursors —— 按角色的防刷 / 幂等游标（对话金币 / 点赞 /
--    收藏三个维度）。每次结算只对「当前累计 − 游标快照」的正增量返利，再把
--    快照推进。点赞/收藏用「高水位」棘轮：取消再点不会重复发钱。
--    ⚠️ 首次上线前须先跑 seed（把游标设成当前值、不发钱），否则第一次结算会
--    把全部历史点赞/收藏/金币消耗一次性补发。见 scripts/run-daily-rebate.ts --seed。
--
-- 4. creator_fans_cursors —— 粉丝返利游标，按作者（账号级，不属于任何角色）。

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "creator_earnings" numeric(14, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "creator_earning_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- 收益归属的作者
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- 关联角色。粉丝返利（账号级）为 NULL。角色被删则记录也删。
  "character_id" uuid REFERENCES "characters"("id") ON DELETE CASCADE,
  -- 返利种类：dialogue（对话金币消耗）/ like（点赞）/ favorite（收藏）/ fans（粉丝）
  "kind" text NOT NULL,
  -- 本次进账金额（正数，numeric 支持小数）
  "amount" numeric(12, 2) NOT NULL,
  -- 计算明细快照（如 { goldConsumed, units } / { likeDelta }），便于审计追溯
  "detail" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "creator_earning_records_kind_check" CHECK ("kind" IN ('dialogue', 'like', 'favorite', 'fans'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creator_earning_records_user_created_idx" ON "creator_earning_records" ("user_id", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "creator_earning_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "creator_character_cursors" (
  -- 每角色一行
  "character_id" uuid PRIMARY KEY REFERENCES "characters"("id") ON DELETE CASCADE,
  -- 上次结算时：该角色被消耗的「金币」累计快照（对话返利用。含续写；不含
  -- 美化包/图片这类无 session 的扣费）。带 3 金币一档的余数结转，故按已发档
  -- 位推进而非直接对齐当前值。
  "last_gold_consumed" integer DEFAULT 0 NOT NULL,
  -- 上次结算时：该角色被点赞的累计条数快照（高水位棘轮）
  "likes_settled" integer DEFAULT 0 NOT NULL,
  -- 上次结算时：该角色被收藏的累计条数快照（高水位棘轮）
  "favorites_settled" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_character_cursors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "creator_fans_cursors" (
  -- 每作者一行
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  -- 上次结算时：该作者的粉丝累计数快照（高水位棘轮）
  "fans_settled" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_fans_cursors" ENABLE ROW LEVEL SECURITY;
