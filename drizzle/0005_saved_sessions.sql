-- 聊天对话保存机制：临时对话 vs 已保存对话
--
-- 加 chat_sessions.saved_at（nullable）：
--   null  = 当前临时对话（每用户每角色至多一条）
--   非空  = 已显式保存，出现在历史保存对话弹窗
--
-- unique 索引改成 partial：仅约束未保存的（saved_at IS NULL）。
-- 已保存的对话可以无数条共存。
--
-- 同时清理 dev DB 残留的 archived_at 字段 + 相关索引（schema.ts 从来没引用过,
-- 是早期 ad-hoc 改动留下的孤儿；它的 active partial unique 会阻止同角色多
-- 个 saved 行）。Pre-launch 无真实数据,destructive 可接受。

ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "saved_at" timestamptz;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_sessions_user_character_uidx";
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_sessions_user_character_active_uidx";
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_sessions_user_character_archived_idx";
--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN IF EXISTS "archived_at";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_sessions_user_char_current_uidx"
  ON "chat_sessions" ("user_id", "character_id")
  WHERE "saved_at" IS NULL;
