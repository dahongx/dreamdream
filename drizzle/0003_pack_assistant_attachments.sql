-- Studio AI 助手附件支持：user 消息可附带至多 4 张参考图。
-- jsonb 存 [{url, mimeType, size}, ...]，无附件保持 NULL（比 '[]' 省存储）。
-- 旧行无需 backfill —— null 即默认。

ALTER TABLE "pack_assistant_messages" ADD COLUMN "attachments" jsonb;
