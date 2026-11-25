-- Add per-code daily usage limit for beta testers
ALTER TABLE "invite_codes" ADD COLUMN "daily_limit" integer DEFAULT 200 NOT NULL;
