import type { NextConfig } from "next";

function resolveMediaUpstream(): string {
  const internalUrl = process.env.SUPABASE_URL?.trim();
  if (internalUrl) return internalUrl.replace(/\/+$/, "");

  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (publicUrl) {
    try {
      const parsed = new URL(publicUrl);
      if (process.env.NODE_ENV !== "production") {
        return parsed.origin;
      }
      if (
        parsed.hostname === "supabase.co" ||
        parsed.hostname.endsWith(".supabase.co")
      ) {
        return parsed.origin;
      }
    } catch {
      // Invalid public URLs fall back to the self-hosted Docker service.
    }
  }

  return "http://kong:8000";
}

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runner stage — copies only
  // the deps each route actually pulls in. Cuts the prod image from ~1GB
  // (full node_modules) to ~200MB. No effect on `next dev`.
  output: "standalone",

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [360, 390, 430, 640, 768, 1024, 1280, 1536],
    imageSizes: [32, 48, 64, 96, 128, 192, 256],
    maximumRedirects: 0,
  },

  // Keep the server-side sanitize chain (DOMPurify → jsdom → css-tree) as
  // runtime node requires instead of webpack-bundling it. css-tree does
  // `require('../data/patch.json')`, which webpack's server build fails to
  // resolve ("Cannot find module '../data/patch.json'"), crashing SSR of any
  // page that pulls in MessageRenderer (chat, studio preview). Node resolves
  // the JSON fine at runtime, so externalizing is the fix. Client bundle is
  // unaffected (serverExternalPackages only touches the server build).
  serverExternalPackages: ["isomorphic-dompurify", "jsdom", "css-tree"],

  async headers() {
    const immutableImageHeaders = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      {
        source: "/explore/moon-gate-hero-mobile-opt.avif",
        headers: immutableImageHeaders,
      },
      {
        source: "/explore/moon-gate-hero-mobile-opt.webp",
        headers: immutableImageHeaders,
      },
      {
        source: "/explore/moon-gate-hero-mobile-opt.jpg",
        headers: immutableImageHeaders,
      },
      {
        source: "/explore/moon-gate-hero-wide-opt.avif",
        headers: immutableImageHeaders,
      },
      {
        source: "/explore/moon-gate-hero-wide-opt.webp",
        headers: immutableImageHeaders,
      },
      {
        source: "/explore/moon-gate-hero-wide-opt.jpg",
        headers: immutableImageHeaders,
      },
      {
        source: "/api/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },

  // /api/media/* → 自建 Supabase Storage 反向代理(公开 bucket "media")。
  //
  // Why: 站点走 https://dearm.ai(Cloudflare 前置);iframe 美化组件内部 CSP 又是
  // `img-src 'self' data: https:` (iframe-bridge.ts:51)。历史上外部美化包
  // replacement 里全是外部 CDN 直链的图。2026-07-05 迁移 (c9b0e73)
  // 把这些 URL 重写成 http://<公网 IP>:8000/storage/v1/object/public/media/... ——
  // HTTP + IP 直连,被 iframe CSP 一刀切,小手机背景 / 默认头像全部空白。
  //
  // 为什么挂在 /api/ 下而不是 /storage/: 我们的 Cloudflare 前置对 /storage/* 有
  // 一层拦截 (推测是 R2 route / Transform Rule; 未确认), 无论请求什么 UUID CF
  // 直接给回一个 404 (Next.js 页面), 上游都进不来。而 /api/* 是 cdn-cloudflare.md
  // §5 明确 "bypass-api" 的通路 —— CF 保证透传, 不缓存不改写。所以走 /api/media/*
  // 更稳。
  //
  // 效果:
  //   - 主页面: 混合内容 (HTTP 图 in HTTPS 页) 消失,浏览器不再拦
  //   - iframe: img-src https: 通过, 组件里的背景 / 默认头像正常渲染
  //   - 上游内网通路 kong:8000 走 HTTP, Docker 网络内不构成 mixed-content
  //
  // 上游用 SUPABASE_URL (容器内 http://kong:8000, 本地 dev 时可覆写)。走
  // SUPABASE_URL 而不是 SUPABASE_PUBLIC_URL —— 后者是 IP:8000, 不必让流量绕出
  // 容器网络。
  //
  // 路径合并: DB 里的 URL 是
  //   http://<IP>:8000/storage/v1/object/public/media/<bucket-path>
  // backfill 把前缀 (含到 "public/media/") 换成 https://dearm.ai/api/media/,
  // 于是这里 `:path*` = "<bucket-path>", 拼回上游即
  //   http://kong:8000/storage/v1/object/public/media/<bucket-path>
  async rewrites() {
    const upstream = resolveMediaUpstream();
    return [
      {
        source: "/api/media/:path*",
        destination: `${upstream}/storage/v1/object/public/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
