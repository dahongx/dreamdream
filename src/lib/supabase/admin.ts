/**
 * Supabase admin client —— 用 service role(secret) key 建的特权 client。
 *
 * ⚠️ 这个 client **绕过一切 RLS、绕过一切用户边界**，能读写任何人的数据、
 * 能删任何账号。任何调用点必须自己先过授权闸（`getCurrentUserId()` 之类），
 * 绝不能把它暴露给未鉴权路径，更不能出现在任何会被打进浏览器包的模块里。
 *
 * 现有唯一用途：账号注销时调 `auth.admin.deleteUser()`。
 * 为什么必须走 admin API 而不是自己删表：`auth.users` 是 GoTrue 的地盘，
 * 直写它的内部表（identities / sessions / refresh_tokens）是非官方路径、
 * 跨版本易碎。deleteUser 一次带走整条身份链，再由 0011 的
 * `users_id_auth_users_fk ON DELETE CASCADE` 把业务侧全部级联删掉。
 *
 * 环境变量沿用 storage 那套（见 src/lib/r2/client.ts）：
 *   - SUPABASE_URL(可选，容器内网) 或 NEXT_PUBLIC_SUPABASE_URL
 *   - SERVICE_ROLE_KEY 或 SUPABASE_SECRET_KEY
 */

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "[supabase] admin client 缺环境变量：SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL 与 SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
    );
  }

  cached = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
