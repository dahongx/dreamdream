-- Per-model USD→CNY exchange rate + per-message CNY snapshot.
-- Rate stored as integer micro (rate × 1_000_000) e.g. 7.2 → 7_200_000.
-- messages.cost_cny_millicents is frozen at write time so historical
-- aggregations stay consistent across rate changes.
ALTER TABLE "model_prices"
  ADD COLUMN "usd_cny_rate_micro" integer NOT NULL DEFAULT 7200000;
--> statement-breakpoint
ALTER TABLE "model_price_history"
  ADD COLUMN "usd_cny_rate_micro" integer NOT NULL DEFAULT 7200000;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "cost_cny_millicents" integer;
--> statement-breakpoint
-- Backfill historical rows with the legacy hardcoded 7.2 display rate.
-- That matches what was being shown by formatCostCny in pre-rate code,
-- so aggregations stay numerically identical for past data.
UPDATE "messages"
   SET "cost_cny_millicents" = ROUND("cost_millicents" * 7.2)
 WHERE "cost_millicents" IS NOT NULL;
