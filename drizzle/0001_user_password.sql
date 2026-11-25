-- Add password authentication via Auth.js Credentials provider.
-- Pre-launch: no real users to migrate. email becomes optional (kept for
-- future password reset / contact / OAuth association), username + password_hash
-- become the login credentials.

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;
--> statement-breakpoint
-- The previous "dev@yearn.local" seed had no password; clear it so a fresh
-- /signup is the only way in.
DELETE FROM "users" WHERE "email" = 'dev@yearn.local' AND "password_hash" IS NULL;
