-- 2026-09-17 接入中转 Gemini 全系（13 个新档位）。
--
-- 背景：用户要求把中转 /v1/models 里所有能用的 Gemini 都放进 picker，展示原始
-- model id。实测 20 个 gemini id 中 17 个真能出话（3 个 3.5-flash 系已下线，
-- 见 models.ts 的 HIDDEN_MODEL_IDS 说明），其中 3.1-flash-image 回的是纯文本
-- 不是图，按聊天模型上架没有意义，故本次只接入 13 个新 id（plus 3 个已在
-- 注册表里的旧档位，无需重新定价）。
--
-- 价格说明（重要）：这批 id 不在 Google 官方价目表里，中转也没给价目接口。
-- **产品决定：13 个新档位一律按 gemini-3.1-pro-preview 同价**，不按 Pro / Flash
-- 分档 —— 用户看到的「Gemini 家族」扣费保持一致，不会因为挑了 Flash 变便宜：
--   - USD $4 in / $18 out / cache read $0.40 / cache write 0，走 >200K 保守档
--     （同该模型的既有约定）。
--   - thinking-128 / low / high / medium 只是思考预算不同，per-token 单价一样；
--     预算影响的是 reasoning token 数量，会通过 reasoning tokens 自然计进成本。
--   - 真实 Google 价大概率比这低（官方 Flash 档只要 $0.50–$1.50 in），所以这套
--     价格是**偏高**的保守值。要改成真实成本价，走 /settings 计费配置覆盖。
--
-- gold/silver per-call 必须显式写：0024 给这两列加的默认值是 **0**（不是 schema.ts
-- 里写的 1/2），不带这一列插进去 = 新模型免费（列默认 0）。这里跟存量 Gemini 档位
-- 一致写 gold=1 / silver=2。跑数后再按实际成本分档调。
-- ON CONFLICT DO NOTHING 是防御性：admin 若已在 /settings 手动加过同 model_id，
-- 本迁移幂等。
INSERT INTO "model_prices" (
  "model_id", "display_name",
  "input_per_m_tok_micro_usd", "output_per_m_tok_micro_usd",
  "cache_read_per_m_tok_micro_usd", "cache_write_per_m_tok_micro_usd",
  "reasoning_per_m_tok_micro_usd", "notes",
  "gold_cost_per_call", "silver_cost_per_call"
) VALUES
  ('gemini-3.1-pro-preview-thinking-128', 'Gemini 3.1 Pro (thinking-128)',  4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision', 1, 2),
  ('gemini-3.1-pro-low',                  'Gemini 3.1 Pro (low)',           4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision', 1, 2),
  ('gemini-3-flash-thinking-128',         'Gemini 3 Flash (thinking-128)',  4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.1-flash',                    'Gemini 3.1 Flash',               4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.6-flash',                    'Gemini 3.6 Flash',               4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.6-flash-high',               'Gemini 3.6 Flash (high)',        4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.7-flash',                    'Gemini 3.7 Flash',               4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.7-flash-high',               'Gemini 3.7 Flash (high)',        4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.7-flash-medium',             'Gemini 3.7 Flash (medium)',      4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.7-flash-low',                'Gemini 3.7 Flash (low)',         4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.7-flash-tiered',             'Gemini 3.7 Flash (tiered)',      4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.8-flash',                    'Gemini 3.8 Flash',               4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2),
  ('gemini-3.8-flash-high',               'Gemini 3.8 Flash (high)',        4000000, 18000000, 400000, 0, 18000000, 'placeholder: aligned to gemini-3.1-pro-preview per product decision',       1, 2)
ON CONFLICT ("model_id") DO NOTHING;
--> statement-breakpoint
-- 审计表补一行首价快照，跟 0019 / 0021 的写法一致：只给「历史表里还没有任何
-- 记录」的 model_id 补，避免重复插。
INSERT INTO "model_price_history" (
  "model_id", "display_name",
  "input_per_m_tok_micro_usd", "output_per_m_tok_micro_usd",
  "cache_read_per_m_tok_micro_usd", "cache_write_per_m_tok_micro_usd",
  "reasoning_per_m_tok_micro_usd", "notes",
  "effective_from", "usd_cny_rate_micro"
)
SELECT
  "model_id", "display_name",
  "input_per_m_tok_micro_usd", "output_per_m_tok_micro_usd",
  "cache_read_per_m_tok_micro_usd", "cache_write_per_m_tok_micro_usd",
  "reasoning_per_m_tok_micro_usd", "notes",
  "updated_at", "usd_cny_rate_micro"
FROM "model_prices"
WHERE "model_id" IN (
  'gemini-3.1-pro-preview-thinking-128', 'gemini-3.1-pro-low',
  'gemini-3-flash-thinking-128', 'gemini-3.1-flash',
  'gemini-3.6-flash', 'gemini-3.6-flash-high',
  'gemini-3.7-flash', 'gemini-3.7-flash-high', 'gemini-3.7-flash-medium',
  'gemini-3.7-flash-low', 'gemini-3.7-flash-tiered',
  'gemini-3.8-flash', 'gemini-3.8-flash-high'
)
  AND NOT EXISTS (
    SELECT 1 FROM "model_price_history" h
    WHERE h."model_id" = "model_prices"."model_id"
  );
