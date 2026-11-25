import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { characters, userFollows, users } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 获取角色创作者的完整信息（用于角色详情页展示）
 */
export async function getCharacterCreator(ownerId: string) {
  const [creator] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      name: users.name,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  return creator ?? null;
}

export interface CreatorProfileCharacter {
  id: string;
  name: string;
  bio: string | null;
  tags: string[];
  nsfw: boolean;
  coverImageUrl: string | null;
  avatarUrl: string | null;
  conversationCount: number;
  visibility: "public" | "private" | "unlisted";
}

export interface CreatorProfile {
  userId: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number;
  conversations: number;
  characterCount: number;
  isFollowing: boolean;
  isOwn: boolean;
  characters: CreatorProfileCharacter[];
}

/**
 * 创作者主页 (/creators/[id]) 数据源。
 *
 * 与 listCreatorsForExplore 不同：这里以"用户存在"为准入，而不要求至少一张公开
 * 角色 —— 用户可能临时下架了所有公开卡，但主页仍应能访问。
 *
 * - 这是公开主页，owner 访问时也只展示 public 角色；私密 / 不列出卡留在角色库
 * - conversations / characterCount 始终基于 public 卡聚合（统一指标语义）
 * - 输入非 UUID 直接返回 null，避免 pg 列类型抛错
 */
export async function getCreatorProfile(
  userId: string,
  viewerId: string | null,
): Promise<CreatorProfile | null> {
  if (!UUID_RE.test(userId)) return null;

  const [userRow] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      name: users.name,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) return null;

  const isOwn = viewerId === userId;

  // public 卡聚合 —— 对话量和"角色数"对外展示口径都用 public
  const [agg] = await db
    .select({
      total: count(characters.id),
      conversations: sql<number>`COALESCE(SUM(${characters.conversationCount}), 0)::int`,
    })
    .from(characters)
    .where(
      and(eq(characters.ownerId, userId), eq(characters.visibility, "public")),
    );

  const [{ followers } = { followers: 0 }] = await db
    .select({ followers: count(userFollows.followerId) })
    .from(userFollows)
    .where(eq(userFollows.followingId, userId));

  let following = false;
  if (viewerId && !isOwn) {
    const rows = await db
      .select({ followerId: userFollows.followerId })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, viewerId),
          eq(userFollows.followingId, userId),
        ),
      )
      .limit(1);
    following = rows.length > 0;
  }

  const characterCondition = and(
    eq(characters.ownerId, userId),
    eq(characters.visibility, "public"),
  );

  const charRows = await db
    .select({
      id: characters.id,
      name: characters.name,
      bio: characters.bio,
      tags: characters.tags,
      nsfw: characters.nsfw,
      coverImageUrl: characters.coverImageUrl,
      avatarUrl: characters.avatarUrl,
      conversationCount: characters.conversationCount,
      visibility: characters.visibility,
    })
    .from(characters)
    .where(characterCondition)
    .orderBy(
      desc(characters.conversationCount),
      desc(characters.createdAt),
      desc(characters.id),
    );

  return {
    userId: userRow.id,
    username: userRow.username,
    displayName: userRow.displayName,
    name: userRow.name,
    avatarUrl: userRow.avatarUrl,
    bio: userRow.bio,
    followers,
    conversations: agg?.conversations ?? 0,
    characterCount: agg?.total ?? 0,
    isFollowing: following,
    isOwn,
    characters: charRows,
  };
}

export interface CreatorListCharacter {
  id: string;
  name: string;
  coverImageUrl: string | null;
  avatarUrl: string | null;
  tags: string[];
  nsfw: boolean;
  conversationCount: number;
}

export interface CreatorListItem {
  userId: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number;
  conversations: number;
  characterCount: number;
  isFollowing: boolean;
  topCharacters: CreatorListCharacter[];
}

export interface ListCreatorsParams {
  viewerId?: string | null;
  showNsfw: boolean;
  limit?: number;
  search?: string;
}

/**
 * Explore 页 "创作者" tab 数据源。
 *
 * 入选门槛 = 至少有一张公开 character。聚合该 owner 的公开角色 conversationCount
 * 作为"互动"指标,followers count 从 user_follows 关联。
 * 然后给每位创作者补上其前 3 张公开角色(按 conversationCount 降序)作为卡片预览。
 *
 * NSFW 由 showNsfw 控制：关时所有过滤都不包含 nsfw 卡(影响排序和预览展示)。
 */
export async function listCreatorsForExplore({
  viewerId,
  showNsfw,
  limit = 24,
  search,
}: ListCreatorsParams): Promise<CreatorListItem[]> {
  const visibilityCondition = eq(characters.visibility, "public");
  const nsfwCondition = showNsfw ? undefined : eq(characters.nsfw, false);
  const charCondition = nsfwCondition
    ? and(visibilityCondition, nsfwCondition)
    : visibilityCondition;

  const searchTerm = search?.trim();
  const searchCondition = searchTerm
    ? or(
        ilike(users.username, `%${searchTerm}%`),
        ilike(users.displayName, `%${searchTerm}%`),
        ilike(users.name, `%${searchTerm}%`),
        ilike(users.bio, `%${searchTerm}%`),
      )
    : undefined;

  const followersSubq = sql<number>`(
    select count(*)::int from ${userFollows}
    where ${userFollows.followingId} = ${users.id}
  )`;
  const conversationsSubq = sql<number>`coalesce(sum(${characters.conversationCount}), 0)::int`;
  const characterCountSubq = sql<number>`count(${characters.id})::int`;

  const whereCondition = searchCondition
    ? and(charCondition, searchCondition)
    : charCondition;

  const creatorRows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      name: users.name,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      followers: followersSubq,
      conversations: conversationsSubq,
      characterCount: characterCountSubq,
    })
    .from(users)
    .innerJoin(characters, eq(characters.ownerId, users.id))
    .where(whereCondition)
    .groupBy(users.id)
    .orderBy(desc(conversationsSubq), desc(followersSubq), desc(users.id))
    .limit(limit);

  if (creatorRows.length === 0) return [];

  const ownerIds = creatorRows.map((r) => r.userId);

  // 一次查出所有候选角色(每个 owner 全部公开角色),再在内存里按 owner 切片取前 3。
  // 角色数通常不大,避免 N+1。
  const allCharRows = await db
    .select({
      id: characters.id,
      ownerId: characters.ownerId,
      name: characters.name,
      coverImageUrl: characters.coverImageUrl,
      avatarUrl: characters.avatarUrl,
      tags: characters.tags,
      nsfw: characters.nsfw,
      conversationCount: characters.conversationCount,
    })
    .from(characters)
    .where(and(charCondition, inArray(characters.ownerId, ownerIds)))
    .orderBy(
      desc(characters.conversationCount),
      desc(characters.createdAt),
      desc(characters.id),
    );

  const charsByOwner = new Map<string, CreatorListCharacter[]>();
  for (const row of allCharRows) {
    const list = charsByOwner.get(row.ownerId) ?? [];
    if (list.length < 3) {
      list.push({
        id: row.id,
        name: row.name,
        coverImageUrl: row.coverImageUrl,
        avatarUrl: row.avatarUrl,
        tags: row.tags,
        nsfw: row.nsfw,
        conversationCount: row.conversationCount,
      });
      charsByOwner.set(row.ownerId, list);
    }
  }

  // viewer 关注集 —— 一次查询拿全。
  let followingSet = new Set<string>();
  if (viewerId) {
    const followedRows = await db
      .select({ followingId: userFollows.followingId })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, viewerId),
          inArray(userFollows.followingId, ownerIds),
        ),
      );
    followingSet = new Set(followedRows.map((r) => r.followingId));
  }

  return creatorRows.map((r) => ({
    userId: r.userId,
    username: r.username,
    displayName: r.displayName,
    name: r.name,
    avatarUrl: r.avatarUrl,
    bio: r.bio,
    followers: r.followers,
    conversations: r.conversations,
    characterCount: r.characterCount,
    isFollowing: followingSet.has(r.userId),
    topCharacters: charsByOwner.get(r.userId) ?? [],
  }));
}
