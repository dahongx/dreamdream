import { ShieldCheck } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CreatorCard } from "@/components/explore/CreatorCard";
import { ExploreCharacterGrid } from "@/components/explore/ExploreCharacterGrid";
import { ExploreSearchForm } from "@/components/explore/ExploreSearchForm";
import {
  ExplorePendingRegion,
  ExploreTransitionProvider,
  TransitionLink,
} from "@/components/explore/ExploreTransition";
import { SortCyclePill } from "@/components/explore/SortCyclePill";
import { TagBlockControl } from "@/components/explore/TagBlockControl";
import { TagFilterRow } from "@/components/explore/TagFilterRow";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { TopbarMobileMenu } from "@/components/TopbarMobileMenu";
import { btnPrimary } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { getRequestI18n } from "@/i18n/server";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { getViewerChromeData } from "@/lib/auth/viewer-chrome";
import { listCreatorsForExplore } from "@/lib/characters/creator-queries";
import {
  type ExploreSort,
  listCharactersForExplore,
  parseExploreSort,
} from "@/lib/characters/queries";
import { localizeCharacterTagOptions } from "@/lib/characters/tags";
import {
  sfwExploreCategory,
  sfwExploreTagOptions,
} from "@/lib/characters/sfw-explore-tags";
import { resolveShowNsfw, SFW_MODE } from "@/lib/config/site";
import { firstChar } from "@/lib/util/first-char";

export const dynamic = "force-dynamic";

type ExploreView = "characters" | "creators";

interface Props {
  searchParams: Promise<{
    sort?: string;
    q?: string;
    tag?: string;
    /**
     * 屏蔽 tag。同 key 可重复 → Next 把它解析成 string[]。
     * 例：/explore?excludeTag=高虐&excludeTag=骨科
     */
    excludeTag?: string | string[];
    view?: string;
  }>;
}

export default async function ExplorePage({ searchParams }: Props) {
  const cookieStore = await cookies();
  // SFW 模式下 resolveShowNsfw 无条件返回 false，cookie 不再有话语权。
  const showNsfw = resolveShowNsfw(cookieStore.get("nj_show_nsfw")?.value);
  const { dict, locale } = await getRequestI18n();
  const localizedTagOptions = SFW_MODE
    ? sfwExploreTagOptions(locale)
    : localizeCharacterTagOptions(dict.characterTagLabels);

  const sp = await searchParams;
  const sort: ExploreSort = parseExploreSort(sp.sort);
  const search = sp.q?.trim() ?? "";
  const requestedTag = typeof sp.tag === "string" ? sp.tag.trim() : "";
  const tag = SFW_MODE ? sfwExploreCategory(requestedTag) : requestedTag;
  const view: ExploreView = sp.view === "creators" ? "creators" : "characters";

  // excludeTag 可以是 string | string[]，统一成 trimmed unique 列表。
  // 同时丢掉跟 `tag`（正向）冲突的项 —— 你不能既要又屏蔽同一个 tag。
  const excludeTagsRaw = Array.isArray(sp.excludeTag)
    ? sp.excludeTag
    : sp.excludeTag
      ? [sp.excludeTag]
      : [];
  const excludeTags = Array.from(
    new Set(
      excludeTagsRaw
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t !== tag),
    ),
  );

  // 角色 tab 也要拿 viewerId,「推荐」按用户偏好标签命中数排
  const [viewerId, me] = await Promise.all([
    getOptionalUserId(),
    getViewerChromeData(),
  ]);

  const items =
    view === "characters"
      ? await listCharactersForExplore({
          showNsfw,
          viewerId,
          sort,
          // The explore page currently has no pagination/load-more control.
          // Do not silently hide public cards behind an unreachable first page.
          limit: null,
          search,
          tag,
          excludeTags,
        })
      : [];

  const creators =
    view === "creators"
      ? await listCreatorsForExplore({
          viewerId,
          showNsfw,
          limit: 24,
          search,
        })
      : [];
  // 构造 URL：保留 sort/q/tag/excludeTag 的当前状态,再叠加调用方给的覆盖。
  // overrides 里 tag=null 表示清掉,excludeTag 是「最终的完整列表」(不是 patch)。
  function buildUrl(
    overrides: { tag?: string | null; excludeTags?: string[] } = {},
  ): string {
    const url = new URLSearchParams();
    if (sort !== "recommended") url.set("sort", sort);
    if (search) url.set("q", search);
    const nextTag = "tag" in overrides ? overrides.tag : tag;
    if (nextTag) url.set("tag", nextTag);
    const nextExclude =
      overrides.excludeTags !== undefined ? overrides.excludeTags : excludeTags;
    for (const t of nextExclude) url.append("excludeTag", t);
    const qs = url.toString();
    return qs ? `/explore?${qs}` : "/explore";
  }

  // 正向 tag 切换：点已选的 → 清空(tag=null);点别的 → 改成它。
  // 同时把它从 excludeTags 里剔掉,避免「既要又屏蔽」自相矛盾的状态留存。
  function tagHref(value: string | null): string {
    if (value === null) return buildUrl({ tag: null });
    return buildUrl({
      tag: value,
      excludeTags: excludeTags.filter((t) => t !== value),
    });
  }

  const characterSearchCarry = [
    ...(tag ? ([["tag", tag]] as Array<[string, string]>) : []),
    ...excludeTags.map((t) => ["excludeTag", t] as [string, string]),
    ...(sort !== "recommended"
      ? ([["sort", sort]] as Array<[string, string]>)
      : []),
  ];

  return (
    <div className="explore-page mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-px)] py-[var(--page-py)]">
      {/* 筛选导航走 client transition：pending 时旧内容原地保留（见
          ExploreTransition 组件 docblock），URL 仍是唯一真相。 */}
      <ExploreTransitionProvider>
        {/* Hero —— DESIGN.md 签名 #1：核心页面大号衬线中文标题定调。
          v2「一盏灯」Wave 3：hero 下方增加 Fraunces italic 英文题记
          「where fictions breathe.」+ --ink-jade 细分割线，是"扉页"排版语汇。
          cosmic-dust 星点铺 hero 区。 */}
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
            <Link href="/" className="explore-hero-brand">
              <BrandLogo label={dict.shell.brand} idPrefix="explore-brand" />
            </Link>
            <div className="explore-hero-actions">
              {me?.isAdmin && (
                <Link
                  href="/admin"
                  title={dict.nav.admin}
                  aria-label={dict.shell.adminEntryAria}
                  className="explore-hero-icon explore-hero-admin"
                >
                  <ShieldCheck width={18} height={18} strokeWidth={1.5} />
                </Link>
              )}
              <TopbarMobileMenu defaultNsfw={showNsfw} variant="ghost" />
              {me && (
                <NotificationBell
                  initialItems={me.unreadNotifications}
                  className="explore-hero-icon"
                />
              )}
              {me ? (
                <Link
                  href="/settings"
                  title={me.name ?? dict.nav.settings}
                  aria-label={me.name ?? dict.nav.settings}
                  className="explore-hero-avatar"
                >
                  {me.avatarUrl ? (
                    <ImageWithFallback
                      src={me.avatarUrl}
                      alt={me.name ?? "avatar"}
                      className="h-full w-full object-cover"
                      fallback={
                        <span className="font-display-zh text-base text-text-muted">
                          {firstChar(me.name)}
                        </span>
                      }
                    />
                  ) : (
                    <span className="font-display-zh text-base text-text-muted">
                      {firstChar(me.name)}
                    </span>
                  )}
                </Link>
              ) : (
                <Link href="/signin" className="explore-hero-signin">
                  {dict.nav.signIn}
                </Link>
              )}
            </div>
          </div>
          <div className="explore-hero-copy relative">
            <h1 className="hero-title hero-title-xl">
              {dict.explore.heroTitle}
            </h1>
            <p className="hero-eyebrow" aria-hidden="true">
              {dict.explore.heroEpigraph}
            </p>
            {/* v2 Wave 14「此刻氛围」—— 探索页 hero 下一行实时时间氛围语。
              按北京时间分段："凌晨 xx:xx · 月光正好" 等。server component
              直接算，客户端不需要同步（分钟级精度足够，文案是氛围不是
              时钟）。跟签到逻辑一致用 UTC+8。 */}
            {!SFW_MODE && <p className="explore-hero-mood" aria-hidden="true">
              {dict.explore.heroMoodLine}
            </p>}
          </div>
        </header>

        {/* 视图切换 tab：角色 / 创作者 */}
        <nav
          className="explore-tabs mb-[var(--space-md)] flex items-center gap-[var(--space-lg)] border-b border-border-subtle"
          aria-label={dict.explore.eyebrow}
        >
          <TransitionLink
            href="/explore"
            ariaCurrent={view === "characters" ? "page" : undefined}
            className={`relative -mb-px pb-[var(--space-xs)] font-display-zh text-[17px] transition-colors md:text-lg ${
              view === "characters"
                ? "text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {dict.explore.tabCharacters}
            {view === "characters" && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent-primary" />
            )}
          </TransitionLink>
          <TransitionLink
            href="/explore?view=creators"
            ariaCurrent={view === "creators" ? "page" : undefined}
            className={`relative -mb-px pb-[var(--space-xs)] font-display-zh text-[17px] transition-colors md:text-lg ${
              view === "creators"
                ? "text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {dict.explore.tabCreators}
            {view === "creators" && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent-primary" />
            )}
          </TransitionLink>
          {view === "characters" && (
            <div className="explore-header-search">
              <ExploreSearchForm
                defaultValue={search}
                placeholder={dict.explore.searchPlaceholder}
                buttonLabel={dict.explore.searchButton}
                carry={characterSearchCarry}
              />
            </div>
          )}
        </nav>

        {view === "characters" ? (
          <>
            <div
              id="explore-controls"
              className="explore-controls mb-[var(--space-md)] flex flex-wrap items-center gap-[var(--space-sm)]"
            >
              <SortCyclePill
                value={sort}
                ariaLabel={dict.explore.sortAriaLabel}
                options={[
                  { value: "recommended", label: dict.explore.sortRecommended },
                  { value: "latest", label: dict.explore.sortLatest },
                  { value: "trending", label: dict.explore.sortTrending },
                  { value: "hot", label: dict.explore.sortHot },
                ]}
              />
              <ExploreSearchForm
                defaultValue={search}
                placeholder={dict.explore.searchPlaceholder}
                buttonLabel={dict.explore.searchButton}
                carry={characterSearchCarry}
              />
            </div>

            {/* 正向 tag 行：默认一行,点「更多」可看全部。行末「屏蔽标签」按钮紧跟
              在「更多」之后（Mufy 式：展开全部 + 屏蔽入口同一行右侧）。 */}
            <div className="explore-tags">
              <div className="md:hidden">
                <SortCyclePill
                  value={sort}
                  ariaLabel={dict.explore.sortAriaLabel}
                  options={[
                    {
                      value: "recommended",
                      label: dict.explore.sortRecommended,
                    },
                    { value: "latest", label: dict.explore.sortLatest },
                    { value: "trending", label: dict.explore.sortTrending },
                    { value: "hot", label: dict.explore.sortHot },
                  ]}
                />
              </div>
              <TagFilterRow
                expandLabel={dict.explore.tagExpand}
                collapseLabel={dict.explore.tagCollapse}
                options={[
                  {
                    label: dict.explore.tagAll,
                    href: tagHref(null),
                    active: !tag,
                  },
                  ...localizedTagOptions.map(({ value, label }) => ({
                    label,
                    href: tagHref(value),
                    active: tag === value,
                  })),
                ]}
                trailing={
                  // 屏蔽标签弹窗入口。点开可手输自定义标签(回车)或从预设网格点选，
                  // 保存后写进 excludeTag[] 参数。组件内部保存时会把与正向 tag 冲突的
                  // 屏蔽项让正向 tag 清掉，不会自相矛盾。
                  <TagBlockControl
                    key="tag-block-control"
                    presetTags={localizedTagOptions}
                    initialBlocked={excludeTags}
                    activeTag={tag || undefined}
                    sort={sort}
                    search={search}
                    triggerLabel={dict.explore.excludeTrigger}
                    modalTitle={dict.explore.excludeModalTitle}
                    inputPlaceholder={dict.explore.excludeInputPlaceholder}
                    presetHint={dict.explore.excludePresetHint}
                    saveLabel={dict.explore.excludeSave}
                    closeLabel={dict.explore.excludeClose}
                    removeHint={dict.explore.excludeRemoveHint}
                  />
                }
              />
            </div>

            <ExplorePendingRegion>
              {items.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center gap-[var(--space-md)] p-[var(--space-3xl)] text-center">
                  <p className="font-display-zh text-xl text-text-primary">
                    {dict.explore.emptyTitle}
                  </p>
                  <p className="max-w-md text-sm text-text-muted">
                    {dict.explore.emptyHint}
                    {!showNsfw && dict.explore.emptyHintNsfwHidden}
                  </p>
                  <Link
                    href="/create/character"
                    className={`mt-[var(--space-md)] ${btnPrimary}`}
                  >
                    {dict.explore.emptyCta}
                  </Link>
                </div>
              ) : (
                // v2 Wave 15：撤销 Wave 6 的瀑布流 —— 所有角色卡都是
                // 3/4 竖版立绘（同长宽比），大卡拉伸到 3/5 会裁掉头顶、
                // 构图变形。瀑布流适合"内容自然不等高"的场景（小红书是
                // 文案长短不一），我们是等比图不适合。改回全部 3/4 均匀
                // grid：mobile 2 列 / sm 3 列 / lg 4 列 / xl 5 列。
                // v2 Wave 17：nj-moonrise-grid 让卡片首屏交错浮现
                // （月光照亮书架一本本亮起）。
                <>
                  <div className="explore-feed-heading">
                    <h2>{dict.explore.feedTitle}</h2>
                  </div>
                  <ExploreCharacterGrid
                    initialItems={items}
                    sort={sort}
                    search={search}
                    tag={tag}
                    excludeTags={excludeTags}
                    dict={dict}
                  />
                </>
              )}
            </ExplorePendingRegion>
          </>
        ) : (
          <>
            <div className="mb-[var(--space-md)]">
              <ExploreSearchForm
                defaultValue={search}
                placeholder={dict.explore.creatorSearchPlaceholder}
                buttonLabel={dict.explore.creatorSearchButton}
                carry={[["view", "creators"]]}
              />
            </div>

            <ExplorePendingRegion>
              {creators.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center gap-[var(--space-md)] p-[var(--space-3xl)] text-center">
                  <p className="font-display-zh text-xl text-text-primary">
                    {dict.explore.creatorEmptyTitle}
                  </p>
                  <p className="max-w-md text-sm text-text-muted">
                    {dict.explore.creatorEmptyHint}
                  </p>
                </div>
              ) : (
                <section className="grid grid-cols-1 gap-[var(--space-md)] lg:grid-cols-2">
                  {creators.map((c) => (
                    <CreatorCard
                      key={c.userId}
                      creator={c}
                      viewerId={viewerId}
                      dict={dict}
                    />
                  ))}
                </section>
              )}
            </ExplorePendingRegion>
          </>
        )}
      </ExploreTransitionProvider>
    </div>
  );
}
