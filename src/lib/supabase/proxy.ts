/**
 * Supabase session 刷新 + 路由门禁 —— 由 src/middleware.ts 调用。
 *
 * 每个请求:刷新 access/refresh token 并把更新后的 cookie 写回响应;再用
 * getUser() 回源核验,未登录访问受保护路由则跳 /signin。
 *
 * 关键约束(@supabase/ssr 0.10.x):
 *   1. `createServerClient` 与 `getUser()` 之间不要插任何代码。
 *   2. cookie 同时写 request(供本次后续读)和 response(写回浏览器)。
 *   3. 把 setAll 第二参数 `headers`(缓存控制)写回响应,防 CDN/ISR 串号
 *      (该参数 @supabase/ssr ≥ 0.10.0 提供)。
 *
 * 公开前缀:登录/注册/auth 回调。其余受保护。
 * (middleware 的 matcher 已排除 /api、/_next、静态资源、/signin、/signup。)
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from "./config";

const PUBLIC_PREFIXES = [
  "/signin",
  "/signup",
  "/auth",
  "/forgot-password",
  "/reset-password",
  // /agreement 必须无条件公开：注册页那句「注册即表示你已阅读并同意」把
  // 完成注册定义成签约动作，如果读协议本身要先登录，用户就是在同意一份
  // 打不开的合同。已注销 / 未注册的人也有读隐私政策的正当理由。
  "/agreement",
];
// 访客可浏览：只放行探索页的角色卡「墙」本身。
// - /explore：未登录也能看角色卡 grid（平台引流入口）。
// - /share：放行是为了让社交爬虫（永远未登录）能拿到分享落地页的 OG meta；
//   页面自身对 private 卡仍然把访客拦去 /signin（见 share/[code]/page.tsx）。
// 注意 /characters 不在此列 —— 未登录点开任意角色卡（→ /characters/[id]）会被拦去
// /signin?next=/characters/[id]，登录后回跳。这是刻意的：游客只能看墙，点开即登录。
const GUEST_BROWSABLE_PREFIXES = ["/explore", "/share"];

const ADMIN_ONLY_MODE = process.env.TEST_SERVER_ADMIN_ONLY === "true";
const ADMIN_ONLY_EMAILS = new Set(
  (process.env.TEST_SERVER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
function createNextResponse(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-dearm-pathname", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function isPublicPath(path: string): boolean {
  if (ADMIN_ONLY_MODE) {
    return ["/signin", "/auth", "/forgot-password", "/reset-password"].some(
      (p) => path === p || path.startsWith(`${p}/`),
    );
  }
  if (path === "/") return true;
  return [...PUBLIC_PREFIXES, ...GUEST_BROWSABLE_PREFIXES].some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name === SUPABASE_AUTH_COOKIE_NAME ||
        name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`),
    );
}

export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  if (!hasSupabaseAuthCookie(request)) {
    if (!isPublicPath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      const nextValue =
        request.nextUrl.pathname + (request.nextUrl.search ?? "");
      url.pathname = "/signin";
      url.search = `?next=${encodeURIComponent(nextValue)}`;
      return NextResponse.redirect(url);
    }
    return createNextResponse(request);
  }

  let supabaseResponse = createNextResponse(request);

  const supabase = createServerClient(
    getSupabaseServerUrl(),
    getSupabaseAnonKey(),
    {
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = createNextResponse(request);
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // 不要在此处与下一行之间插代码(见文件头约束 1)。
  // getUser() 回源核验当前用户。当 refresh token 失效时(如 auth 库迁移后旧 cookie
  // 全部作废),@supabase/ssr 可能直接抛 AuthApiError(refresh_token_not_found)——
  // 绝不能让它冒泡出 middleware,否则每个受保护请求都 500、返回用户整站卡死进不去。
  // 用 .catch 兜住:异常一律按「未登录」处理(fail-closed,安全方向),跳登录页重登即可。
  const result = await supabase.auth.getUser().catch(() => null);
  const user = result?.data.user ?? null;

  if (
    ADMIN_ONLY_MODE &&
    user &&
    (!user.email || !ADMIN_ONLY_EMAILS.has(user.email.trim().toLowerCase()))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "?error=adminOnly";
    return NextResponse.redirect(url);
  }
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    // 把原 path + query 编进 next=,登录成功后回跳过去(/share/[code] 这类
    // 分享入口要走这条:未登录拦住,登好后直接进角色详情)。
    const nextValue = request.nextUrl.pathname + (request.nextUrl.search ?? "");
    url.pathname = "/signin";
    url.search = `?next=${encodeURIComponent(nextValue)}`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
