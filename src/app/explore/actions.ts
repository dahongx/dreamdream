"use server";

import {
  type ExploreSort,
  listCharactersForExplore,
} from "@/lib/characters/queries";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { resolveShowNsfw } from "@/lib/config/site";
import { cookies } from "next/headers";

interface LoadMoreParams {
  sort: ExploreSort;
  search?: string;
  tag?: string;
  excludeTags?: string[];
  cursor: {
    createdAt: string;
    id: string;
  };
}

export async function loadMoreCharacters(params: LoadMoreParams) {
  const cookieStore = await cookies();
  const showNsfw = resolveShowNsfw(cookieStore.get("nj_show_nsfw")?.value);
  const viewerId = await getOptionalUserId();

  const items = await listCharactersForExplore({
    showNsfw,
    viewerId,
    sort: params.sort,
    limit: 24,
    search: params.search,
    tag: params.tag,
    excludeTags: params.excludeTags,
    cursor: {
      createdAt: new Date(params.cursor.createdAt),
      id: params.cursor.id,
    },
  });

  return items;
}
