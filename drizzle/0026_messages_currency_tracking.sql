-- Migration: Add currency tracking to messages table
-- Tracks which currency (gold/silver) was deducted for each AI message

ALTER TABLE "messages" ADD COLUMN "currency_type" text;
ALTER TABLE "messages" ADD COLUMN "currency_amount" integer;

COMMENT ON COLUMN "messages"."currency_type" IS 'Currency used for this message: gold or silver';
COMMENT ON COLUMN "messages"."currency_amount" IS 'Amount of currency deducted for this message';
