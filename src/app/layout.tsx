import type { Metadata, Viewport } from "next";
import { Shell } from "@/components/Shell";
import { DialogProvider } from "@/components/ui/DialogProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { I18nProvider } from "@/i18n/client";
import { localeToHtmlLang } from "@/i18n/config";
import { getRequestI18n } from "@/i18n/server";
// 自托管字体（@fontsource）——替代 next/font/google。
// 原因：服务器在国内，`next build` 阶段 next/font/google 要抓 fonts.googleapis.com，
// 该域经代理不可达 → build 反复失败。@fontsource 把字体文件打进构建、离线自托管，
// build 不再联网。CJK 字体是带 unicode-range 的分块子集，浏览器按需加载。
// globals.css 再按 html[lang] 把同一组设计 token 切到 SC / TC / JP / Thai 字形。
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
// v2 Wave 10：Instrument Serif —— 极窄衬线，用于大数字（价格、粉丝数、
// 会员编号等）。跟 Fraunces（衬线正文标题）+ Noto Serif SC（中文大标题）
// 分工：Instrument Serif 是"雕刻感"数字体，让 128 / 30k+ / №042 有
// 印刷品质感，避免 SaaS 等宽数字。参考 Aesop / Sézane / The RealReal。
import "@fontsource/instrument-serif/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-serif-jp/700.css";
import "@fontsource/noto-serif-jp/900.css";
// Imported author text can request regular SC; without this face the browser
// selects our display-only 700 face even when computed font-weight is 400.
import "@fontsource/noto-serif-sc/400.css";
import "@fontsource/noto-serif-sc/700.css";
import "@fontsource/noto-serif-sc/900.css";
import "@fontsource/noto-serif-tc/700.css";
import "@fontsource/noto-serif-tc/900.css";
import "@fontsource/noto-serif-thai/700.css";
import "@fontsource/noto-serif-thai/900.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getRequestI18n();
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    manifest: `/manifest.webmanifest?lang=${encodeURIComponent(locale)}`,
    // OG/twitter 图的相对路径（/og.jpg）要靠它解析成绝对 URL —— 不设的
    // 话生产环境分享卡图片地址会指错。复用 Stripe 回跳同一个 env 约定。
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "https://dearm.ai",
    ),
    // 全站默认分享卡（微信/QQ/Twitter 抓取）。/og.jpg 是品牌主视觉的
    // 1200×630 裁切（双手相触 + dearm 字排版）；角色分享页有自己的
    // generateMetadata（角色封面优先），这里只兜底非角色页面。
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: ["/og.jpg"],
    },
    icons: {
      icon: [
        { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: dict.meta.title,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 锁定缩放：iOS Safari 聚焦 <16px 输入框会自动放大整页，放大后视口还能被拖动
  // （用户反馈的「页面会移动」根因）。maximumScale=1 + userScalable=false 让页面
  // 像原生 App 一样固定、不缩放不平移。配合 globals.css 里全站输入框 16px 兜底。
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootLayoutInner>{children}</RootLayoutInner>;
}

async function RootLayoutInner({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getRequestI18n();
  return (
    <html lang={localeToHtmlLang(locale)} suppressHydrationWarning>
      <body>
        <I18nProvider locale={locale} dict={dict}>
          <ToastProvider>
            <DialogProvider>
              <Shell>{children}</Shell>
            </DialogProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
