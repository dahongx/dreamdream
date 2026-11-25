"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  deleteMessagePair,
  deleteSavedSession,
  deleteUserMessagePair,
  discardCurrentAndStartNew,
  forkSessionAtMessage,
  listSavedSessions,
  renameSession,
  type SavedSessionListItem,
  saveCurrentAndStartNew,
  updateAssistantMessage,
  updateUserMessage,
} from "./queries";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Server-side fetch for the saved-sessions dialog. Called on dialog open
 * so the list is fresh after rename / delete in the same session.
 */
export async function listSavedSessionsAction(
  characterId: string,
): Promise<SavedSessionListItem[]> {
  const userId = await getCurrentUserId();
  return listSavedSessions(userId, characterId);
}

/**
 * "保存并开启新对话" 用户视角:把当前对话归档进历史,然后立刻开一段新的。
 * 返回新 session id 让客户端 router.push 到 ?session= 跳过去(或不带 query
 * 直接走 find-or-create — 因为刚 INSERT 的 saved_at=null 一定是当前)。
 */
export async function saveAndStartNewAction(
  characterId: string,
): Promise<ActionResult<{ newSessionId: string }>> {
  const userId = await getCurrentUserId();
  const result = await saveCurrentAndStartNew(characterId, userId);
  if (!result) return { ok: false, error: "Character not found" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: result };
}

/**
 * "开启新对话(不保存)" 销毁当前临时对话,创建新的。破坏性,客户端必须先
 * confirm。
 */
export async function discardAndStartNewAction(
  characterId: string,
): Promise<ActionResult<{ newSessionId: string }>> {
  const userId = await getCurrentUserId();
  const result = await discardCurrentAndStartNew(characterId, userId);
  if (!result) return { ok: false, error: "Character not found" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: result };
}

export async function renameSessionAction(
  sessionId: string,
  title: string,
  characterId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const ok = await renameSession(sessionId, userId, title);
  if (!ok) return { ok: false, error: "Rename failed" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: null };
}

export async function deleteSavedSessionAction(
  sessionId: string,
  characterId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const ok = await deleteSavedSession(sessionId, userId);
  if (!ok) return { ok: false, error: "Delete failed" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: null };
}

/**
 * "回到此处重说" —— 从某个用户消息节点 fork(软归档),把该节点及其之后的
 * 消息标记为已归档。keepCount = 客户端消息数组里 fork 目标的下标(保留 [0,
 * keepCount))。详见 forkSessionAtMessage。返回归档条数供 UI toast。
 *
 * 客户端拿到 ok 后应同步 setMessages(prev => prev.slice(0, keepCount)),与
 * 服务端按序数对齐 —— 无需整页刷新。
 */
export async function deleteMessagePairAction(
  sessionId: string,
  characterId: string,
  assistantMsgId: string,
): Promise<ActionResult<{ deleted: number }>> {
  const userId = await getCurrentUserId();
  const result = await deleteMessagePair(sessionId, userId, assistantMsgId);
  if (!result.ok) return { ok: false, error: "Delete failed" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: { deleted: result.deleted } };
}

export async function forkAtMessageAction(
  sessionId: string,
  characterId: string,
  keepCount: number,
): Promise<ActionResult<{ archived: number }>> {
  const userId = await getCurrentUserId();
  const result = await forkSessionAtMessage(sessionId, userId, keepCount);
  if (!result.ok) return { ok: false, error: "Fork failed" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: { archived: result.archived } };
}

export async function updateUserMessageAction(
  sessionId: string,
  characterId: string,
  messageId: string,
  newContent: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const result = await updateUserMessage(
    sessionId,
    userId,
    messageId,
    newContent,
  );
  if (!result.ok) return { ok: false, error: "Update failed" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: null };
}

export async function updateAssistantMessageAction(
  sessionId: string,
  characterId: string,
  messageId: string,
  newContent: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const result = await updateAssistantMessage(
    sessionId,
    userId,
    messageId,
    newContent,
  );
  if (!result.ok) return { ok: false, error: "Update failed" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: null };
}

export async function deleteUserMessagePairAction(
  sessionId: string,
  characterId: string,
  userMsgId: string,
): Promise<ActionResult<{ deleted: number }>> {
  const userId = await getCurrentUserId();
  const result = await deleteUserMessagePair(sessionId, userId, userMsgId);
  if (!result.ok) return { ok: false, error: "Delete failed" };
  revalidatePath(`/chat/${characterId}`);
  return { ok: true, data: { deleted: result.deleted } };
}
