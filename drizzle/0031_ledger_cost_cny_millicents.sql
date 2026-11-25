-- 货币流水加 cost_cny_millicents
-- 背景：之前账本 UI 的「模型成本」一列是从 messages.cost_cny_millicents JOIN
-- 出来的，只有 transaction.message_id 链上的行才有值。结果：
--   1) 美化包 / 图片生成：无消息载体，message_id = NULL，cost 永远裸；
--   2) 聊天 onError 路径：扣费写在流式开始前，message 永远没入库，cost 也裸；
--   3) 老数据：cost 字段后加，迁前不一定有；
-- ledger 里大片「—」无法解释，admin 不知道哪些是「真没有」哪些是「设计漏」。
--
-- 解法：在 currency_transactions 自己加一列存「这笔扣费对应的真实 CNY 成本
-- snapshot」，写入侧（chat / continue / generate / images）在拿到 usage 后
-- 调用 settleTransactionCost 把数填回。
--   - 历史 chat 数据仍能用 messages JOIN 兜底（UI 端 COALESCE）。
--   - 失败 / 退款行保持 NULL；账本 UI 另做配对推断（参见 buildLedger 的
--     refund→deduct 反推逻辑）。

ALTER TABLE currency_transactions
  ADD COLUMN cost_cny_millicents INTEGER;
