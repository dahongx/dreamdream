import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { characters, userFollows, users } from "@/lib/db/schema";

/**
 * 检查当前用户是否关注了目标用户
 */
export async function isFollowing(
  currentUserId: string | null,
  targetUserId: string,
): Promise<boolean> {
  if (!currentUserId) return false;
  if (currentUserId === targetUserId) return false;

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userFollows)
    .where(
      sql`${userFollows.followerId} = ${currentUserId} AND ${userFollows.followingId} = ${targetUserId}`,
    )
    .limit(1);

  return (result[0]?.count ?? 0) > 0;
}

/**
 * 获取用户关注的所有创作者列表
 */
export async function getUserFollowingList(userId: string) {
  const followingList = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      name: users.name,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
    })
    .from(userFollows)
    .innerJoin(users, eq(userFollows.followingId, users.id))
    .where(eq(userFollows.followerId, userId))
    .orderBy(desc(userFollows.createdAt));

  // 为每个创作者查询角色数量
  const listWithCounts = await Promise.all(
    followingList.map(async (creator) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(characters)
        .where(
          and(
            eq(characters.ownerId, creator.userId),
            eq(characters.visibility, "public"),
          ),
        );

      return {
        ...creator,
        characterCount: countResult?.count ?? 0,
      };
    }),
  );

  return listWithCounts;
}

/**
 * 获取用户的关注数量
 */
export async function getFollowingCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userFollows)
    .where(eq(userFollows.followerId, userId));

  return result?.count ?? 0;
}

/**
 * 获取用户的粉丝数量
 */
export async function getFollowersCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userFollows)
    .where(eq(userFollows.followingId, userId));

  return result?.count ?? 0;
}
