-- Anonymous operational events for the user-facing model health indicator.
-- No user, session, message or prompt content is stored here.
CREATE TABLE IF NOT EXISTS "model_request_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_id" varchar(64) NOT NULL,
  "outcome" text NOT NULL,
  "ttft_ms" integer,
  "duration_ms" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_request_events_outcome_check"
    CHECK ("outcome" IN ('success', 'failure')),
  CONSTRAINT "model_request_events_ttft_check"
    CHECK ("ttft_ms" IS NULL OR "ttft_ms" >= 0),
  CONSTRAINT "model_request_events_duration_check"
    CHECK ("duration_ms" >= 0)
);

CREATE INDEX IF NOT EXISTS "model_request_events_model_created_idx"
  ON "model_request_events" ("model_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "model_request_events_created_idx"
  ON "model_request_events" ("created_at");

ALTER TABLE "model_request_events" ENABLE ROW LEVEL SECURITY;
