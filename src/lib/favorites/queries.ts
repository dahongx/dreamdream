import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  characterFavorites,
  characterLikes,
  characters,
  chatSessions,
  messages,
} from "@/lib/db/schema";

/**
 * 「收藏」「点赞」聚合 + 查询 —— 详情页 hero 与 /sessions「我的收藏」tab 用。
 *
 * 不在 characters 上物化计数,COUNT 子查询 + (character_id) 索引足够;后期真
 * 做排行榜再补物化视图。详见 drizzle/0023_character_favorites_and_likes.sql。
 */

/** 角色被多少人收藏。 */
export async function countCharacterFavorites(
  characterId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(characterFavorites)
    .where(eq(characterFavorites.characterId, characterId));
  return row?.n ?? 0;
}

/** 角色被多少人点赞。 */
export async function countCharacterLikes(
  characterId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(characterLikes)
    .where(eq(characterLikes.characterId, characterId));
  return row?.n ?? 0;
}

/**
 * 详情页 hero 一口气拿四个数:点赞总数 / 收藏总数 / 我是否赞过 / 我是否收藏过。
 * 未登录传 null,只取总数,「我是否」恒为 false。
 *
 * 用四个独立查询而不是 LEFT JOIN —— 计数走 (character_id) 索引,存在性走 PK,
 * 各自最快;join 反而要在大表上做 group by。
 */
export interface CharacterEngagement {
  likeCount: number;
  favoriteCount: number;
  liked: boolean;
  favorited: boolean;
}

export async function getCharacterEngagement(
  characterId: string,
  viewerId: string | null,
): Promise<CharacterEngagement> {
  const [likeCount, favoriteCount, liked, favorited] = await Promise.all([
    countCharacterLikes(characterId),
    countCharacterFavorites(characterId),
    viewerId ? isLikedByUser(viewerId, characterId) : Promise.resolve(false),
    viewerId
      ? isFavoritedByUser(viewerId, characterId)
      : Promise.resolve(false),
  ]);
  return { likeCount, favoriteCount, liked, favorited };
}

export async function isFavoritedByUser(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const rows = await db
    .select({ userId: characterFavorites.userId })
    .from(characterFavorites)
    .where(
      and(
        eq(characterFavorites.userId, userId),
        eq(characterFavorites.characterId, characterId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function isLikedByUser(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const rows = await db
    .select({ userId: characterLikes.userId })
    .from(characterLikes)
    .where(
      and(
        eq(characterLikes.userId, userId),
        eq(characterLikes.characterId, characterId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Toggle helpers —— 收藏 / 点赞按钮调用,幂等。 */
export async function setCharacterFavorite(params: {
  userId: string;
  characterId: string;
  favorited: boolean;
}): Promise<void> {
  const { userId, characterId, favorited } = params;
  if (favorited) {
    await db
      .insert(characterFavorites)
      .values({ userId, characterId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(characterFavorites)
      .where(
        and(
          eq(characterFavorites.userId, userId),
          eq(characterFavorites.characterId, characterId),
        ),
      );
  }
}

export async function setCharacterLike(params: {
  userId: string;
  characterId: string;
  liked: boolean;
}): Promise<void> {
  const { userId, characterId, liked } = params;
  if (liked) {
    await db
      .insert(characterLikes)
      .values({ userId, characterId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(characterLikes)
      .where(
        and(
          eq(characterLikes.userId, userId),
          eq(characterLikes.characterId, characterId),
        ),
      );
  }
}

/* ─────────── 收藏列表 (/sessions「我的收藏」tab) ─────────── */

export interface FavoritedCharacterListItem {
  characterId: string;
  characterName: string;
  characterAvatarUrl: string | null;
  characterTags: string[];
  characterVisibility: "public" | "unlisted" | "private";
  characterOwnerId: string;
  /** owner 还在卡片可访问范围内吗 —— 见 listSessionsForUser 的 accessible 语义。 */
  accessible: boolean;
  favoritedAt: Date;
  /** 当前临时对话(saved_at IS NULL)的 session id,无则 null;点卡时可直接跳进。 */
  currentSessionId: string | null;
  /** 当前临时对话最新一条「活跃」消息(用于卡片预览),无则 null。 */
  previewContent: string | null;
  previewRole: "user" | "assistant" | null;
}

/**
 * 列出用户收藏的角色,按收藏时间倒序。一并捞「当前临时对话」最新一条消息,
 * 用作预览;若用户从未对该角色发起对话,preview 为 null,UI 显示「暂时不
 * 支持预览」fallback(对齐 /tmp/page/11.jpg)。
 *
 * 关于 N+1:每收藏一条角色,要拿其 current session + 最新一条消息。这里用
 * 两段 fetch:
 *   1) 一次 join 拿到 character + favoritedAt + currentSessionId(LEFT JOIN
 *      chatSessions WHERE savedAt IS NULL)
 *   2) 对所有 currentSessionId 一次性 IN 查询每 session 最新一条 message
 *      (DISTINCT ON 也行,Postgres 跑得快;这里用 ORDER+LIMIT per session
 *      via window function 不必要,普通用户收藏数 < 100 量级)
 *
 * Visibility:收藏后角色被作者改成 private 仍出现在列表,但 accessible=false,
 * UI 标灰、点击给提示。对齐 listSessionsForUser 的处理。
 */
export async function listFavoritedCharactersForUser(
  userId: string,
): Promise<FavoritedCharacterListItem[]> {
  const rows = await db
    .select({
      characterId: characters.id,
      characterName: characters.name,
      characterAvatarUrl: characters.avatarUrl,
      characterTags: characters.tags,
      characterVisibility: characters.visibility,
      characterOwnerId: characters.ownerId,
      favoritedAt: characterFavorites.createdAt,
      currentSessionId: chatSessions.id,
    })
    .from(characterFavorites)
    .innerJoin(characters, eq(characters.id, characterFavorites.characterId))
    .leftJoin(
      chatSessions,
      and(
        eq(chatSessions.characterId, characterFavorites.characterId),
        eq(chatSessions.userId, characterFavorites.userId),
        isNull(chatSessions.savedAt),
        isNull(chatSessions.discardedAt),
      ),
    )
    .where(eq(characterFavorites.userId, userId))
    .orderBy(desc(characterFavorites.createdAt));

  const sessionIds = rows
    .map((r) => r.currentSessionId)
    .filter((id): id is string => id !== null);

  // 拿每 session 最新一条活跃消息。用 DISTINCT ON (session_id) 在 (session, created_at desc) 索引上跑很快。
  const previews =
    sessionIds.length === 0
      ? []
      : await db.execute<{
          session_id: string;
          content: string;
          role: "user" | "assistant";
        }>(sql`
          SELECT DISTINCT ON (session_id) session_id, content, role
          FROM ${messages}
          WHERE ${messages.sessionId} IN (${sql.join(
            sessionIds.map((id) => sql`${id}`),
            sql`, `,
          )})
            AND ${messages.supersededAt} IS NULL
          ORDER BY session_id, ${messages.createdAt} DESC
        `);

  const previewBySession = new Map<
    string,
    { content: string; role: "user" | "assistant" }
  >();
  for (const p of previews) {
    previewBySession.set(p.session_id, { content: p.content, role: p.role });
  }

  return rows.map((r) => {
    const preview = r.currentSessionId
      ? previewBySession.get(r.currentSessionId)
      : undefined;
    return {
      characterId: r.characterId,
      characterName: r.characterName,
      characterAvatarUrl: r.characterAvatarUrl,
      characterTags: r.characterTags,
      characterVisibility: r.characterVisibility,
      characterOwnerId: r.characterOwnerId,
      accessible:
        r.characterVisibility !== "private" || r.characterOwnerId === userId,
      favoritedAt: r.favoritedAt,
      currentSessionId: r.currentSessionId,
      previewContent: preview?.content ?? null,
      previewRole: preview?.role ?? null,
    };
  });
}
