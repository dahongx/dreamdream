-- Add Gemini 3 Flash + Gemini 3.5 Flash to model_prices.
--
-- Flash 系列单档计价（没有 ≤200K / >200K 分档），cache_read = input × 10%；
-- cache_write = 0（Google 按 storage/hr 收费，且 SDK 不上报 cache_write_tokens）。
--
-- 价格来源 (ai.google.dev/gemini-api/docs/pricing)：
--   gemini-3-flash:    $0.50 input / $3.00 output / $0.05 cache hit
--   gemini-3.5-flash:  $1.50 input / $9.00 output / $0.15 cache hit
--
-- 走 zhengmi 中转 (provider.ts:NIMIR_GOOGLE_BASE_URL)，跟 Gemini 2.5/3.1 共用 key。
-- ON CONFLICT 是防御性：如果 admin 已经在 /settings 手动加过同 model_id，让本迁移幂等。
INSERT INTO "model_prices" (
  "model_id", "display_name",
  "input_per_m_tok_micro_usd", "output_per_m_tok_micro_usd",
  "cache_read_per_m_tok_micro_usd", "cache_write_per_m_tok_micro_usd",
  "reasoning_per_m_tok_micro_usd", "notes"
) VALUES
  ('gemini-3-flash',    'Gemini 3 Flash',    500000, 3000000,  50000, 0, 3000000, NULL),
  ('gemini-3.5-flash',  'Gemini 3.5 Flash', 1500000, 9000000, 150000, 0, 9000000, NULL)
ON CONFLICT ("model_id") DO NOTHING;
--> statement-breakpoint
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
WHERE "model_id" IN ('gemini-3-flash', 'gemini-3.5-flash')
  AND NOT EXISTS (
    SELECT 1 FROM "model_price_history" h
    WHERE h."model_id" = "model_prices"."model_id"
  );
