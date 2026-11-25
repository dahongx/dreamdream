-- 收回 public.handle_new_user() 的对外 EXECUTE 权限。
--
-- 背景：Supabase linter 报两条 —— anon 与 authenticated 都能通过
--   /rest/v1/rpc/handle_new_user 调用这个 SECURITY DEFINER 函数。
--   根因是 Postgres `CREATE FUNCTION` 默认把 EXECUTE 授予 PUBLIC，而 Supabase
--   又把 public schema 暴露给 PostgREST，于是这扇门对着公开 anon key 敞着。
--
-- 事实：该函数只作为 on_auth_user_created 触发器（0011_supabase_auth_bridge）
--   在 auth.users 插入时运行。触发器执行不检查调用者的 EXECUTE 授权，因此从
--   PUBLIC / anon / authenticated 收回后，注册链路完全不受影响。
--
-- 安全模型延续 0011 / 0035：数据访问 100% 走 Drizzle 超级用户直连；Supabase JS
--   只碰 Auth API，从不走 PostgREST。故这条 RPC 通路本就用不到，收紧即可。
--
-- 幂等、可重跑；仅收权限、不动数据 / 结构。

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
