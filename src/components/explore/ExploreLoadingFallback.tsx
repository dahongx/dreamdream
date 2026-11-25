import { BrandLogo } from "@/components/BrandLogo";
import { RouteLoadingLogo } from "@/components/ui/RouteLoadingLogo";
import type { Dict } from "@/i18n/types";
import { SFW_MODE } from "@/lib/config/site";

type ExploreLoadingFallbackProps = {
  dict: Dict;
};

export function ExploreLoadingFallback({ dict }: ExploreLoadingFallbackProps) {
  const skeletonCards = Array.from({ length: 10 }, (_, i) => i);

  return (
    <div className="explore-page mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-px)] py-[var(--page-py)]">
      <RouteLoadingLogo label={dict.shell.loading} overlay />
      <header className="explore-hero relative mb-[var(--space-lg)] overflow-hidden">
        <div
          aria-hidden="true"
          className="brand-aura pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden="true"
          className="cosmic-dust pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden="true"
          className="explore-hero-scene pointer-events-none absolute inset-0"
        >
          <span className="explore-moon-door" />
          <span className="explore-moon-path" />
          <span className="explore-butterfly" />
        </div>
        <div className="explore-hero-chrome relative flex items-center justify-between">
          <div className="explore-hero-brand">
            <BrandLogo
              label={dict.shell.brand}
              idPrefix="explore-loading-brand"
            />
          </div>
          <div className="explore-hero-actions" aria-hidden="true">
            <div className="explore-hero-icon animate-pulse" />
            <div className="explore-hero-icon animate-pulse" />
            <div className="explore-hero-icon animate-pulse" />
          </div>
        </div>
        <div className="explore-hero-copy relative">
          <h1 className="hero-title hero-title-xl">{dict.explore.heroTitle}</h1>
          <p className="hero-eyebrow" aria-hidden="true">
            {dict.explore.heroEpigraph}
          </p>
          {!SFW_MODE && <p className="explore-hero-mood" aria-hidden="true">
            {dict.explore.heroMoodLine}
          </p>}
        </div>
      </header>

      {/* tab 行 + 筛选行骨架 */}
      <div className="mb-[var(--space-md)] flex items-center gap-[var(--space-lg)] border-b border-border-subtle pb-[var(--space-xs)]">
        <div className="h-6 w-12 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass/60" />
        <div className="h-6 w-16 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass/40" />
      </div>
      <div className="mb-[var(--space-md)] flex items-center gap-[var(--space-sm)]">
        <div className="h-9 w-24 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass/50" />
        <div className="h-9 flex-1 animate-pulse rounded-[var(--radius-sm)] bg-surface-glass/40" />
      </div>

      <output
        aria-live="polite"
        aria-busy="true"
        className="grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        <span className="sr-only">{dict.shell.loading}</span>
        {skeletonCards.map((i) => (
          <div
            key={i}
            className="aspect-[3/4] animate-pulse rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/50"
            style={{ animationDelay: `${(i % 5) * 120}ms` }}
          />
        ))}
      </output>
    </div>
  );
}
