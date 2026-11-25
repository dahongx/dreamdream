-- 0031 之前的扣费行没有 currency_transactions.cost_cny_millicents，账本 UI
-- 当时靠 LEFT JOIN messages.cost_cny_millicents 兜底。问题：messages.cost
-- 是「这条 assistant 消息从首次聊天到所有续写的累计成本」（见 continue
-- route.ts 里的 `(lastAssistant.costCnyMillicents ?? 0) + costCny`），不是
-- 单次调用的成本。结果：一条 message 上有 N 次续写时，N+1 条流水行都 JOIN
-- 回同一个累计值，账本里同一笔费用看着像被重复算了 N+1 次。
--
-- 本 migration 回填两步：
--   1. UI 端已经移除 messages.cost 的 fallback（buildLedger 改成只读
--      currency_transactions.cost_cny_millicents），所以老数据要么靠这里
--      回填，要么显示「—」。
--   2. 只回填能确定单次归属的 case：messageId 上只有 1 条 deduct（amount<0）
--      流水。
--      - 单轮聊天（没续写）→ messages.cost == 那一次聊天的真实 cost → 安全
--        拷贝到流水。
--      - 含 N 次续写的多轮 → messages.cost == 累计，无法准确还原到每一笔 →
--        本 migration 跳过；UI 显示「—」，admin 想细究只能从 messages 表
--        / token 数自己分摊。
--
-- 不在 backfill 范围：refund 行（amount>0）—— 它们配对的 cost 由 UI 端
-- buildLedger 在内存里反推（见 src/lib/admin/recharge.ts 退款反推逻辑）。

UPDATE currency_transactions ct
SET cost_cny_millicents = m.cost_cny_millicents
FROM messages m
WHERE ct.message_id = m.id
  AND ct.cost_cny_millicents IS NULL
  AND ct.amount < 0
  AND m.cost_cny_millicents IS NOT NULL
  AND ct.message_id IN (
    SELECT message_id
    FROM currency_transactions
    WHERE message_id IS NOT NULL
      AND amount < 0
    GROUP BY message_id
    HAVING COUNT(*) = 1
  );
