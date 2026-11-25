const PUBLIC_MEDIA_PREFIX = "/storage/v1/object/public/media/";
const LOCAL_MEDIA_PREFIX = "/api/media/";

export function toLocalOptimizableMediaSrc(src: string): string {
  if (src.startsWith("/")) return src;

  try {
    const url = new URL(src);
    if (url.pathname.startsWith(PUBLIC_MEDIA_PREFIX)) {
      const mediaPath = url.pathname.slice(PUBLIC_MEDIA_PREFIX.length);
      return `${LOCAL_MEDIA_PREFIX}${mediaPath}${url.search}${url.hash}`;
    }
    if (url.pathname.startsWith(LOCAL_MEDIA_PREFIX)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return src;
  }

  return src;
}
