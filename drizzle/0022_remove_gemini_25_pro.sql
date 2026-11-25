-- 下架 gemini-2.5-pro：从 model_prices 表移除，admin /settings 不再展示。
--
-- 安全性：
-- - messages.cost_millicents 是写入时锁价，历史 6 条消息（$0.638）的成本
--   字段已经存进库，不依赖 model_prices 表，aggregation 不受影响。
-- - model_price_history 保留 06-21 那条 seed 记录，作为审计轨迹。
-- - 后续如果再跑 scripts/backfill-message-cost.ts，因为 src/lib/ai/pricing.ts
--   的 FALLBACK_PRICING 也同步移除了 gemini-2.5-pro，calculateCostMillicents
--   会返回 0 → 6 条历史会被归零。可接受（金额小，且属于用户主动下架决策）。
DELETE FROM "model_prices" WHERE "model_id" = 'gemini-2.5-pro';
