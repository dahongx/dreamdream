-- 货币体系：金币 + 银币
-- 金币通过充值获得，银币每天登录送 30
-- 调用模型消耗金币或银币（可配置）

-- 1. 扩展 users 表：添加金币、银币余额和上次领取日期
ALTER TABLE users ADD COLUMN gold_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN silver_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_daily_claim_date DATE;

-- 2. 扩展 model_prices 表：添加每次调用消耗的金币/银币数量
ALTER TABLE model_prices ADD COLUMN gold_cost_per_call INTEGER NOT NULL DEFAULT 0;
ALTER TABLE model_prices ADD COLUMN silver_cost_per_call INTEGER NOT NULL DEFAULT 0;

-- 3. 新增货币交易记录表
CREATE TABLE currency_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 交易类型: daily_claim(每日领取), recharge(充值), model_usage(模型消耗)
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('daily_claim', 'recharge', 'model_usage')),
  -- 货币类型: gold(金币), silver(银币)
  currency_type TEXT NOT NULL CHECK (currency_type IN ('gold', 'silver')),
  -- 变动数量（正数表示增加，负数表示减少）
  amount INTEGER NOT NULL,
  -- 交易后余额快照
  balance_after INTEGER NOT NULL,
  -- 关联的模型 ID（仅 model_usage 类型有值）
  model_id TEXT,
  -- 关联的消息 ID（仅 model_usage 类型有值）
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  -- 备注信息
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引：按用户 + 时间查询交易记录
CREATE INDEX currency_transactions_user_created_idx ON currency_transactions(user_id, created_at DESC);

-- 索引：按类型查询
CREATE INDEX currency_transactions_type_idx ON currency_transactions(user_id, transaction_type, created_at DESC);

-- 为现有模型设置默认消耗配置（银币 1 枚/次，金币 0）
UPDATE model_prices SET
  gold_cost_per_call = 0,
  silver_cost_per_call = 1
WHERE model_id IN (
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'gemini-3.1-pro-preview',
  'gemini-3-flash',
  'gemini-3.5-flash',
  'deepseek-ai/DeepSeek-V4-Pro'
);

-- 给所有现有用户初始赠送 100 银币
UPDATE users SET silver_coins = 100 WHERE silver_coins = 0;
