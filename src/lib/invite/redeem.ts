import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inviteCodeRedemptions, inviteCodes, users } from "@/lib/db/schema";

/**
 * 邀请码消费的共享底座。
 *
 * 两个消费方:
 *  1) 注册准入(/api/auth/signup) —— 先 claim 占位、signUp 失败再 refund,
 *     成功后 finalize 绑定用户并升级 beta_tester。
 *  2) settings 里的事后兑换(redeemInviteCodeAction) —— 沿用旧逻辑,不走这里。
 *
 * 一码一人:max_uses 默认 1。claim 用「带条件的原子自增」避免并发下超发:
 * 只有 used_count < max_uses 且未过期时才 +1 并返回行,否则返回空。
 */

/** 归一化用户输入的邀请码:去空格 + 转大写(生成时即大写)。 */
export function normalizeInviteCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/**
 * 原子占位一个名额。返回 code id 表示占位成功;返回 null 表示
 * 码不存在 / 已过期 / 名额用尽。调用方拿到 null 应拒绝注册。
 */
export async function claimInviteCode(code: string): Promise<string | null> {
  if (!code) return null;

  const [row] = await db
    .update(inviteCodes)
    .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
    .where(
      and(
        eq(inviteCodes.code, code),
        sql`${inviteCodes.usedCount} < ${inviteCodes.maxUses}`,
        or(
          isNull(inviteCodes.expiresAt),
          gt(inviteCodes.expiresAt, new Date()),
        ),
      ),
    )
    .returning({ id: inviteCodes.id });

  return row?.id ?? null;
}

/**
 * 退回一个已占位的名额(signUp 失败时调用),避免占用被浪费。
 * 用 GREATEST 兜底,不让 used_count 掉到负数。
 */
export async function refundInviteCode(codeId: string): Promise<void> {
  await db
    .update(inviteCodes)
    .set({ usedCount: sql`GREATEST(${inviteCodes.usedCount} - 1, 0)` })
    .where(eq(inviteCodes.id, codeId));
}

/**
 * 占位成功且用户已建号后:落一条兑换记录并把用户升级为 beta_tester。
 * redemption 的 (user_id, code_id) 唯一索引保证重复调用幂等。
 */
export async function finalizeInviteRedemption(
  codeId: string,
  userId: string,
): Promise<void> {
  await db
    .insert(inviteCodeRedemptions)
    .values({ codeId, userId })
    .onConflictDoNothing();

  await db
    .update(users)
    .set({ role: "beta_tester" })
    .where(eq(users.id, userId));
}
