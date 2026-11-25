import { redirect } from "next/navigation";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { SessionsFavoritesList } from "@/components/sessions/SessionsFavoritesList";
import { SessionsRecentList } from "@/components/sessions/SessionsRecentList";
import { SessionsTabs } from "@/components/sessions/SessionsTabs";
import { getRequestI18n } from "@/i18n/server";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { listFavoritedCharactersForUser } from "@/lib/favorites/queries";
import { listRecentSessionsForUser } from "@/lib/sessions/queries";

export const dynamic = "force-dynamic";

/**
 * /sessions —— 「最近会话」+「我的收藏」聚合页。参考 /tmp/page/10.jpg
 * (recent) 与 /tmp/page/11.jpg (favorites)。
 *
 * 进入条件:必须登录(两个 tab 都是用户私有数据)。tab 切换走 ?tab=,
 * server-rendered,无 client 状态,直接靠 URL 把 SSR + 缓存 share 出去。
 */

type Tab = "recent" | "favorites";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SessionsPage({ searchParams }: Props) {
  const userId = await getOptionalUserId();
  if (!userId) redirect("/signin?next=/sessions");

  const sp = await searchParams;
  const tab: Tab = sp.tab === "favorites" ? "favorites" : "recent";
  const { dict, locale } = await getRequestI18n();

  const [recent, favorites] = await Promise.all([
    tab === "recent" ? listRecentSessionsForUser(userId) : Promise.resolve([]),
    tab === "favorites"
      ? listFavoritedCharactersForUser(userId)
      : Promise.resolve([]),
  ]);

  return (
    <PageAtmosphere>
      <div className="page-content-narrow mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-px)] py-[var(--page-py)]">
        <header className="page-hero-heading">
          <h1 className="hero-title page-hero-title">{dict.nav.sessions}</h1>
        </header>
        <SessionsTabs
          active={tab}
          recentLabel={dict.sessions.tabRecent}
          favoritesLabel={dict.sessions.tabFavorites}
          ariaLabel={dict.sessions.tabsAria}
        />

        <div className="mt-[var(--space-md)]">
          {tab === "recent" ? (
            <SessionsRecentList
              items={recent}
              emptyTitle={dict.sessions.recentEmpty}
              emptyCta={dict.notFound.goExplore}
              previewUnavailable={dict.sessions.previewUnavailable}
              inaccessibleHint={dict.sessions.inaccessibleHint}
              deletedCharacterName={dict.sessions.deletedCharacterName}
              deletedCharacterHint={dict.sessions.deletedCharacterHint}
              monthLabelFmt={dict.sessions.monthLabel}
              monthDayLabelFmt={dict.sessions.monthDayLabel}
              locale={locale}
            />
          ) : (
            <SessionsFavoritesList
              items={favorites}
              filterAllLabel={dict.sessions.favoritesFilterAll}
              filterFolderLabel={dict.sessions.favoritesFilterFolder}
              searchPlaceholder={dict.sessions.favoritesSearchPlaceholder}
              emptyTitle={dict.sessions.favoritesEmpty}
              emptyHint={dict.sessions.favoritesEmptyHint}
              previewUnavailable={dict.sessions.previewUnavailable}
              inaccessibleHint={dict.sessions.inaccessibleHint}
              moreMenuAria={dict.sessions.moreMenuAria}
              unfavoriteLabel={dict.sessions.favoritesUnfavoriteLabel}
              unfavoriteError={dict.sessions.favoritesUnfavoriteError}
            />
          )}
        </div>
      </div>
    </PageAtmosphere>
  );
}
