/**
 * Supabase 浏览器端 client(Client Components 用)。
 *
 * `createBrowserClient` 内部做单例,可在每个 Client Component 里安全调用
 * `createClient()`,不会重复建连。仅用于浏览器侧的登录/注册/登出表单与
 * 客户端读 session;服务端一律用 `./server`。
 *
 * 地基阶段:暂无 import,接线时由登录注册表单引用。
 */

import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from "./config";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
  });
}
