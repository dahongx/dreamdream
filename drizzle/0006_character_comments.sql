-- Character comment threads for detail cards.
--
-- Replaces the modal beautification preview with a real community surface:
-- visitors can leave root comments, reply to other users / the creator, and
-- like individual comments. Comment bodies are user-authored only; no prompt
-- material is exposed here.

CREATE TABLE "character_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "parent_id" uuid,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "character_comments"
  ADD CONSTRAINT "character_comments_character_id_fk"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "character_comments"
  ADD CONSTRAINT "character_comments_author_id_fk"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "character_comments"
  ADD CONSTRAINT "character_comments_parent_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "character_comments"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX "character_comments_thread_idx"
  ON "character_comments" ("character_id", "parent_id", "created_at");
--> statement-breakpoint

CREATE TABLE "character_comment_likes" (
  "comment_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "character_comment_likes_comment_id_user_id_pk"
    PRIMARY KEY ("comment_id", "user_id")
);
--> statement-breakpoint

ALTER TABLE "character_comment_likes"
  ADD CONSTRAINT "character_comment_likes_comment_id_fk"
  FOREIGN KEY ("comment_id") REFERENCES "character_comments"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "character_comment_likes"
  ADD CONSTRAINT "character_comment_likes_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX "character_comment_likes_user_idx"
  ON "character_comment_likes" ("user_id");
