/**
 * 「这段会话还打得开吗」的唯一判据。
 *
 * 从 listSessionsForUser 里抽出来是因为它现在有三种成因，散在查询映射里读不出
 * 意图，也没法单测：
 *
 *   1. 角色公开 / 不列出        → 可访问
 *   2. 角色私密但卡是自己的      → 可访问（作者随时能进自己的卡）
 *   3. 角色私密且不是自己的      → 不可访问（曾聊过的公开卡被作者改私密）
 *   4. 角色行没了（characterId 为 null）→ 不可访问
 *
 * 第 4 种是账号注销带来的：创作者注销会删掉他的角色卡，migration 0042 把
 * chat_sessions.character_id 改成 SET NULL，于是**其他用户**跟这些卡的会话
 * 变成「孤儿」保留下来 —— 记录完整在库，但没有角色行就没有 system prompt /
 * 正则 / 开场，续不了。列表里跟第 3 种共用同一套灰条 UI，只换文案。
 */
export interface SessionAccessInput {
  characterId: string | null;
  characterVisibility: "public" | "private" | "unlisted" | null;
  characterOwnerId: string | null;
}

export function isSessionAccessible(
  row: SessionAccessInput,
  userId: string,
): boolean {
  if (row.characterId === null) return false;
  return (
    row.characterVisibility !== "private" || row.characterOwnerId === userId
  );
}
