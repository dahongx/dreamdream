import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { chatSessions, type UserMask, userMasks } from "@/lib/db/schema";

export type MaskListItem = Pick<
  UserMask,
  | "id"
  | "note"
  | "name"
  | "gender"
  | "description"
  | "preference"
  | "instruction"
  | "isDefault"
  | "createdAt"
  | "updatedAt"
>;

export async function listMasksForUser(
  userId: string,
): Promise<MaskListItem[]> {
  return db
    .select({
      id: userMasks.id,
      note: userMasks.note,
      name: userMasks.name,
      gender: userMasks.gender,
      description: userMasks.description,
      preference: userMasks.preference,
      instruction: userMasks.instruction,
      isDefault: userMasks.isDefault,
      createdAt: userMasks.createdAt,
      updatedAt: userMasks.updatedAt,
    })
    .from(userMasks)
    .where(eq(userMasks.userId, userId))
    .orderBy(desc(userMasks.updatedAt));
}

export async function getSessionActiveMask(
  sessionId: string,
  userId: string,
): Promise<UserMask | null> {
  const [row] = await db
    .select({ mask: userMasks })
    .from(chatSessions)
    .leftJoin(userMasks, eq(userMasks.id, chatSessions.activeMaskId))
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);

  if (!row?.mask || row.mask.userId !== userId) return null;
  return row.mask;
}

export async function getSessionMaskState(
  sessionId: string,
  userId: string,
): Promise<{ masks: MaskListItem[]; activeMaskId: string | null }> {
  const [session] = await db
    .select({ activeMaskId: chatSessions.activeMaskId })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);

  const masks = await listMasksForUser(userId);
  const activeMaskId =
    session?.activeMaskId && masks.some((m) => m.id === session.activeMaskId)
      ? session.activeMaskId
      : null;

  return { masks, activeMaskId };
}

/**
 * 获取用户的默认面具(is_default = true)。每用户至多一个,没有则返回 null。
 * 用于新会话自动绑定默认面具。
 */
export async function getDefaultMask(
  userId: string,
): Promise<Pick<UserMask, "id" | "name"> | null> {
  const [mask] = await db
    .select({ id: userMasks.id, name: userMasks.name })
    .from(userMasks)
    .where(and(eq(userMasks.userId, userId), eq(userMasks.isDefault, true)))
    .limit(1);
  return mask ?? null;
}
