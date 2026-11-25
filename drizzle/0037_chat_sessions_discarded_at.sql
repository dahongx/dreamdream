-- 把「开启新对话（不保存）」从硬删除改成软删除。
--
-- 背景：`discardCurrentAndStartNew` 之前对 chat_sessions 执行 DELETE，通过
-- 外键 CASCADE 把 messages 全带走，用户点错一次就永久丢失日志（本迁移的
-- 直接触发事件：婉清 2026-07-06 session 235047ae 的 3 条消息不可恢复）。
--
-- 改造为软删除：新增 `discarded_at` 字段，discard 动作只打时间戳。
-- 侧栏 / find-or-create / 收藏预览等「取当前 session」查询统一加
-- `discarded_at IS NULL` 过滤；partial unique 索引也带上，保证同 (user,
-- character) 仍然至多一条「未归档 & 未丢弃」session。
--
-- discarded 的 session 通过 URL 精确 id 仍可加载（loadSessionById 不加
-- 过滤），充当「回收站」入口 —— 客户端记得住 id 就能找回。物理清理留给
-- 后续 cron（不在本迁移里做）。

ALTER TABLE chat_sessions
  ADD COLUMN discarded_at TIMESTAMPTZ;

-- 旧的 partial unique：WHERE saved_at IS NULL
-- 新的 partial unique：WHERE saved_at IS NULL AND discarded_at IS NULL
--
-- 分开 DROP + CREATE，是因为 CREATE INDEX 不支持 IF NOT EXISTS 时改 WHERE。
DROP INDEX IF EXISTS chat_sessions_user_char_current_uidx;

CREATE UNIQUE INDEX chat_sessions_user_char_current_uidx
  ON chat_sessions (user_id, character_id)
  WHERE saved_at IS NULL AND discarded_at IS NULL;

-- 便于 admin / cron 巡检回收站
CREATE INDEX chat_sessions_discarded_at_idx
  ON chat_sessions (discarded_at)
  WHERE discarded_at IS NOT NULL;
