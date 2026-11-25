import { getRequestDict } from "@/i18n/server";

/**
 * 角色详情页段级 loading —— 页面是 force-dynamic 且串多个 DB 查询，
 * 之前无 loading.tsx，导航等待期是根 loading 的整屏呼吸点。骨架按
 * 详情页真实结构对位：hero 大图区 + 半压图信息区 + 两块正文卡，
 * 中央挂呼吸点（DESIGN.md：加载不用通用 spinner）。
 */
export default async function CharacterDetailLoading() {
  const dict = await getRequestDict();

  return (
    <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-px)] py-[var(--page-py)]">
      <div
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col gap-[var(--space-lg)]"
      >
        <span className="sr-only">{dict.shell.loading}</span>
        {/* hero：封面图区 + 信息区 */}
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-surface-glass/40">
          {/* 高度走 .detail-hero-media（与真实 hero 同一 clamp），骨架
              与就绪页形状对位，切换时页面不跳。 */}
          <div className="detail-hero-media relative flex items-center justify-center">
            <span className="flex items-center gap-[3px]">
              <span className="ai-loading-dot" />
              <span className="ai-loading-dot [animation-delay:0.2s]" />
              <span className="ai-loading-dot [animation-delay:0.4s]" />
            </span>
          </div>
          <div className="flex flex-col gap-[var(--space-md)] p-[var(--space-md)] md:flex-row md:items-end md:p-[var(--space-lg)]">
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-[var(--radius-md)] bg-surface-glass md:h-32 md:w-32" />
            <div className="flex flex-1 flex-col gap-[var(--space-sm)]">
              <div className="h-8 w-40 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass" />
              <div className="h-4 w-3/4 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass/70" />
              <div className="h-4 w-1/2 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass/50" />
            </div>
          </div>
        </section>
        {/* 正文区块占位（作者的话 / 播放厅） */}
        <div className="h-24 animate-pulse rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/40" />
        <div className="h-48 animate-pulse rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/30 [animation-delay:150ms]" />
      </div>
    </div>
  );
}
