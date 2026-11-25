import type { NextRequest } from "next/server";

export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";

  if (host && !host.startsWith("0.0.0.0")) {
    return `${proto}://${host}`;
  }

  const siteUrl = process.env.SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");

  return request.nextUrl.origin;
}

export function publicUrl(request: NextRequest, path: string): URL {
  return new URL(path, getPublicOrigin(request));
}
