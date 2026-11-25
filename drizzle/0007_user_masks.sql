-- User-authored roleplay masks.
--
-- Masks are private player personas. A chat session can select one active
-- mask, and the selected mask is folded into the next system prompt.

CREATE TABLE "user_masks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "note" text,
  "name" varchar(128) NOT NULL,
  "gender" varchar(10),
  "description" text,
  "preference" text,
  "instruction" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "user_masks"
  ADD CONSTRAINT "user_masks_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX "user_masks_user_updated_idx"
  ON "user_masks" ("user_id", "updated_at" DESC);
--> statement-breakpoint

ALTER TABLE "chat_sessions"
  ADD COLUMN "active_mask_id" uuid;
--> statement-breakpoint

ALTER TABLE "chat_sessions"
  ADD CONSTRAINT "chat_sessions_active_mask_id_fk"
  FOREIGN KEY ("active_mask_id") REFERENCES "user_masks"("id") ON DELETE SET NULL;
