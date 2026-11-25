-- Migration: Add gold and silver currency balances to users
-- Default: 100 gold and 200 silver for all users

ALTER TABLE "users" ADD COLUMN "gold_balance" integer NOT NULL DEFAULT 100;
ALTER TABLE "users" ADD COLUMN "silver_balance" integer NOT NULL DEFAULT 200;

-- Backfill existing users with default balances (already handled by DEFAULT)
COMMENT ON COLUMN "users"."gold_balance" IS 'Gold currency balance for premium model usage';
COMMENT ON COLUMN "users"."silver_balance" IS 'Silver currency balance for standard model usage';
