/**
 * 按钮统一词汇 —— 全站四档（与 field.ts 同思路的纯 class 字符串模块）。
 *
 * 此前各页手写，实底/描边/圆角混用无成文规则。词汇表：
 *
 *   primary    「往前走」的动作（编辑 / 发布 / 保存）。accent 实底（冷银） +
 *              CTA 投影 + pill 圆角。每屏至多一个。
 *   gold       v2 Wave 5 新增。**极少数**关键金色 CTA：角色详情「落座」、
 *              商店推荐档订阅。金色 gradient + inner-shadow + 微光晕
 *              （江诗丹顿广告按钮质感）。全站每屏最多一个。
 *   secondary  平级动作（编辑 / 取消 / 次要入口）。描边 + radius-sm。
 *   ghost      工具性动作。无边框文字钮。
 *
 * 尺寸：默认 text-sm；`Lg` 变体 text-base（auth / 落地页等大场景）。
 * 迁移策略：新代码一律用这里；旧按钮顺手换，特殊按钮（shop 渐变订阅钮、
 * 图标钮）不强套。
 */

export const btnPrimary =
  "inline-flex items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent shadow-(--shadow-cta) transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active disabled:opacity-60";

export const btnPrimaryLg =
  "inline-flex items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-base font-medium text-text-on-accent shadow-(--shadow-cta) transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active disabled:opacity-60";

/**
 * v2 Wave 5「夜青银」金色 CTA —— 江诗丹顿感质地按钮。
 *
 * 实底 --accent-gold + linear-gradient 白/黑蒙层做出金属反光 +
 * inset box-shadow 白色 hairline 高光 + 外部金色微光晕。
 *
 * v2 Wave 8 材质升级：加 .btn-gold-shine class —— hover/active 触发
 * 300ms 金属光扫（一道 45° 冷白光从左到右经过）。参考 Rolex 官网产品图。
 * 光扫动效定义在 globals.css，避免 utility 字符串塞不进 keyframe。
 *
 * 用在**极少数**关键金色 CTA：角色详情「落座」、商店推荐档订阅。
 * 全站每屏最多一个 —— 是转化点的"仪式感"表达。
 */
export const btnGold =
  "btn-gold-shine inline-flex items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-display-zh font-bold tracking-[0.15em] text-text-on-accent transition-opacity disabled:opacity-60 hover:opacity-90 bg-accent-gold bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(0,0,0,0.15)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_rgba(212,175,55,0.32)]";

export const btnGoldLg =
  "btn-gold-shine inline-flex items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-pill)] px-[var(--space-lg)] py-[12px] text-base font-display-zh font-bold tracking-[0.15em] text-text-on-accent transition-opacity disabled:opacity-60 hover:opacity-90 bg-accent-gold bg-[linear-gradient(180deg,rgba(255,255,255,0.2)_0%,rgba(0,0,0,0.15)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_22px_rgba(212,175,55,0.32)]";

export const btnSecondary =
  "inline-flex items-center justify-center gap-[var(--space-sm)] rounded-[var(--radius-sm)] border border-border-strong px-[var(--space-lg)] py-[var(--space-sm)] text-sm text-text-primary transition-colors hover:bg-surface-glass disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-muted transition-colors hover:text-text-primary disabled:opacity-60";
