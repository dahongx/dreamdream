-- 消息软归档（fork / 对话回退）—— additive，非破坏。
--
-- 背景: messages 原本是纯线性会话，唯一的删除是 /api/chat regenerate 删末尾
-- AI 回复。用户需要「回到某节点重说演绎」。语义定为 fork 而非删除:
--   - 对用户: 看起来是截断(选中点之后的消息从对话里消失)
--   - 对底层日志: 非破坏 —— 那些行不真删，只打 superseded_at 标记保留
--   - fork 点只允许在用户输入气泡上(见 forkSessionAtMessage)
--
-- superseded_at: NULL = 活跃消息(正常渲染 / 喂模型 / 计数);非空 = 被 fork
-- 截断掉的旧分叉尾巴。所有读取处加 `superseded_at IS NULL` 过滤。
--
-- partial index: 活跃路径查询(loadMessages / regenerate / 历史会话计数)永远
-- 带 IS NULL 过滤，partial index 让旧分叉不拖慢热路径。对齐 chat_sessions
-- 的 partial unique 写法。
--
-- 幂等: IF NOT EXISTS，重复迁移无副作用。

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "superseded_at" timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_session_active_idx" ON "messages" ("session_id","created_at") WHERE "superseded_at" IS NULL;
