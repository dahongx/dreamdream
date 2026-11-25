/**
 * Shared Supabase 连接配置读取。
 *
 * 这是接入 Supabase Auth 的「可逆地基」之一 —— 目前还没有任何代码 import
 * 这些 client,Auth.js 仍是唯一生效的认证。等本地全栈 + profiles/RLS 验证
 * 通过后,才会把 middleware / getCurrentUserId / 登录注册页切过来。
 *
 * 环境变量(本地 `supabase start` 会打印这两个值,写进 .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL          —— 项目 URL(本地形如 http://127.0.0.1:54321)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY     —— 浏览器可见的 anon / publishable key
 *
 * 云端新项目用 publishable key(sb_publishable_...),CLI 本地仍输出 anon key,
 * 两者在 createBrowserClient / createServerClient 里通用 —— 这里同时接受
 * 新命名 PUBLISHABLE_KEY,缺省回落到 ANON_KEY,迁云端时无需改代码。
 *
 * 注意:NEXT_PUBLIC_* 会被打进浏览器包,只能放 anon/publishable(受 RLS 约束),
 * 绝不能放 service_role / secret key。
 */

export const SUPABASE_AUTH_COOKIE_NAME = "dearm-supabase-auth-token";

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL 未设置 —— 运行 `supabase start` 后把它写进 .env.local",
    );
  }
  return url;
}

export function getSupabaseServerUrl(): string {
  return process.env.SUPABASE_URL ?? getSupabaseUrl();
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY(或 _PUBLISHABLE_KEY)未设置 —— 见 `supabase start` 输出",
    );
  }
  return key;
}
