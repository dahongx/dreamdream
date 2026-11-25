-- Per-model pricing config + audit history.
-- Prices stored as integer micro-USD per 1M tokens (1 USD = 1_000_000)
-- to avoid floating-point drift. messages.cost_millicents is computed
-- at write time, so historical messages stay frozen at the rate that
-- was current when they were written.
CREATE TABLE "model_prices" (
  "model_id" text PRIMARY KEY,
  "display_name" text NOT NULL,
  "input_per_m_tok_micro_usd" integer NOT NULL,
  "output_per_m_tok_micro_usd" integer NOT NULL,
  "cache_read_per_m_tok_micro_usd" integer NOT NULL,
  "cache_write_per_m_tok_micro_usd" integer NOT NULL,
  "reasoning_per_m_tok_micro_usd" integer NOT NULL,
  "notes" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "model_price_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "model_id" text NOT NULL,
  "display_name" text NOT NULL,
  "input_per_m_tok_micro_usd" integer NOT NULL,
  "output_per_m_tok_micro_usd" integer NOT NULL,
  "cache_read_per_m_tok_micro_usd" integer NOT NULL,
  "cache_write_per_m_tok_micro_usd" integer NOT NULL,
  "reasoning_per_m_tok_micro_usd" integer NOT NULL,
  "notes" text,
  "effective_from" timestamptz NOT NULL DEFAULT now(),
  "changed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "model_price_history_model_idx"
  ON "model_price_history" ("model_id", "effective_from");
--> statement-breakpoint
-- Seed current MODEL_PRICING (kept in sync with src/lib/ai/pricing.ts fallback).
-- Gemini cache_write = 0 (Google storage/hr, SDK doesn't report cache_write_tokens).
-- Gemini default-tier = >200K context (1× upcharge baked in, see pricing.ts note).
INSERT INTO "model_prices" (
  "model_id", "display_name",
  "input_per_m_tok_micro_usd", "output_per_m_tok_micro_usd",
  "cache_read_per_m_tok_micro_usd", "cache_write_per_m_tok_micro_usd",
  "reasoning_per_m_tok_micro_usd", "notes"
) VALUES
  ('claude-opus-4-7',              'Claude Opus 4.7',       5000000, 25000000,  500000, 6250000, 25000000, NULL),
  ('claude-sonnet-4-6',            'Claude Sonnet 4.6',     3000000, 15000000,  300000, 3750000, 15000000, NULL),
  ('claude-haiku-4-5-20251001',    'Claude Haiku 4.5',      1000000,  5000000,  100000, 1250000,  5000000, NULL),
  ('gemini-2.5-pro',               'Gemini 2.5 Pro',        2500000, 15000000,  250000,       0, 15000000, '默认按 >200K 长上下文档计价'),
  ('gemini-3.1-pro-preview',       'Gemini 3.1 Pro',        4000000, 18000000,  400000,       0, 18000000, '默认按 >200K 长上下文档计价'),
  ('deepseek-ai/DeepSeek-V4-Pro',  'DeepSeek V4 Pro',        435000,   870000,    3625,  435000,   870000, NULL);
--> statement-breakpoint
INSERT INTO "model_price_history" (
  "model_id", "display_name",
  "input_per_m_tok_micro_usd", "output_per_m_tok_micro_usd",
  "cache_read_per_m_tok_micro_usd", "cache_write_per_m_tok_micro_usd",
  "reasoning_per_m_tok_micro_usd", "notes",
  "effective_from"
)
SELECT
  "model_id", "display_name",
  "input_per_m_tok_micro_usd", "output_per_m_tok_micro_usd",
  "cache_read_per_m_tok_micro_usd", "cache_write_per_m_tok_micro_usd",
  "reasoning_per_m_tok_micro_usd", "notes",
  "updated_at"
FROM "model_prices";
