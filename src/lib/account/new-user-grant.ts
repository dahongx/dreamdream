import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deactivatedEmailHashes, users } from "@/lib/db/schema";
import { hashDeactivatedEmailFromEnv } from "./email-hash";

/**
 * 新人币的「只发一次」闸。
 *
 * 背景：新账号的 100 金 / 200 银来自 users 表的**列默认值**，由 drizzle/0011 的
 * handle_new_user trigger 建行时自动带上。账号注销是硬删除、邮箱会被释放，
 * 所以「注销 → 用同一个邮箱重注册」可以无限刷这份奖励。
 *
 * 闸放在应用层而不是 trigger 里：pepper 只存在于服务端 env，trigger 要拿到它
 * 得配 DB 级参数（current_setting）——多一处易碎的配置面，且没法写单测。
 *
 * 失败不阻断注册：pepper 没配时 hash 会抛错，但那种情况下注销流程本身也写不进
 * 任何哈希、这张表必然是空的，闸没有可拦的东西。为了一个防薅羊毛的检查把注册
 * 打挂，不划算。
 *
 * @returns true 表示命中黑名单并已清零余额
 */
export async function revokeNewUserGrantIfPreviouslyDeleted(
  userId: string,
  email: string,
): Promise<boolean> {
  try {
    const hash = hashDeactivatedEmailFromEnv(email);
    const [hit] = await db
      .select({ emailHash: deactivatedEmailHashes.emailHash })
      .from(deactivatedEmailHashes)
      .where(eq(deactivatedEmailHashes.emailHash, hash))
      .limit(1);
    if (!hit) return false;

    const updated = await db
      .update(users)
      .set({ goldBalance: 0, silverBalance: 0, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (updated.length === 0) {
      // 镜像行还没建出来（Auth 与业务库不同实例时，handle_new_user trigger
      // 跨不了库，靠 ensureUserRow 在首次访问时兜底）。这种部署形态下这个闸
      // 会漏，记一条日志便于排查，不重试。
      console.warn(
        "[dearm] new-user grant gate: users row not found yet",
        userId,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[dearm] new-user grant gate failed", err);
    return false;
  }
}
