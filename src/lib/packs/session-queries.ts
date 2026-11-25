import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  type StudioSession,
  studioSessions,
} from "@/lib/db/schema";

/**
 * Studio session 查询层。读取专用，所有 mutation 走 session-actions.ts。
 */

export async function listStudioSessions(
  userId: string,
  packId: string,
): Promise<StudioSession[]> {
  return db
    .select()
    .from(studioSessions)
    .where(
      and(eq(studioSessions.userId, userId), eq(studioSessions.packId, packId)),
    )
    .orderBy(desc(studioSessions.updatedAt));
}

export async function getStudioSession(
  sessionId: string,
): Promise<StudioSession | null> {
  const [row] = await db
    .select()
    .from(studioSessions)
    .where(eq(studioSessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

export async function getActiveSession(
  userId: string,
  packId: string,
): Promise<StudioSession | null> {
  const [row] = await db
    .select()
    .from(studioSessions)
    .where(
      and(
        eq(studioSessions.userId, userId),
        eq(studioSessions.packId, packId),
        eq(studioSessions.status, "active"),
      ),
    )
    .orderBy(desc(studioSessions.updatedAt))
    .limit(1);
  return row ?? null;
}

/**
 * 反查 session 所在 pack 的 owner —— 鉴权用。失败返回 null。
 */
export async function getSessionPackOwner(
  sessionId: string,
): Promise<{ session: StudioSession; ownerUserId: string } | null> {
  const [row] = await db
    .select({
      session: studioSessions,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(studioSessions)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, studioSessions.packId),
    )
    .where(eq(studioSessions.id, sessionId))
    .limit(1);
  return row ?? null;
}
