-- 去掉 username 唯一约束 —— username 仅作展示名，允许重复。
--
-- 背景: users.username 原本有 unique index(users_username_uidx)。但登录只用
-- email(见 signin route + signInWithPassword)，username 不是登录凭证、也无
-- @handle 个人主页路由 —— 它纯粹是展示名。强制唯一会导致：新用户填了已被占用
-- 的 username 时，auth.users 先建成功、再被 handle_new_user 触发器的 INSERT 撞
-- 唯一约束抛 "Database error saving new user"(500)，事务回滚，用户只看到笼统
-- 注册失败且无法重试(auth 端已存在 → 422)。
--
-- 改为普通(非唯一)索引：保留按 username 查询的性能，但不再阻止重复。注册不再
-- 因撞名失败。email 仍唯一(users_email_uidx)保证登录身份唯一。
--
-- 幂等: IF EXISTS / IF NOT EXISTS。

DROP INDEX IF EXISTS "users_username_uidx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");
