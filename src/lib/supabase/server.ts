/**
 * Supabase 服务端 client(RSC / Server Actions / Route Handlers 用)。
 *
 * 规则(@supabase/ssr 0.10.x):
 *   - 每次请求都新建,绝不跨请求复用(与 ./client 的单例相反)。
 *   - cookies 必须实现 getAll + setAll(旧的 get/set/remove 已废弃)。
 *   - Next.js 16 的 `cookies()` 是异步的,需 `await`。
 *
 * 关于 setAll 的 try/catch:在纯 RSC(Server Component)里调用 `cookies().set`
 * 会抛错 —— 因为组件渲染阶段不允许写 cookie。token 刷新写回 cookie 的活儿
 * 交给 proxy(middleware,见 ./proxy)统一做,所以这里把写 cookie 的异常吞掉
 * 是安全的、也是官方推荐写法。在 Server Action / Route Handler 里调用时,
 * setAll 能正常写入,不会进 catch。
 *
 * 鉴权铁律:服务端判断「当前用户是谁」用 `supabase.auth.getUser()`(回源核验),
 * 不要用 `getSession()`(只信本地 cookie,可被伪造)。
 *
 * 地基阶段:暂无 import,接线时由 getCurrentUserId / 各 Server Action 引用。
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseServerUrl(), getSupabaseAnonKey(), {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // RSC 渲染阶段写 cookie 会抛错 —— 由 proxy 中间件负责刷新写回,这里忽略。
        }
      },
    },
  });
}
