-- 货币流水加 operator_id
-- 背景：admin 在 /admin > 充值 tab 给用户充值金币时，需要在账本里记录是哪个
-- 管理员操作的（审计 + 当事用户在自己钱包里也能看到充值来源）。
-- 之前临时把 admin email 拼到 note 字段的尾部（"... (by xxx@yy.com)"），属于
-- 结构性数据塞到非结构化字段里 —— 解析脆，迁移痛。补一列结构化字段。
--
-- 语义：
--   - operator_id 仅在「transaction_type=recharge 且由管理员手动操作」时填
--     当前 admin 的 user_id；其余（daily_claim / model_usage）保持 NULL。
--   - ON DELETE SET NULL：admin 账号被删时，旧充值流水保留金额信息但操作员
--     字段置空（前端兜底显示"（已离职 admin）"）。

ALTER TABLE currency_transactions
  ADD COLUMN operator_id UUID REFERENCES users(id) ON DELETE SET NULL;
