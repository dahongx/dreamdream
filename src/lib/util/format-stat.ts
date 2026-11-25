/**
 * 大数缩写 —— 全站统一实现。之前 creators/[id]/page.tsx 和 CreatorCard.tsx
 * 各有一份且行为不同（一个有 k 档一个没有），同一个数字在探索页创作者卡
 * 和创作者主页会显示成两种格式。
 *
 * 9547 → "9.5k"、12345 → "1.2w"、1234567 → "123.5w"
 */
export function formatStat(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  const w = n / 10000;
  return `${w.toFixed(w >= 100 ? 0 : 1).replace(/\.0$/, "")}w`;
}
