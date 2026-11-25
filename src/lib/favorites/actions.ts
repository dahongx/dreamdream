"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { canViewCharacter } from "@/lib/characters/comments";
import {
  setCharacterFavorite,
  setCharacterLike,
} from "@/lib/favorites/queries";

/**
 * 收藏 / 点赞 Server Actions —— 详情页 hero 按钮调。
 *
 * 双向(target 不依赖当前态)的设计:客户端做 optimistic update,
 * 把目标态(`favorited: boolean`)发上来,后端 idempotent。
 * 避免「点两下 = 来回切」时的 toggle 竞态。
 */

const uuid = z.string().uuid();

export type FavoriteActionResult = { ok: true } | { ok: false; error: string };

export async function toggleCharacterFavoriteAction(
  characterId: string,
  favorited: boolean,
): Promise<FavoriteActionResult> {
  const parsed = z
    .object({ characterId: uuid, favorited: z.boolean() })
    .safeParse({ characterId, favorited });
  if (!parsed.success) return { ok: false, error: "请求格式错误" };

  const userId = await getCurrentUserId();
  const canView = await canViewCharacter(parsed.data.characterId, userId);
  if (!canView) return { ok: false, error: "角色不存在或不可见" };

  await setCharacterFavorite({
    userId,
    characterId: parsed.data.characterId,
    favorited: parsed.data.favorited,
  });

  revalidatePath(`/characters/${parsed.data.characterId}`);
  revalidatePath("/sessions");
  return { ok: true };
}

export async function toggleCharacterLikeAction(
  characterId: string,
  liked: boolean,
): Promise<FavoriteActionResult> {
  const parsed = z
    .object({ characterId: uuid, liked: z.boolean() })
    .safeParse({ characterId, liked });
  if (!parsed.success) return { ok: false, error: "请求格式错误" };

  const userId = await getCurrentUserId();
  const canView = await canViewCharacter(parsed.data.characterId, userId);
  if (!canView) return { ok: false, error: "角色不存在或不可见" };

  await setCharacterLike({
    userId,
    characterId: parsed.data.characterId,
    liked: parsed.data.liked,
  });

  revalidatePath(`/characters/${parsed.data.characterId}`);
  return { ok: true };
}
