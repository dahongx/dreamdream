"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { chatSessions, userMasks, users } from "@/lib/db/schema";
import { canCreateMask, hasUnlimitedMaskBenefit } from "@/lib/masks/limits";
import { listMasksForUser, type MaskListItem } from "@/lib/masks/queries";

const nullableTrimmed = (max: number) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }, z.string().max(max).nullable());

const maskInputSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  note: nullableTrimmed(2000),
  name: z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string())
    .pipe(z.string().min(1, "请填面具名称").max(128, "名称最多 128 个字符")),
  gender: nullableTrimmed(10),
  description: nullableTrimmed(2000),
  preference: nullableTrimmed(200),
  instruction: nullableTrimmed(4000),
});

export type MaskInput = z.infer<typeof maskInputSchema>;

export type MaskActionResult =
  | { ok: true; mask: MaskListItem }
  | {
      ok: false;
      error: string;
      code?: "MASK_LIMIT";
      fieldErrors?: Record<string, string[]>;
    };

export async function listMasksAction(): Promise<MaskListItem[]> {
  const userId = await getCurrentUserId();
  return listMasksForUser(userId);
}

export async function saveMaskAction(
  input: MaskInput,
): Promise<MaskActionResult> {
  const parsed = maskInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "表单校验失败",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const userId = await getCurrentUserId();
  const data = parsed.data;

  if (data.id) {
    // 更新现有面具，不检查数量限制
    const [updated] = await db
      .update(userMasks)
      .set({
        note: data.note,
        name: data.name,
        gender: data.gender,
        description: data.description,
        preference: data.preference,
        instruction: data.instruction,
        updatedAt: new Date(),
      })
      .where(and(eq(userMasks.id, data.id), eq(userMasks.userId, userId)))
      .returning();

    if (!updated) return { ok: false, error: "找不到该面具" };
    return { ok: true, mask: updated };
  }

  // Lock the owner row before checking quota and inserting. Requests from
  // different tabs/processes serialize on the same database row.
  return db.transaction(async (tx): Promise<MaskActionResult> => {
    const [owner] = await tx
      .select({
        tier: users.membershipTier,
        expiresAt: users.membershipExpiresAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!owner) return { ok: false, error: "找不到用户" };

    const unlimited = hasUnlimitedMaskBenefit(owner.tier, owner.expiresAt);
    if (!unlimited) {
      const existing = await tx
        .select({ id: userMasks.id })
        .from(userMasks)
        .where(eq(userMasks.userId, userId));
      if (!canCreateMask(false, existing.length)) {
        return {
          ok: false,
          code: "MASK_LIMIT",
          error: "已达面具上限（2个），升级钻石或铂金会员可创建更多面具",
        };
      }
    }
    const [created] = await tx
      .insert(userMasks)
      .values({
        userId,
        note: data.note,
        name: data.name,
        gender: data.gender,
        description: data.description,
        preference: data.preference,
        instruction: data.instruction,
      })
      .returning();
    return { ok: true, mask: created };
  });
}

export async function setSessionActiveMaskAction(
  sessionId: string,
  maskId: string | null,
): Promise<
  { ok: true; activeMaskId: string | null } | { ok: false; error: string }
> {
  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      maskId: z.string().uuid().nullable(),
    })
    .safeParse({ sessionId, maskId });
  if (!parsed.success) return { ok: false, error: "参数错误" };

  const userId = await getCurrentUserId();
  if (parsed.data.maskId) {
    const [mask] = await db
      .select({ id: userMasks.id })
      .from(userMasks)
      .where(
        and(eq(userMasks.id, parsed.data.maskId), eq(userMasks.userId, userId)),
      )
      .limit(1);
    if (!mask) return { ok: false, error: "找不到该面具" };
  }

  const [updated] = await db
    .update(chatSessions)
    .set({ activeMaskId: parsed.data.maskId, updatedAt: new Date() })
    .where(
      and(
        eq(chatSessions.id, parsed.data.sessionId),
        eq(chatSessions.userId, userId),
      ),
    )
    .returning({ activeMaskId: chatSessions.activeMaskId });

  if (!updated) return { ok: false, error: "找不到该对话" };
  return { ok: true, activeMaskId: updated.activeMaskId };
}

export async function deleteMaskAction(
  maskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(maskId);
  if (!parsed.success) return { ok: false, error: "参数错误" };

  const userId = await getCurrentUserId();
  const deleted = await db
    .delete(userMasks)
    .where(and(eq(userMasks.id, parsed.data), eq(userMasks.userId, userId)))
    .returning({ id: userMasks.id });

  if (deleted.length === 0) return { ok: false, error: "找不到该面具" };
  return { ok: true };
}

/**
 * 设置面具为默认面具(新会话自动绑定)。同时清掉该用户其他面具的 isDefault。
 * 每用户至多一个默认面具。
 */
export async function setDefaultMaskAction(
  maskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(maskId);
  if (!parsed.success) return { ok: false, error: "参数错误" };

  const userId = await getCurrentUserId();

  // 先验证面具归属
  const [mask] = await db
    .select({ id: userMasks.id })
    .from(userMasks)
    .where(and(eq(userMasks.id, parsed.data), eq(userMasks.userId, userId)))
    .limit(1);
  if (!mask) return { ok: false, error: "找不到该面具" };

  // 清掉该用户所有面具的默认标记
  await db
    .update(userMasks)
    .set({ isDefault: false })
    .where(eq(userMasks.userId, userId));

  // 设置目标面具为默认
  await db
    .update(userMasks)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(userMasks.id, parsed.data));

  return { ok: true };
}

/**
 * 取消面具的默认标记。
 */
export async function unsetDefaultMaskAction(
  maskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(maskId);
  if (!parsed.success) return { ok: false, error: "参数错误" };

  const userId = await getCurrentUserId();
  const updated = await db
    .update(userMasks)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(userMasks.id, parsed.data), eq(userMasks.userId, userId)))
    .returning({ id: userMasks.id });

  if (updated.length === 0) return { ok: false, error: "找不到该面具" };
  return { ok: true };
}

/** New chats use no mask; existing session bindings are untouched. */
export async function clearDefaultMaskAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const userId = await getCurrentUserId();
  await db
    .update(userMasks)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(userMasks.userId, userId));
  return { ok: true };
}
