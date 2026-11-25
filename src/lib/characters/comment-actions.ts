"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  canModerateCharacterComments,
  canViewCharacter,
  commentBelongsToCharacter,
  createCharacterComment,
  deleteCharacterComment,
  setCommentLike,
} from "@/lib/characters/comments";

const uuidSchema = z.string().uuid();
const commentBodySchema = z.string().trim().min(1, "评论不能为空").max(800);

export type CommentActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function addCharacterCommentAction(
  _prev: CommentActionResult | null,
  formData: FormData,
): Promise<CommentActionResult> {
  const parsed = z
    .object({
      characterId: uuidSchema,
      parentId: z.preprocess(
        (value) => (value === "" ? null : value),
        uuidSchema.nullable(),
      ),
      body: commentBodySchema,
    })
    .safeParse({
      characterId: formData.get("characterId"),
      parentId: formData.get("parentId"),
      body: formData.get("body"),
    });

  if (!parsed.success) {
    return {
      ok: false,
      error: "评论提交失败",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const userId = await getCurrentUserId();
  const canView = await canViewCharacter(parsed.data.characterId, userId);
  if (!canView) return { ok: false, error: "角色不存在或不可见" };

  if (parsed.data.parentId) {
    const validParent = await commentBelongsToCharacter(
      parsed.data.parentId,
      parsed.data.characterId,
    );
    if (!validParent) return { ok: false, error: "回复目标不存在" };
  }

  await createCharacterComment({
    characterId: parsed.data.characterId,
    parentId: parsed.data.parentId,
    authorId: userId,
    body: parsed.data.body,
  });

  revalidatePath(`/characters/${parsed.data.characterId}`);
  revalidatePath("/explore");
  return { ok: true };
}

export async function toggleCharacterCommentLikeAction(
  commentId: string,
  characterId: string,
  liked: boolean,
): Promise<CommentActionResult> {
  const parsed = z
    .object({
      commentId: uuidSchema,
      characterId: uuidSchema,
      liked: z.boolean(),
    })
    .safeParse({ commentId, characterId, liked });
  if (!parsed.success) return { ok: false, error: "点赞失败" };

  const userId = await getCurrentUserId();
  const canView = await canViewCharacter(parsed.data.characterId, userId);
  if (!canView) return { ok: false, error: "角色不存在或不可见" };

  const validComment = await commentBelongsToCharacter(
    parsed.data.commentId,
    parsed.data.characterId,
  );
  if (!validComment) return { ok: false, error: "评论不存在" };

  await setCommentLike({
    commentId: parsed.data.commentId,
    userId,
    liked: parsed.data.liked,
  });

  revalidatePath(`/characters/${parsed.data.characterId}`);
  revalidatePath("/explore");
  return { ok: true };
}

export async function deleteCharacterCommentAction(
  commentId: string,
  characterId: string,
): Promise<CommentActionResult> {
  const parsed = z
    .object({
      commentId: uuidSchema,
      characterId: uuidSchema,
    })
    .safeParse({ commentId, characterId });
  if (!parsed.success) return { ok: false, error: "删除失败" };

  const userId = await getCurrentUserId();
  const canModerate = await canModerateCharacterComments(
    parsed.data.characterId,
    userId,
  );
  if (!canModerate) return { ok: false, error: "只有创作者可以删除评论" };

  const validComment = await commentBelongsToCharacter(
    parsed.data.commentId,
    parsed.data.characterId,
  );
  if (!validComment) return { ok: false, error: "评论不存在" };

  await deleteCharacterComment(parsed.data.commentId);

  revalidatePath(`/characters/${parsed.data.characterId}`);
  revalidatePath("/explore");
  return { ok: true };
}
