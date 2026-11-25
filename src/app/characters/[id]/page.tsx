import { notFound } from "next/navigation";
import { CharacterDetailView } from "@/components/characters/CharacterDetailView";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { getCharacterCreator } from "@/lib/characters/creator-queries";
import { getCharacterById } from "@/lib/characters/queries";
import { SFW_MODE } from "@/lib/config/site";
import { isFollowing } from "@/lib/follows/queries";
import { loadCharacterOpeningComponents } from "@/lib/opening/queries";
import { loadCharacterGlobalCss } from "@/lib/regex/queries";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    commentsPage?: string;
    commentsSort?: string;
  }>;
}

export default async function CharacterDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const query = await searchParams;
  const character = await getCharacterById(id);
  if (!character) notFound();

  // 纵深防御（src/lib/config/site.ts 第 4 条）：SFW 版即便库里混进了
  // nsfw=true 的卡（手工 SQL、迁移遗留、旧数据导入），已知 URL 也直接 404。
  // 不能只靠探索页过滤 —— 搜索、收藏、历史会话、分享链接都是绕过入口。
  // 作者本人同样拦：SFW 版不存在「我自己的成人卡」，那是另一套产品的事。
  if (SFW_MODE && character.nsfw) notFound();

  const viewerId = await getOptionalUserId();

  // 「播放厅」= 该角色的开场组件(小剧场),进聊天前先给 user 看角色氛围
  const [openingComponents, rawCss, creator, creatorFollowing] =
    await Promise.all([
      loadCharacterOpeningComponents(id),
      loadCharacterGlobalCss(id),
      getCharacterCreator(character.ownerId),
      isFollowing(viewerId, character.ownerId),
    ]);

  const commentsPage = Number.parseInt(query.commentsPage ?? "1", 10);
  const commentsSort = query.commentsSort === "likes" ? "likes" : "latest";

  return (
    <CharacterDetailView
      character={character}
      openingComponents={openingComponents}
      globalCss={rawCss}
      mode="page"
      commentsPage={
        Number.isFinite(commentsPage) && commentsPage > 0 ? commentsPage : 1
      }
      commentsSort={commentsSort}
      creator={creator}
      creatorFollowing={creatorFollowing}
    />
  );
}
