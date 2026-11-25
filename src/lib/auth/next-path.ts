/**
 * 受信 `next=` 参数过滤 —— 防开放重定向。
 *
 * 只接受同站点内部相对路径(以单个 / 开头),拒掉 `//evil.com` 这类绕过。
 * 分享流(/share/[code] → /signin → 回跳)和邮件确认(/auth/confirm?next=)
 * 都共用这个工具。
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}
