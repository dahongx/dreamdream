/**
 * 登录/注册页的品牌标记 —— 顶部圆形 logo 徽章 + 全屏粉紫氛围底光。
 *
 * logo 是复杂插画，小尺寸会糊，所以只在 auth 这类"大留白单列"页面
 * 体现。徽章用 icon-512（指尖火花特写，圆裁后是一团紫光，梦幻且认得
 * 出品牌）；背景是 .brand-aura（粉紫底光）+ 主视觉极淡水印。
 *
 * 纯装饰、pointer-events:none，不影响任何创作者美化区。
 */
export function AuthBrandBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 主视觉极淡水印 —— 深遮罩压到几乎只剩氛围，不干扰表单可读性 */}
      {/* biome-ignore lint/performance/noImgElement: local static brand asset */}
      <img
        src="/brand-key-visual.jpg"
        alt=""
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-[0.16] blur-[3px]"
      />
      <div className="absolute inset-0 bg-bg-base/70" />
      <div className="brand-aura absolute inset-0" />
    </div>
  );
}

export function AuthBrandmark() {
  return (
    <div className="mx-auto mb-[var(--space-sm)] h-16 w-16 overflow-hidden rounded-[var(--radius-lg)] border border-border-strong shadow-(--shadow-cta)">
      {/* biome-ignore lint/performance/noImgElement: local static brand asset */}
      <img src="/icon-512.png" alt="" className="h-full w-full object-cover" />
    </div>
  );
}
