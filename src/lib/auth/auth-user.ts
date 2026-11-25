import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_AUTH_COOKIE_NAME } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * 每请求一次的 `supabase.auth.getUser()`。
 *
 * getUser() 回源 Auth 服务核验（权威，能反映服务端登出/删号），但每次都是
 * 一趟网络往返。此前 Shell（全局 layout，每页都渲染）自己调一次，页面里的
 * getCurrentUserId / getOptionalUserId / isCurrentUserDeveloper 又各自调 ——
 * 一个页面请求最多 2-3 趟 Auth 往返，全部串行压在首字节前。React cache()
 * 把同一请求内的所有调用收敛为一趟。
 *
 * 未登录返回 null，不 redirect —— 登录兜底由调用方（getCurrentUserId）决定。
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some(
      ({ name }) =>
        name === SUPABASE_AUTH_COOKIE_NAME ||
        name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`),
    );
  if (!hasAuthCookie) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
