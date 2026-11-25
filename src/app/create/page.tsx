import { ChevronRight, Palette, Search, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { CharacterGridCard } from "@/components/characters/CharacterGridCard";
import { ImportExternalCardButton } from "@/components/characters/ImportExternalCardButton";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { EmptyState } from "@/components/ui/EmptyState";
import { TabNavLink } from "@/components/ui/TabNav";
import { getRequestDict } from "@/i18n/server";
import type { Dict } from "@/i18n/types";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { listMyCharacters } from "@/lib/characters/queries";
import { OFFICIAL_PACK_ID } from "@/lib/packs/official";
import { listMyPacks, listPublicPacks } from "@/lib/packs/queries";

export const dynamic = "force-dynamic";

/**
 * /create — 合并后的创建入口，包含「心之所寄」（角色）和「美化包管理」两个 tab。
 * 默认显示角色 tab (?tab=characters 或无参数)，?tab=packs 显示美化包。
 */

type Tab = "characters" | "packs";

interface Props {
  searchParams: Promise<{ tab?: string; subtab?: string; q?: string }>;
}

export default async function CreatePage({ searchParams }: Props) {
  const userId = await getCurrentUserId();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "packs" ? "packs" : "characters";
  const packsSubTab = sp.subtab === "plaza" ? "plaza" : "mine";
  const q = sp.q?.trim() ?? "";

  const dict = await getRequestDict();

  const [characters, myPacks, publicPacks] = await Promise.all([
    tab === "characters" ? listMyCharacters(userId) : Promise.resolve([]),
    tab === "packs" && packsSubTab === "mine"
      ? listMyPacks(userId)
      : Promise.resolve([]),
    tab === "packs" && packsSubTab === "plaza"
      ? listPublicPacks({
          q,
          sort: "hot",
          limit: 48,
          officialCopy: dict.packs,
        })
      : Promise.resolve([]),
  ]);

  const packs =
    tab === "packs" ? (packsSubTab === "mine" ? myPacks : publicPacks) : [];

  return (
    <PageAtmosphere>
      <div className="page-content-wide mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-px)] py-[var(--page-py)]">
        <header className="page-hero-heading page-hero-heading-with-actions">
          <div>
            <h1 className="hero-title page-hero-title">
              {tab === "characters"
                ? dict.library.heroTitle
                : dict.packs.heroTitle}
            </h1>
          </div>
          {/* 操作按钮 —— 右对齐, 跟随 tab 切换 */}
          <div className="page-hero-actions flex min-h-[34px] items-center justify-end gap-[var(--space-sm)]">
            {tab === "characters" && (
              <>
                <ImportExternalCardButton />
                <Link
                  href="/create/character"
                  className="shrink-0 rounded-[var(--radius-pill)] border border-border-strong px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary md:rounded-[var(--radius-sm)] md:border-accent-primary md:bg-accent-primary md:px-[var(--space-md)] md:py-[var(--space-xs)] md:text-sm md:text-text-on-accent md:hover:bg-accent-primary-hover"
                >
                  {dict.explore.cta}
                </Link>
              </>
            )}
            {tab === "packs" && packsSubTab === "mine" && (
              <Link
                href="/create/pack"
                className="shrink-0 rounded-[var(--radius-pill)] border border-border-strong px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary md:rounded-[var(--radius-sm)] md:border-accent-primary md:bg-accent-primary md:px-[var(--space-md)] md:py-[var(--space-xs)] md:text-sm md:text-text-on-accent md:hover:bg-accent-primary-hover"
              >
                {dict.packs.newPackCta}
              </Link>
            )}
          </div>
        </header>

        {/* 主 tab —— 顶部横排文字 + 激活态紫色短线 (explore 风格) */}
        <nav
          aria-label={dict.nav.create}
          className="mb-[var(--space-md)] flex items-center gap-[var(--space-lg)] border-b border-border-subtle"
        >
          <TabNavLink
            href="/create?tab=characters"
            active={tab === "characters"}
            size="lg"
          >
            {dict.library.heroTitle}
          </TabNavLink>
          <TabNavLink
            href="/create?tab=packs"
            active={tab === "packs"}
            size="lg"
          >
            {dict.packs.heroTitle}
          </TabNavLink>
        </nav>

        {/* tab 说明 —— 题记式衬线浮字, 跟随 tab 变化 */}
        <p className="mb-[var(--space-md)] flex max-w-2xl items-start gap-[var(--space-sm)] text-sm leading-relaxed text-text-secondary">
          <span
            aria-hidden="true"
            className="mt-[6px] inline-block h-[2px] w-[18px] shrink-0 rounded-full bg-accent-primary/50"
          />
          <span>
            {tab === "characters" ? dict.library.subtitle : dict.packs.subtitle}
          </span>
        </p>

        {/* 子 tab —— 仅 packs 显示,文字稍小同样风格 */}
        {tab === "packs" && (
          <nav
            aria-label={dict.packs.heroTitle}
            className="mb-[var(--space-md)] flex items-center gap-[var(--space-lg)] border-b border-border-subtle"
          >
            <TabNavLink
              href="/create?tab=packs&subtab=mine"
              active={packsSubTab === "mine"}
              size="md"
            >
              {dict.packs.tabMine}
            </TabNavLink>
            <TabNavLink
              href="/create?tab=packs&subtab=plaza"
              active={packsSubTab === "plaza"}
              size="md"
            >
              {dict.packs.tabPlaza}
            </TabNavLink>
          </nav>
        )}

        {tab === "characters" ? (
          <CharactersGrid characters={characters} dict={dict} />
        ) : (
          <PacksContent packs={packs} subTab={packsSubTab} q={q} dict={dict} />
        )}
      </div>
    </PageAtmosphere>
  );
}

// ----------------------------------------------------------------------------
// Characters grid
// ----------------------------------------------------------------------------

interface CharactersGridProps {
  characters: Awaited<ReturnType<typeof listMyCharacters>>;
  dict: Dict;
}

function CharactersGrid({ characters, dict }: CharactersGridProps) {
  if (characters.length === 0) {
    return (
      <EmptyState
        title={dict.library.emptyTitle}
        hint={dict.library.emptyHint}
        ctaHref="/create/character"
        ctaLabel={dict.library.emptyCta}
        Icon={Sparkles}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4 lg:gap-[var(--space-lg)] xl:grid-cols-5">
      {characters.map((c) => (
        <CharacterGridCard
          key={c.id}
          character={c}
          dict={dict}
          variant="library"
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Packs content
// ----------------------------------------------------------------------------

interface PacksContentProps {
  packs: Array<
    | Awaited<ReturnType<typeof listMyPacks>>[number]
    | Awaited<ReturnType<typeof listPublicPacks>>[number]
  >;
  subTab: "mine" | "plaza";
  q: string;
  dict: Dict;
}

function PacksContent({ packs, subTab, q, dict }: PacksContentProps) {
  return (
    <>
      {/* Plaza search */}
      {subTab === "plaza" && (
        <form
          method="get"
          action="/create"
          className="mb-[var(--space-md)] flex gap-[var(--space-sm)]"
        >
          <input type="hidden" name="tab" value="packs" />
          <input type="hidden" name="subtab" value="plaza" />
          <label className="glass-card relative flex flex-1 items-center gap-[var(--space-sm)] px-[var(--space-md)] focus-within:border-accent-primary/60">
            <Search
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-text-muted"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder={dict.packs.searchPlaceholder}
              className="w-full bg-transparent py-[var(--space-sm)] text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="shrink-0 rounded-[var(--radius-sm)] border border-accent-primary bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
          >
            {dict.packs.searchButton}
          </button>
        </form>
      )}

      {packs.length === 0 ? (
        <EmptyState
          title={
            subTab === "mine"
              ? dict.packs.emptyMineTitle
              : dict.packs.emptyPlazaTitle
          }
          hint={
            subTab === "mine"
              ? dict.packs.emptyMineHint
              : dict.packs.emptyPlazaHint
          }
          ctaHref={subTab === "mine" ? "/create/pack" : undefined}
          ctaLabel={subTab === "mine" ? dict.packs.emptyMineCta : undefined}
          Icon={Palette}
        />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3 lg:gap-[var(--space-lg)] xl:grid-cols-4">
          {packs.map((pack) => (
            <Link
              key={pack.id}
              href={`/packs/${pack.id}`}
              className="glass-card group relative flex flex-col gap-[var(--space-sm)] overflow-hidden p-[var(--space-md)]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-[var(--space-md)] left-0 w-[2px] rounded-full bg-accent-primary/30 transition-colors group-hover:bg-accent-primary/70"
              />
              <div className="flex items-start justify-between gap-[var(--space-sm)] pl-[var(--space-sm)]">
                <h4 className="line-clamp-2 font-display-zh text-base leading-snug tracking-wide text-text-primary">
                  {pack.name}
                </h4>
                <div className="flex shrink-0 flex-wrap justify-end gap-[var(--space-xs)]">
                  {pack.id === OFFICIAL_PACK_ID && (
                    <span className="rounded-[var(--radius-pill)] bg-accent-secondary/15 px-[var(--space-sm)] py-[1px] text-[10px] tracking-wide text-accent-secondary">
                      {dict.packs.officialBadge}
                    </span>
                  )}
                  {pack.isPublic && (
                    <span className="rounded-[var(--radius-pill)] bg-accent-primary/15 px-[var(--space-sm)] py-[1px] text-[10px] tracking-wide text-accent-primary">
                      {dict.packs.publicBadge}
                    </span>
                  )}
                  {pack.globalCss && (
                    <span className="rounded-[var(--radius-pill)] bg-surface-solid px-[var(--space-sm)] py-[1px] text-[10px] tracking-wide text-text-muted">
                      {dict.packs.cssBadge}
                    </span>
                  )}
                </div>
              </div>
              {pack.description && (
                <p className="line-clamp-2 pl-[var(--space-sm)] text-xs leading-relaxed text-text-muted">
                  {pack.description}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-[var(--space-sm)] pl-[var(--space-sm)] pt-[var(--space-xs)]">
                <span className="inline-flex items-center gap-[4px] text-[10px] text-text-muted">
                  <Users size={11} strokeWidth={1.5} />
                  {pack.subscriberCount}
                  {dict.packs.subscriberCountSuffix}
                </span>
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  className="text-text-muted transition-transform group-hover:translate-x-[2px] group-hover:text-accent-primary"
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
