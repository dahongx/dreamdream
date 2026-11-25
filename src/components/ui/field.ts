/**
 * 表单控件统一样式 —— 全站唯一来源。
 *
 * 此前四套规格并存：CharacterForm（text-xs/surface-glass/radius-sm）、
 * SettingsForm（text-base/surface-glass/radius-sm）、auth
 * （surface-solid/radius-md）、TierSection 兑换框（bg-base/border-strong）。
 * 一致性本身就是质感 —— 收敛为 base + 两档 size。
 *
 * 纯 class 字符串模块（非组件），server / client 组件都能直接 import，
 * 不引入额外的 client 边界。focus 态 = border-strong + --glow-accent
 * 柔光（与 toggle 开启态同一 token，macOS focus ring 的语言）。
 *
 * 原生 <select> 的下拉弹层白底问题由 globals.css 的 color-scheme: dark
 * 解决（浏览器据此把系统弹层渲成暗色），不需要换 JS Select 组件。
 */

export const fieldBaseCls =
  // v2 Wave 7 交互仪式化：focus 从"全边框冷银"改成"底部金色 hairline"
  // —— 书房里"钢笔在纸上写字"的语义。其他三边保持 subtle，
  // 只有底边突出金色，聚焦"落笔"这一动作。
  "w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass text-text-primary outline-none transition-[border-color,box-shadow] duration-[var(--dur-short)] placeholder:text-text-muted/60 focus:border-border-strong focus:border-b-accent-gold focus:shadow-[inset_0_-1px_0_var(--accent-gold)] disabled:opacity-60";

/** 常规表单（设置 / 登录注册 / 兑换码） */
export const fieldSizeMd =
  "px-[var(--space-md)] py-[var(--space-sm)] text-base";

/** 紧凑表单（creator 工具：CharacterForm 等，DESIGN.md「creator 工具页面紧」） */
export const fieldSizeSm = "px-[var(--space-md)] py-[var(--space-xs)] text-xs";

export const fieldCls = `${fieldBaseCls} ${fieldSizeMd}`;
export const fieldClsSm = `${fieldBaseCls} ${fieldSizeSm}`;
