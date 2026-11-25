import { notFound, redirect } from "next/navigation";
import { CharacterDetailView } from "@/components/characters/CharacterDetailView";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { getCharacterById } from "@/lib/characters/queries";
import { loadCharacterOpeningComponents } from "@/lib/opening/queries";
import { loadCharacterGlobalCss } from "@/lib/regex/queries";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    commentsPage?: string;
    commentsSort?: string;
  }>;
}

export default async function ExploreCharacterModal({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  // 游客只能看探索页的角色卡墙，点开即拦去登录。这条 @modal 拦截路由跑在 /explore
  // 下、不受 proxy 的 GUEST_BROWSABLE 门禁覆盖，故在页面层显式补一道守卫。
  const viewerId = await getOptionalUserId();
  if (!viewerId)
    redirect(`/signin?next=${encodeURIComponent(`/characters/${id}`)}`);

  const query = await searchParams;
  const character = await getCharacterById(id);
  if (!character) notFound();

  const [openingComponents, rawCss] = await Promise.all([
    loadCharacterOpeningComponents(id),
    loadCharacterGlobalCss(id),
  ]);

  const commentsPage = Number.parseInt(query.commentsPage ?? "1", 10);
  const commentsSort = query.commentsSort === "likes" ? "likes" : "latest";

  return (
    <CharacterDetailView
      character={character}
      openingComponents={openingComponents}
      globalCss={rawCss}
      mode="modal"
      commentsPage={
        Number.isFinite(commentsPage) && commentsPage > 0 ? commentsPage : 1
      }
      commentsSort={commentsSort}
    />
  );
}
