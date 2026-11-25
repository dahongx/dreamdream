-- 给 public schema 下所有表统一开启 RLS（零策略 = 对 PostgREST 全拒绝）。
--
-- 背景：Supabase linter 报 "RLS Disabled in Public"（首先点名 verification_tokens，
-- 但同一问题对所有 public 表都成立）。这些表暴露给 PostgREST，没开 RLS 意味着
-- anon / authenticated 角色理论上能拿公开的 anon key 直连读写。
--
-- 本仓库的访问事实（已核查全库）：
--   · 数据访问 100% 走 Drizzle（服务端），用 DATABASE_URL 超级用户直连；
--   · Supabase JS 仅用于 Auth API（登录/注册/登出/改密），从不碰 PostgREST 数据表；
--   · 浏览器端 supabase client 零 import，无 .from() / .rpc() / realtime 订阅。
--   → 即：PostgREST 这条通路应用根本不用，是「敞着但用不到的门」。
--
-- 安全模型（延续 0011_supabase_auth_bridge）：
--   后端超级用户天然绕过 RLS，服务端读写完全不受影响；
--   开 RLS 但不建任何 policy = 对 anon / authenticated 全拒绝，正是 linter 想要的。
--   不加 FORCE：表 owner 仍可绕过，本迁移无需 owner 直连。
--
-- 采用动态循环而非硬编码表名：覆盖此刻 public 下的全部基础表（29 张业务表 +
-- 迁移账本 __nimir_migrations），不会抄漏。注意：本迁移之后（0036+）新增的表
-- 需在各自迁移里自行 ENABLE RLS —— 循环只作用于运行时已存在的表。
--
-- 不可逆性：仅收紧访问，不动数据 / 结构，安全；ALTER ... ENABLE RLS 幂等，可重跑。

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
