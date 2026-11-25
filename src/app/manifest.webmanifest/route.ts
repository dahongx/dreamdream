import { matchSupportedLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getRequestI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestedLocale = matchSupportedLocale(
    new URL(request.url).searchParams.get("lang"),
  );
  const requestI18n = requestedLocale ? null : await getRequestI18n();
  const locale = requestedLocale ?? requestI18n?.locale;
  const dict = requestedLocale
    ? await getDictionary(requestedLocale)
    : requestI18n?.dict;

  if (!locale || !dict) {
    return new Response(null, { status: 500 });
  }

  return Response.json(
    {
      name: dict.meta.title,
      short_name: dict.shell.brand,
      description: dict.meta.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0b1220",
      theme_color: "#0b1220",
      lang: locale,
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store",
        "Content-Type": "application/manifest+json; charset=utf-8",
        Vary: "Cookie, Accept-Language",
      },
    },
  );
}
