import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  characterCommentLikes,
  characterComments,
  characters,
  users,
} from "@/lib/db/schema";

export interface CharacterCommentListItem {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isCreator: boolean;
  };
  replies: CharacterCommentListItem[];
}

export type CharacterCommentSort = "latest" | "likes";

export interface CharacterCommentsPage {
  comments: CharacterCommentListItem[];
  page: number;
  pageSize: number;
  sort: CharacterCommentSort;
  totalRootCount: number;
  totalPages: number;
}

type FlatCommentRow = Omit<CharacterCommentListItem, "replies">;

const DEFAULT_PAGE_SIZE = 5;

export async function listCharacterComments(params: {
  characterId: string;
  viewerId: string | null;
  anonymousUserName?: string;
  sort?: CharacterCommentSort;
  page?: number;
  pageSize?: number;
}): Promise<CharacterCommentsPage> {
  const {
    characterId,
    viewerId,
    anonymousUserName = "匿名用户",
    sort = "latest",
    pageSize = DEFAULT_PAGE_SIZE,
  } = params;
  const page = Math.max(1, params.page ?? 1);
  const [{ totalRootCount }] = await db
    .select({ totalRootCount: count(characterComments.id) })
    .from(characterComments)
    .where(
      and(
        eq(characterComments.characterId, characterId),
        isNull(characterComments.parentId),
      ),
    );

  const totalPages = Math.max(1, Math.ceil(totalRootCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const safeOffset = (safePage - 1) * pageSize;
  const likeCountExpr = count(characterCommentLikes.userId);

  const rootRows = await db
    .select({
      id: characterComments.id,
      parentId: characterComments.parentId,
      body: characterComments.body,
      createdAt: characterComments.createdAt,
      authorId: users.id,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      ownerId: characters.ownerId,
      likeCount: likeCountExpr,
      likedByMe: viewerId
        ? sql<boolean>`count(${characterCommentLikes.userId}) filter (where ${characterCommentLikes.userId} = ${viewerId}) > 0`
        : sql<boolean>`false`,
    })
    .from(characterComments)
    .innerJoin(users, eq(users.id, characterComments.authorId))
    .innerJoin(characters, eq(characters.id, characterComments.characterId))
    .leftJoin(
      characterCommentLikes,
      eq(characterCommentLikes.commentId, characterComments.id),
    )
    .where(
      and(
        eq(characterComments.characterId, characterId),
        isNull(characterComments.parentId),
      ),
    )
    .groupBy(characterComments.id, users.id, characters.ownerId)
    .orderBy(
      ...(sort === "likes"
        ? [desc(likeCountExpr), desc(characterComments.createdAt)]
        : [desc(characterComments.createdAt)]),
    )
    .limit(pageSize)
    .offset(safeOffset);

  const rootIds = rootRows.map((row) => row.id);
  const replyRows =
    rootIds.length > 0
      ? await db
          .select({
            id: characterComments.id,
            parentId: characterComments.parentId,
            body: characterComments.body,
            createdAt: characterComments.createdAt,
            authorId: users.id,
            authorDisplayName: users.displayName,
            authorUsername: users.username,
            authorName: users.name,
            authorAvatarUrl: users.avatarUrl,
            ownerId: characters.ownerId,
            likeCount: count(characterCommentLikes.userId),
            likedByMe: viewerId
              ? sql<boolean>`count(${characterCommentLikes.userId}) filter (where ${characterCommentLikes.userId} = ${viewerId}) > 0`
              : sql<boolean>`false`,
          })
          .from(characterComments)
          .innerJoin(users, eq(users.id, characterComments.authorId))
          .innerJoin(
            characters,
            eq(characters.id, characterComments.characterId),
          )
          .leftJoin(
            characterCommentLikes,
            eq(characterCommentLikes.commentId, characterComments.id),
          )
          .where(
            and(
              eq(characterComments.characterId, characterId),
              inArray(characterComments.parentId, rootIds),
            ),
          )
          .groupBy(characterComments.id, users.id, characters.ownerId)
          .orderBy(asc(characterComments.createdAt))
      : [];

  const flatRows: FlatCommentRow[] = [...rootRows, ...replyRows].map((row) => ({
    id: row.id,
    parentId: row.parentId,
    body: row.body,
    createdAt: row.createdAt,
    likeCount: row.likeCount,
    likedByMe: row.likedByMe,
    author: {
      id: row.authorId,
      name:
        row.authorDisplayName ||
        row.authorUsername ||
        row.authorName ||
        anonymousUserName,
      avatarUrl: row.authorAvatarUrl,
      isCreator: row.authorId === row.ownerId,
    },
  }));

  const byId = new Map<string, CharacterCommentListItem>();
  for (const row of flatRows) {
    byId.set(row.id, { ...row, replies: [] });
  }

  const roots: CharacterCommentListItem[] = rootIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  for (const row of flatRows) {
    if (!row.parentId) continue;
    const item = byId.get(row.id);
    if (!item) continue;
    const parent = byId.get(row.parentId);
    if (parent) parent.replies.push(item);
  }

  return {
    comments: roots,
    page: safePage,
    pageSize,
    sort,
    totalRootCount,
    totalPages,
  };
}

export async function canViewCharacter(
  characterId: string,
  userId: string,
): Promise<boolean> {
  const [character] = await db
    .select({ ownerId: characters.ownerId, visibility: characters.visibility })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!character) return false;
  return character.visibility !== "private" || character.ownerId === userId;
}

export async function commentBelongsToCharacter(
  commentId: string,
  characterId: string,
): Promise<boolean> {
  const [comment] = await db
    .select({ id: characterComments.id })
    .from(characterComments)
    .where(
      and(
        eq(characterComments.id, commentId),
        eq(characterComments.characterId, characterId),
      ),
    )
    .limit(1);
  return Boolean(comment);
}

export async function canModerateCharacterComments(
  characterId: string,
  userId: string,
): Promise<boolean> {
  const [character] = await db
    .select({ ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  return character?.ownerId === userId;
}

export async function createCharacterComment({
  characterId,
  authorId,
  parentId,
  body,
}: {
  characterId: string;
  authorId: string;
  parentId: string | null;
  body: string;
}): Promise<void> {
  await db.insert(characterComments).values({
    characterId,
    authorId,
    parentId,
    body,
  });
}

export async function deleteCharacterComment(commentId: string): Promise<void> {
  await db.delete(characterComments).where(eq(characterComments.id, commentId));
}

export async function setCommentLike({
  commentId,
  userId,
  liked,
}: {
  commentId: string;
  userId: string;
  liked: boolean;
}): Promise<void> {
  if (liked) {
    await db
      .insert(characterCommentLikes)
      .values({ commentId, userId })
      .onConflictDoNothing();
    return;
  }

  await db
    .delete(characterCommentLikes)
    .where(
      and(
        eq(characterCommentLikes.commentId, commentId),
        eq(characterCommentLikes.userId, userId),
      ),
    );
}

export async function listTopLevelCommentAuthors(
  characterId: string,
  anonymousUserName = "匿名用户",
): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      name: users.name,
    })
    .from(characterComments)
    .innerJoin(users, eq(users.id, characterComments.authorId))
    .where(
      and(
        eq(characterComments.characterId, characterId),
        isNull(characterComments.parentId),
      ),
    )
    .groupBy(users.id)
    .orderBy(asc(users.displayName), asc(users.username), asc(users.name))
    .limit(24);

  return rows.map((row) => ({
    id: row.id,
    name: row.displayName || row.username || row.name || anonymousUserName,
  }));
}
