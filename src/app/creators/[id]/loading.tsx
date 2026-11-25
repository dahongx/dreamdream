import { getRequestDict } from "@/i18n/server";

/**
 * 创作者主页段级 loading —— 骨架对位真实结构：hero 资料卡 + 角色网格。
 */
export default async function CreatorProfileLoading() {
  const dict = await getRequestDict();
  const skeletonCards = Array.from({ length: 4 }, (_, i) => i);

  return (
    <article className="mx-auto w-full max-w-3xl px-[var(--page-px)] py-[var(--page-py)]">
      <div
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col gap-[var(--space-xl)]"
      >
        <span className="sr-only">{dict.shell.loading}</span>
        {/* hero 资料卡 */}
        <section className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-xl)]">
          <div className="flex items-center gap-[var(--space-md)]">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-surface-glass" />
            <div className="flex flex-col gap-[var(--space-sm)]">
              <div className="h-7 w-36 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass" />
              <div className="h-4 w-24 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass/60" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[var(--space-sm)]">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-[var(--radius-md)] bg-surface-glass/50"
              />
            ))}
          </div>
        </section>
        {/* 角色网格 */}
        <div className="grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4">
          {skeletonCards.map((i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/50"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
