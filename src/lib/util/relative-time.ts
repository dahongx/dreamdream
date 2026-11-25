/**
 * 紧凑相对时间 —— 聊天侧栏行尾用。
 *
 * 走 Intl（zh/en 自动本地化，不占 dict key）：
 *   <1min → 「刚刚」/"now"；<1h → 「5分钟前」；<24h → 「3小时前」；
 *   <7d → 「昨天」「3天前」；更早 → 「6/28」短日期。
 */
export function formatRelativeShort(date: Date, locale: string): string {
  const diffMs = Date.now() - date.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return rtf.format(0, "minute").replace(/^在|之内$/g, "");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  return new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
  }).format(date);
}
