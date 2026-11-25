CREATE TABLE IF NOT EXISTS "platform_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "notification_type" text DEFAULT 'announcement' NOT NULL,
  "created_by" uuid,
  "target_user_id" uuid,
  "title" varchar(120) NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "platform_notifications_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "platform_notifications_target_user_id_users_id_fk"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "platform_notifications_type_check"
    CHECK ("notification_type" IN ('announcement', 'reminder'))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "platform_notifications_created_idx"
  ON "platform_notifications" ("created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "platform_notifications_target_created_idx"
  ON "platform_notifications" ("target_user_id", "created_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_notification_reads" (
  "user_id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "read_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "user_notification_reads_user_id_notification_id_pk"
    PRIMARY KEY ("user_id", "notification_id"),
  CONSTRAINT "user_notification_reads_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_notification_reads_notification_id_platform_notifications_id_fk"
    FOREIGN KEY ("notification_id") REFERENCES "platform_notifications"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_notification_reads_user_read_idx"
  ON "user_notification_reads" ("user_id", "read_at" DESC);
--> statement-breakpoint

ALTER TABLE "platform_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "user_notification_reads" ENABLE ROW LEVEL SECURITY;
