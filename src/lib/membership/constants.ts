/**
 * 会员体系常量 —— 三档月卡 + 普通用户的所有权益参数。
 *
 * 单一来源（single source of truth）：i18n 文案、商城页表格、每日签到金额、
 * 「提升至 X 银币」提示都从这里取，免得几处写死的数字漂移。
 *
 * 数字解释（与产品 spec 对齐）：
 *   - 立即获得金币 = 购买成功立即到账（一次性，写入 currency_transactions）
 *   - 登录领取银币 = 每日签到上限（基础 20 + 会员加成）
 *   - 其它 boolean 权益（聊天存档 / 高峰队列 / 人设面具 / 记忆加成）目前
 *     仅人设面具已接入；未接入的权益不在商城展示。
 *
 * 展示顺序沿用产品定义：黄金 → 钻石 → 铂金；价格与奖励并非线性递增。
 */

export type MembershipTier = "gold" | "platinum" | "diamond";

export interface TierBenefits {
  /** 购买后立即到账的金币（一次性，对齐同类平台的一次性代币） */
  instantGold: number;
  /** 每日签到银币（对齐同类平台的日常代币） */
  dailySilver: number;
  unlimitedChatArchive: boolean;
  noWaitInPeak: boolean;
  unlimitedMasks: boolean;
  extraMemoryBoost: boolean;
}

export interface TierSpec {
  tier: MembershipTier;
  /** 月卡价格，单位为计价币种的「主单位」（HKD 元）。Stripe 下单时 ×100 转最小单位。 */
  priceHkd: number;
  benefits: TierBenefits;
}

/**
 * 计价币种 —— Stripe Checkout 一个会话只能一种币。
 *
 * 为什么是 HKD：Stripe 账号是香港主体，微信支付（硬需求）只接受 hkd / cny，
 * 不接受 usd。卡 / 支付宝 / 微信三者在 hkd 下都通过验证。展示给用户用 HK$。
 */
export const CURRENCY = "hkd" as const;
export const CURRENCY_SYMBOL = "HK$";

/** 普通用户（无会员）的每日签到银币上限。 */
export const FREE_DAILY_SILVER = 20;

/** 普通用户权益对照（用于表格普通列）。 */
export const FREE_BENEFITS: TierBenefits = {
  instantGold: 0,
  dailySilver: FREE_DAILY_SILVER,
  unlimitedChatArchive: false,
  noWaitInPeak: false,
  unlimitedMasks: false,
  extraMemoryBoost: false,
};

/** 三档月卡硬编码定义。改这里前先看 [[pricing-backfill-required]] 类似的对齐风险。 */
export const TIER_SPECS: Record<MembershipTier, TierSpec> = {
  gold: {
    tier: "gold",
    priceHkd: 30,
    benefits: {
      instantGold: 900,
      dailySilver: 90,
      unlimitedChatArchive: true,
      noWaitInPeak: true,
      unlimitedMasks: false,
      extraMemoryBoost: false,
    },
  },
  // 注意：内部 platinum 展示为「钻石会员」、内部 diamond 展示为「铂金会员」
  // （见 src/lib/membership/grant.ts:tierDisplayName + i18n 标签）。tab 顺序
  // [gold, platinum, diamond] = 黄金 → 钻石（中间且最贵） → 铂金，刻意做成
  // 同类平台惯用的「premium 放中间」。
  platinum: {
    tier: "platinum",
    priceHkd: 128,
    benefits: {
      instantGold: 6400,
      dailySilver: 30,
      unlimitedChatArchive: true,
      noWaitInPeak: true,
      unlimitedMasks: true,
      extraMemoryBoost: true,
    },
  },
  diamond: {
    tier: "diamond",
    priceHkd: 68,
    benefits: {
      instantGold: 2700,
      dailySilver: 30,
      unlimitedChatArchive: true,
      noWaitInPeak: true,
      unlimitedMasks: true,
      extraMemoryBoost: true,
    },
  },
};

export const TIER_ORDER: MembershipTier[] = ["gold", "platinum", "diamond"];

/** 「+提升至 X」hint 上展示的最高每日银币数 —— 取所有会员档里最高的 dailySilver。 */
export const MAX_DAILY_SILVER_WITH_MEMBERSHIP = Math.max(
  ...TIER_ORDER.map((t) => TIER_SPECS[t].benefits.dailySilver),
);

/** 月卡有效期天数（自然日，固定 30）。 */
export const MEMBERSHIP_DURATION_DAYS = 30;
