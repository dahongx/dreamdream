-- 官方系统用户预置 —— 消除 pack seed 违反 auth.users 外键的 WARN。
--
-- 背景: seedOfficialPack(src/lib/packs/official.ts) 向 public.users 插入系统用户
-- (id 00000000-...-0001) 作为官方美化包 owner。但 0011 给 public.users.id 加了
-- `REFERENCES auth.users(id)` 外键，而该系统用户从不经注册流程进 auth.users →
-- 插入失败，启动日志 WARN「failed to seed official pack」。
--
-- 解法: 在 auth.users 预置一行系统用户(固定 id ...0001)。它不是真实可登录账号
-- (encrypted_password 为空 → 密码登录永远失败；不发确认邮件)，仅用于让 public.users
-- 镜像行的外键成立。seedOfficialPack 的 onConflictDoNothing 之后即可正常 upsert。
--
-- 幂等: ON CONFLICT DO NOTHING，重复迁移无副作用。auth.users 由 gotrue 容器建表,
-- 本迁移由 db-migrate runner 在 gotrue healthy 之后执行(compose depends_on 保证)。

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'system@yearn.local',
  '',                              -- 空哈希 → 不可密码登录
  now(),                           -- 标记已确认,避免任何确认流程触碰
  now(),
  now(),
  '{"provider":"system","providers":["system"]}'::jsonb,
  '{"username":"system","display_name":"Dearm","name":"system"}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;
