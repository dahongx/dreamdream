-- Migration: Create model_currency_prices table for gold/silver pricing per model
-- Initial config: all models cost 1 gold OR 2 silver per message

CREATE TABLE "model_currency_prices" (
  "model_id" text PRIMARY KEY NOT NULL,
  "gold_price" integer NOT NULL DEFAULT 1,
  "silver_price" integer NOT NULL DEFAULT 2,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Seed initial prices for all existing models
INSERT INTO "model_currency_prices" ("model_id", "gold_price", "silver_price") VALUES
  ('claude-opus-4-7', 1, 2),
  ('claude-sonnet-4-6', 1, 2),
  ('claude-haiku-4-5-20251001', 1, 2),
  ('gemini-3.1-pro-preview', 1, 2),
  ('gemini-3-flash', 1, 2),
  ('gemini-3.5-flash', 1, 2),
  ('deepseek-ai/DeepSeek-V4-Pro', 1, 2)
ON CONFLICT (model_id) DO NOTHING;

COMMENT ON TABLE "model_currency_prices" IS 'Gold and silver pricing per AI model';
COMMENT ON COLUMN "model_currency_prices"."gold_price" IS 'Gold coins required per message';
COMMENT ON COLUMN "model_currency_prices"."silver_price" IS 'Silver coins required per message';
