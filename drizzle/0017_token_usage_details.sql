-- Token usage details: add cache, reasoning, and cost columns to messages
-- Enables tracking of AI SDK v6 inputTokenDetails / outputTokenDetails
-- and per-message cost calculation for admin billing visibility.
ALTER TABLE "messages" ADD COLUMN "cache_read_tokens" integer;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "cache_write_tokens" integer;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reasoning_tokens" integer;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "cost_millicents" integer;
