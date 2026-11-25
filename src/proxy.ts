/**
 * Site-wide auth gate —— Next 16 Proxy(旧称 Middleware)。
 *
 * 每个匹配请求委托给 updateSession():刷新 Supabase token、写回 cookie,并对
 * 未登录访问受保护路由的请求重定向到 /signin。
 *
 * 为什么是 `proxy.ts` 而不是 `middleware.ts`：
 *   Next 16 把 `middleware` 文件约定改名为 `proxy`，且 **`proxy.ts` 默认跑
 *   Node.js 运行时**（旧 `middleware.ts` 默认 Edge 运行时）。
 *   本站数据库迁到云端 Supabase(新加坡)后，Edge 运行时里 `getUser()` 对云端
 *   HTTPS 的 fetch 会**永久卡死**(自托管 Edge sandbox 出网到公网的已知问题) ——
 *   表现为登录后每个受保护页面一直转、进不去。Node 运行时 fetch 云端正常(页面层
 *   早已在 Node 下跑通、~0.2s)，故改用 proxy.ts 让门禁走 Node。逻辑不变。
 *
 * Matcher 排除:
 *   - /api/*        (route handler 自行鉴权;重定向会让 JSON 调用方拿到 307)
 *   - /_next/*      (构建产物 / RSC payload / 图片优化)
 *   - /signin /signup(认证页自身,避免无限重定向)
 *   - favicon.ico、带扩展名的静态资源
 */

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|signin|.*\\.).*)",
  ],
};
