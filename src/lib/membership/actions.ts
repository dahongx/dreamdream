"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { MembershipTier } from "./constants";
import { grantMembership } from "./grant";

/**
 * 会员开通 server actions。
 *
 * ⚠️ 历史：v1 曾有一个对**任何已登录用户**开放的 `subscribeToTier`，点一下就
 * 免费发月卡 —— 接入 Stripe 后已删除。普通用户开通月卡唯一通路是 /shop 走
 * Stripe Checkout 真实付款，履约由 webhook 触发（见 src/lib/stripe/* 与
 * src/app/api/stripe/webhook）。
 *
 * 这里只保留一个 **admin-only** 的手动开通工具（客服补偿 / 测试 / 线下交易用），
 * 复用 [[grantMembership]] 的履约核心，operatorId 记审计。
 */

async function ensureAdmin(): Promise<string | null> {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return null;
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return me?.role === "admin" ? userId : null;
}

/**
 * 管理员手动给指定用户开通 / 续费一档月卡（不走支付，记 operator 审计）。
 * 普通用户构造调用也会被 ensureAdmin 挡掉。
 */
export async function adminGrantMembership(
  targetUserId: string,
  tier: MembershipTier,
): Promise<{ success: boolean; message: string }> {
  const adminId = await ensureAdmin();
  if (!adminId) {
    return { success: false, message: "无权限" };
  }

  try {
    const expiresAt = await db.transaction((tx) =>
      grantMembership(tx, targetUserId, tier, {
        source: "admin",
        operatorId: adminId,
      }),
    );
    revalidatePath("/shop");
    revalidatePath("/me");
    return {
      success: true,
      message: `已开通至 ${expiresAt.toISOString().slice(0, 10)}`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
