-- 清空所有用户的金币银币 —— 付费测试阶段启动前的一次性操作
-- Migration: 0041

-- 将所有用户的金币和银币余额清零
UPDATE users
SET
  gold_balance = 0,
  silver_balance = 0;

-- 验证：检查清空结果（注释掉，仅供参考）
-- SELECT
--   COUNT(*) as total_users,
--   SUM(gold_balance) as total_gold,
--   SUM(silver_balance) as total_silver
-- FROM users;
