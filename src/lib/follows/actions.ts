"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getOptionalUserId } from "@/lib/auth/optional-user";
import { db } from "@/lib/db/client";
import { userFollows } from "@/lib/db/schema";

/**
 * 关注或取消关注某个用户（创作者）。
 * 返回操作后的关注状态。
 */
export async function toggleFollowUser(
  targetUserId: string,
): Promise<{ success: boolean; isFollowing: boolean; error?: string }> {
  try {
    const currentUserId = await getOptionalUserId();
    if (!currentUserId) {
      return { success: false, isFollowing: false, error: "未登录" };
    }

    // 不能关注自己
    if (currentUserId === targetUserId) {
      return { success: false, isFollowing: false, error: "不能关注自己" };
    }

    // 检查是否已关注
    const existing = await db
      .select()
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, currentUserId),
          eq(userFollows.followingId, targetUserId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // 已关注，执行取消关注
      await db
        .delete(userFollows)
        .where(
          and(
            eq(userFollows.followerId, currentUserId),
            eq(userFollows.followingId, targetUserId),
          ),
        );

      revalidatePath("/me");
      revalidatePath("/me/following");
      revalidatePath(`/characters/[id]`, "page");

      return { success: true, isFollowing: false };
    }

    // 未关注，执行关注
    await db.insert(userFollows).values({
      followerId: currentUserId,
      followingId: targetUserId,
    });

    revalidatePath("/me");
    revalidatePath("/me/following");
    revalidatePath(`/characters/[id]`, "page");

    return { success: true, isFollowing: true };
  } catch (error) {
    console.error("toggleFollowUser error:", error);
    return { success: false, isFollowing: false, error: "操作失败" };
  }
}
