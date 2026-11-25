/**
 * Single source of truth for "who is acting?" across Server Actions / RSC.
 *
 * Supabase Auth 版本(方案① 分支):
 *   用 `supabase.auth.getUser()` 回源核验当前用户,返回其 id。该 id 等于业务
 *   `public.users.id` —— 由 auth.users→users 桥接 trigger(drizzle/0011)保证 ——
 *   所以所有按 `users.id` / `owner_id` 过滤的 Drizzle 查询无需任何改动。
 *
 *   当 Supabase Auth 与业务 DB 不在同一实例时(如远程 Auth + 本地 DB),trigger
 *   无法跨库触发。ensureUserRow 在首次访问时兜底:若 public.users 中缺少
 *   对应行则根据 auth metadata 自动创建,保证外键约束不会断裂。
 *
 * 为什么 `cache()`:
 *   `getUser()` 每次都回 Auth 服务器核验(权威,能反映服务端登出/删号),单个请求
 *   内可能被几十处调用。React `cache()` 把一次请求内的多次调用收敛为一次往返,
 *   避免 N 次网络放大(原 Auth.js 的 `auth()` 是本地解 JWT、无往返)。
 *
 * 无登录:redirect("/signin")。middleware 通常已先拦截,这里是 RSC/Action 兜底。
 */

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuthUser } from "@/lib/auth/auth-user";
import { isDeveloperEmail } from "@/lib/auth/dev-allowlist";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const ensured = new Set<string>();

async function ensureUserRow(user: User) {
  if (ensured.has(user.id)) return;
  await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email ?? null,
      username: (user.user_metadata?.username as string) ?? null,
      displayName: (user.user_metadata?.display_name as string) ?? null,
      name: (user.user_metadata?.name as string) ?? null,
    })
    .onConflictDoNothing({ target: users.id });
  ensured.add(user.id);
}

export const getCurrentUserId = cache(async (): Promise<string> => {
  const user = await getAuthUser();
  if (user) {
    await ensureUserRow(user);
    return user.id;
  }
  // redirect() throws NEXT_REDIRECT, unwound at the route boundary.
  redirect("/signin");
});

/**
 * 平台开发者旁路:NIMIR_DEBUG_EMAILS 白名单上的账号视为开发者,可绕过 owner
 * 闸查看 / 编辑任意角色卡(配合 DebugPanel 调 prompt,见 dev-allowlist.ts)。
 *
 * 与 getCurrentUserId 一样按请求 cache,避免重复回源 Auth。未登录返回 false
 * 而非 redirect —— 调用方(已先取过 getCurrentUserId)自行决定登录兜底。
 *
 * trade-off:白名单 email 能读到任意 creator 的 persona/opening 等 prompt 资产
 * 原文,与 DebugPanel 同级越权。NIMIR_DEBUG_EMAILS 严禁配进 prod。
 */
export const isCurrentUserDeveloper = cache(async (): Promise<boolean> => {
  const user = await getAuthUser();
  return isDeveloperEmail(user?.email);
});
