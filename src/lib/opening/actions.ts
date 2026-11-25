"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { beautificationPacks, openingComponents } from "@/lib/db/schema";

/**
 * Server actions for opening_components — delete, reorder, and direct source edit.
 *
 * Authoring flows:
 *  - AI 迭代: studio AI-session (studioSessions type="opening" → commitStudioSessionAction)
 *  - 直接编辑源码: updateOpeningComponentContentAction（v1+ 支持有经验作者直接改源码）
 */

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidatePackSurfaces(packId: string) {
  revalidatePath(`/packs/${packId}/studio`);
  revalidatePath(`/packs/${packId}`);
}

export async function deleteOpeningComponentAction(
  componentId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();

  const [existing] = await db
    .select({
      packId: openingComponents.packId,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(openingComponents)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, openingComponents.packId),
    )
    .where(eq(openingComponents.id, componentId))
    .limit(1);
  if (!existing || existing.ownerUserId !== userId) {
    return { ok: false, error: "找不到该开场组件，或你没有编辑权限" };
  }

  await db
    .delete(openingComponents)
    .where(eq(openingComponents.id, componentId));
  revalidatePackSurfaces(existing.packId);
  return { ok: true, data: null };
}

export async function swapOpeningComponentOrderAction(
  aId: string,
  bId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();

  const rows = await db
    .select({
      id: openingComponents.id,
      packId: openingComponents.packId,
      orderIndex: openingComponents.orderIndex,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(openingComponents)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, openingComponents.packId),
    )
    .where(inArray(openingComponents.id, [aId, bId]));

  if (rows.length !== 2) {
    return { ok: false, error: "找不到要交换顺序的开场组件" };
  }
  const [a, b] = rows;
  if (a.ownerUserId !== userId || b.ownerUserId !== userId) {
    return { ok: false, error: "你没有调整这些开场组件的权限" };
  }
  if (a.packId !== b.packId) {
    return { ok: false, error: "两个开场组件不属于同一个美化包" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(openingComponents)
      .set({ orderIndex: -1, updatedAt: new Date() })
      .where(eq(openingComponents.id, a.id));
    await tx
      .update(openingComponents)
      .set({ orderIndex: a.orderIndex, updatedAt: new Date() })
      .where(eq(openingComponents.id, b.id));
    await tx
      .update(openingComponents)
      .set({ orderIndex: b.orderIndex, updatedAt: new Date() })
      .where(eq(openingComponents.id, a.id));
  });

  revalidatePackSurfaces(a.packId);
  return { ok: true, data: null };
}

/**
 * 直接编辑开场组件源码并保存。
 */
export async function updateOpeningComponentContentAction(
  componentId: string,
  newContent: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();

  const [existing] = await db
    .select({
      packId: openingComponents.packId,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(openingComponents)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, openingComponents.packId),
    )
    .where(eq(openingComponents.id, componentId))
    .limit(1);
  if (!existing || existing.ownerUserId !== userId) {
    return { ok: false, error: "找不到该开场组件，或你没有编辑权限" };
  }

  await db
    .update(openingComponents)
    .set({ content: newContent, updatedAt: new Date() })
    .where(eq(openingComponents.id, componentId));
  revalidatePackSurfaces(existing.packId);
  return { ok: true, data: null };
}
