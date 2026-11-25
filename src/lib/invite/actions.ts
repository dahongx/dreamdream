"use server";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { inviteCodeRedemptions, inviteCodes, users } from "@/lib/db/schema";

export type RedeemResult =
  | { ok: true; role: string }
  | { ok: false; error: string };

export async function redeemInviteCodeAction(
  _prev: RedeemResult | null,
  formData: FormData,
): Promise<RedeemResult> {
  const rawCode = formData.get("code")?.toString()?.trim();
  if (!rawCode) return { ok: false, error: "请输入激活码" };

  const userId = await getCurrentUserId();

  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (me?.role === "beta_tester" || me?.role === "admin") {
    return { ok: false, error: "你已经是内测体验官了" };
  }

  const [code] = await db
    .select()
    .from(inviteCodes)
    .where(
      and(
        eq(inviteCodes.code, rawCode.toUpperCase()),
        or(
          isNull(inviteCodes.expiresAt),
          gt(inviteCodes.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  if (!code) return { ok: false, error: "激活码无效或已过期" };
  if (code.usedCount >= code.maxUses)
    return { ok: false, error: "该激活码已被他人绑定" };

  const [existing] = await db
    .select({ id: inviteCodeRedemptions.id })
    .from(inviteCodeRedemptions)
    .where(
      and(
        eq(inviteCodeRedemptions.userId, userId),
        eq(inviteCodeRedemptions.codeId, code.id),
      ),
    )
    .limit(1);

  if (existing) return { ok: false, error: "你已经使用过这个激活码了" };

  await db.insert(inviteCodeRedemptions).values({
    codeId: code.id,
    userId,
  });
  await db
    .update(inviteCodes)
    .set({ usedCount: code.usedCount + 1 })
    .where(eq(inviteCodes.id, code.id));
  await db
    .update(users)
    .set({ role: "beta_tester" })
    .where(eq(users.id, userId));

  revalidatePath("/settings");
  return { ok: true, role: "beta_tester" };
}
