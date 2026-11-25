-- 账号注销（硬删除）的三处 schema 前置。
--
-- 设计见 docs/exec-plans/completed/account-deletion.md。
--
-- 注销动作本身几乎不需要 schema 支持：drizzle/0011 给 public.users.id 加的
-- `REFERENCES auth.users(id) ON DELETE CASCADE`，配合 20+ 张业务表挂在
-- public.users 上的 CASCADE，让 `auth.admin.deleteUser()` 一句就能在同一个
-- 事务里把该用户的一切带走。本迁移只处理级联「删过头」和「删不干净」的三处：
--
--   1. chat_sessions.character_id —— 创作者注销会删掉他的角色卡，而 chat_sessions
--      经 character_id CASCADE 会把**其他用户**跟这些卡的对话记录一起删掉。
--      别人的聊天记录不是注销者的数据，不能连坐。改为可空 + SET NULL：
--      会话变「孤儿」，数据完整保留，UI 里标灰不可点。
--
--   2. payment_orders.user_id —— 隐私政策 8.2 写明「交易与对账记录按适用税法
--      要求保留」，日本帐簿书类另有保存义务。人删了，金额 / stripe_session_id /
--      时间必须留着能对账。改为可空 + SET NULL（脱钩保留）。
--
--   3. deactivated_email_hashes —— 新表。users 的列默认值给新账号发
--      100 金 / 200 银，注销→重注册可以无限刷。存一份加 pepper 的邮箱 HMAC
--      用来挡这一下。
--
-- ⚠️ 原始外键是在 0000_initial / 0033 里**内联无名**定义的（`uuid NOT NULL
-- REFERENCES ...`），实际约束名由 Postgres 自动生成（<table>_<column>_fkey），
-- 而不是 drizzle snapshot 里记的 <table>_<column>_<ref>_<refcol>_fk。所以这里
-- 不写死名字，从 pg_constraint 按 (表, 列, 被引用表) 反查后再 DROP，重建时补上
-- 显式名字，之后的迁移就能直接引用了。

-- 1) chat_sessions.character_id：NOT NULL → 可空，CASCADE → SET NULL
ALTER TABLE "chat_sessions" ALTER COLUMN "character_id" DROP NOT NULL;
--> statement-breakpoint

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.chat_sessions'::regclass
    AND c.confrelid = 'public.characters'::regclass
    AND c.contype = 'f'
    AND a.attname = 'character_id'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.chat_sessions DROP CONSTRAINT %I', con_name);
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "chat_sessions"
  ADD CONSTRAINT "chat_sessions_character_id_characters_id_fk"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- chat_sessions_user_char_current_uidx 是 (user_id, character_id) 上的 partial
-- unique。Postgres 的 unique 语义把多个 NULL 视作互不相等，所以孤儿会话之间
-- 不会互相冲突，「每 (user, character) 至多一条当前临时对话」的约束对活着的
-- 角色仍然成立。索引无需改动。

-- 2) payment_orders.user_id：NOT NULL → 可空，CASCADE → SET NULL
ALTER TABLE "payment_orders" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.payment_orders'::regclass
    AND c.confrelid = 'public.users'::regclass
    AND c.contype = 'f'
    AND a.attname = 'user_id'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payment_orders DROP CONSTRAINT %I', con_name);
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "payment_orders"
  ADD CONSTRAINT "payment_orders_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- 3) 已注销邮箱哈希。
--
-- 刻意只有两列、不含 user_id、不与任何内容表关联 —— 账号注销是硬删除，这张表
-- 是全库唯一残留物；一旦它能指回任何内容行，「注销即删干净」就不成立。
-- 值是 HMAC-SHA256(pepper, lower(trim(email)))，pepper 走服务端 env
-- ACCOUNT_DELETION_EMAIL_PEPPER —— 邮箱空间小到可以字典枚举，裸 SHA256 等于明文。
CREATE TABLE IF NOT EXISTS "deactivated_email_hashes" (
  "email_hash" text PRIMARY KEY,
  "deactivated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- CLAUDE.md 铁律：新建表必须在同一迁移里开 RLS。0035 的动态循环只覆盖它运行时
-- 已存在的表，管不到之后新增的。零 policy = 全拒绝，符合本仓库「PostgREST 数据
-- 通路根本不用」的安全模型。
ALTER TABLE "deactivated_email_hashes" ENABLE ROW LEVEL SECURITY;
