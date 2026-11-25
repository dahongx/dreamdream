-- 角色卡聊天去 session 化：一个 (user, character) = 一段持续对话。
-- 应用层 find-or-create + DB 唯一索引兜底。
--
-- Pre-launch：dev DB 里可能有同 (user, character) 的重复 session 行。
-- 保留每组里 last_message_at 最新的一行，其余删掉（messages 通过 FK
-- ON DELETE CASCADE 一并清理）。无真实用户，destructive 可接受。

DELETE FROM "chat_sessions" AS cs
WHERE EXISTS (
  SELECT 1 FROM "chat_sessions" AS keeper
  WHERE keeper.user_id = cs.user_id
    AND keeper.character_id = cs.character_id
    AND (
      keeper.last_message_at > cs.last_message_at
      OR (keeper.last_message_at = cs.last_message_at AND keeper.id > cs.id)
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_user_character_uidx"
  ON "chat_sessions" ("user_id", "character_id");
