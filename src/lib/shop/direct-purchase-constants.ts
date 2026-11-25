/**
 * 直购金币包常量 —— 一次性购买 gold 币包的档位定义。
 *
 * 单一来源：所有直购相关的价格、金币数量都从这里取。
 *
 * 定价策略：
 *   - 阶梯折扣：小包单价高，大包单价低
 *   - 最低 HK$0.031/币，最高 HK$0.022/币
 *   - 对标同类平台，价格更有竞争力
 */

export interface GoldPackage {
  /** 包名（用于内部标识和 Stripe metadata） */
  id: string;
  /** 金币数量 */
  gold: number;
  /** 价格，单位 HKD 元（Stripe 下单时 ×100 转最小单位） */
  priceHkd: number;
  /** 是否推荐（UI 上会高亮显示） */
  recommended?: boolean;
}

/**
 * 四档金币包定义。
 *
 * 顺序：从小到大（1600 → 12000），UI 展示时保持这个顺序。
 */
export const GOLD_PACKAGES: GoldPackage[] = [
  {
    id: "gold_1600",
    gold: 1600,
    priceHkd: 50,
  },
  {
    id: "gold_3600",
    gold: 3600,
    priceHkd: 100,
    recommended: true, // 中间档，性价比推荐
  },
  {
    id: "gold_6000",
    gold: 6000,
    priceHkd: 155,
  },
  {
    id: "gold_12000",
    gold: 12000,
    priceHkd: 260,
  },
];

/**
 * 计算单价（HKD/金币）。
 */
export function calculateUnitPrice(pkg: GoldPackage): number {
  return pkg.priceHkd / pkg.gold;
}

/**
 * 格式化单价显示（保留 3 位小数）。
 */
export function formatUnitPrice(pkg: GoldPackage): string {
  return calculateUnitPrice(pkg).toFixed(3);
}
