-- Studio AI 助手重构：单产物 session 模型
-- 一个 session = 一个产物（CSS 主题 OR 一条 regex_rule），多轮聊到满意
-- 后点「确认应用」一次性入库。pack_assistant_messages 现在挂到 session
-- 而不是 (user, pack) —— 让每个 session 有独立历史。
--
-- Pre-launch：无真实用户数据，pack_assistant_messages 直接 TRUNCATE。
-- 不做 backfill，不保留 legacy。schema-only migration，不级联用户表。

CREATE TABLE "studio_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "pack_id" uuid NOT NULL,
  "type" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "title" text,
  "target_rule_id" uuid,
  "draft_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "studio_sessions"
  ADD CONSTRAINT "studio_sessions_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "studio_sessions"
  ADD CONSTRAINT "studio_sessions_pack_id_fk"
  FOREIGN KEY ("pack_id") REFERENCES "beautification_packs"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "studio_sessions"
  ADD CONSTRAINT "studio_sessions_target_rule_id_fk"
  FOREIGN KEY ("target_rule_id") REFERENCES "regex_rules"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX "studio_sessions_pack_idx"
  ON "studio_sessions" ("user_id", "pack_id", "status", "updated_at");
--> statement-breakpoint

-- pack_assistant_messages: re-key 到 session_id
-- pre-launch 直接清空老数据
TRUNCATE TABLE "pack_assistant_messages";
--> statement-breakpoint

DROP INDEX IF EXISTS "pack_assistant_msgs_pack_idx";
--> statement-breakpoint

ALTER TABLE "pack_assistant_messages" DROP COLUMN "user_id";
--> statement-breakpoint

ALTER TABLE "pack_assistant_messages" DROP COLUMN "pack_id";
--> statement-breakpoint

ALTER TABLE "pack_assistant_messages"
  ADD COLUMN "session_id" uuid NOT NULL;
--> statement-breakpoint

ALTER TABLE "pack_assistant_messages"
  ADD CONSTRAINT "pack_assistant_messages_session_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "studio_sessions"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX "pack_assistant_msgs_session_idx"
  ON "pack_assistant_messages" ("session_id", "created_at");
