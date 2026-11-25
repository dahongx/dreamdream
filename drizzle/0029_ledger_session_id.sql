-- 货币流水加 session_id 冗余列
-- 背景：聊天/续写扣费流水之前只挂 message_id，靠 LEFT JOIN messages → chat_sessions
-- → characters 拿角色名。当流式 onError 触发时，扣费已写入但 message 未入库，
-- message_id 永远 NULL，账本 UI 只能显示「聊天」少了「- 角色名」。
-- 冗余 session_id 后，扣费时直接写 session_id，UI JOIN chat_sessions 即可拿到角色名，
-- 与 message 是否存在解耦。

ALTER TABLE currency_transactions
  ADD COLUMN session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL;
