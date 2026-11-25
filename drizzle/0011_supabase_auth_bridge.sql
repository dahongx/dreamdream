-- Supabase Auth 桥接迁移。
--
-- 目标:让 Supabase 的 auth.users 成为「身份源」,业务表 public.users 退化为
-- 它的 1:1 镜像(id 相同)。这样现有 Drizzle 代码与 9 张业务外键(characters.owner_id
-- 等)全部无需改动 —— 它们仍然指向 public.users.id,而该 id 现在等于 auth.users.id。
--
-- 仅适用于「业务库 = Supabase 库」的形态(方案①)。在本地 supabase 全栈上验证。
--
-- 安全:trigger 用 SECURITY DEFINER + `set search_path = ''` 硬化;不信任 metadata
-- 做授权(只取展示用的 username/display_name/name 作初始值)。
-- 注:RLS 暂未在此迁移中开启 —— 后端以 postgres 超级用户直连会绕过 RLS,RLS 仅对
-- 「客户端直连 PostgREST」有意义,作为后续单独迁移补齐(见 docs/research 报告第 5、7 节)。

-- 1) public.users.id 外键引用 auth.users.id —— 删 auth 用户时级联删业务镜像行。
ALTER TABLE "users"
  ADD CONSTRAINT "users_id_auth_users_fk"
  FOREIGN KEY ("id") REFERENCES auth."users"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- 2) 注册(auth.users 插入)时,自动建对应的 public.users 镜像行。
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, username, display_name, name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
