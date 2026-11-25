CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text,
  "email" text NOT NULL,
  "email_verified" timestamp with time zone,
  "image" text,
  "username" varchar(64),
  "display_name" varchar(128),
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY ("provider", "provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
  "session_token" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp with time zone NOT NULL,
  CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY ("identifier", "token")
);
--> statement-breakpoint
CREATE TABLE "beautification_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(128) NOT NULL,
  "description" text,
  "global_css" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "subscriber_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(128) NOT NULL,
  "gender" text DEFAULT 'unset' NOT NULL,
  "age" integer,
  "nsfw" boolean DEFAULT false NOT NULL,
  "is_ai" boolean DEFAULT false NOT NULL,
  "content_type" text DEFAULT 'original' NOT NULL,
  "cover_image_url" text,
  "avatar_url" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "bio" text,
  "visibility" text DEFAULT 'private' NOT NULL,
  "persona" text DEFAULT '' NOT NULL,
  "adversity" text,
  "default_cognition" text,
  "opening" text,
  "plot_setting" text,
  "output_setting" text,
  "sample_dialogue" text,
  "conversation_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "character_id" uuid NOT NULL REFERENCES "characters"("id") ON DELETE cascade,
  "title" varchar(256),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "chat_sessions"("id") ON DELETE cascade,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "rendered_html" text,
  "model" varchar(64),
  "tokens_in" integer,
  "tokens_out" integer,
  "latency_ms" integer,
  "debug_info" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_pack_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" uuid NOT NULL REFERENCES "characters"("id") ON DELETE cascade,
  "pack_id" uuid NOT NULL REFERENCES "beautification_packs"("id") ON DELETE cascade,
  "order_index" integer NOT NULL,
  "css_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regex_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pack_id" uuid NOT NULL REFERENCES "beautification_packs"("id") ON DELETE cascade,
  "name" varchar(128) NOT NULL,
  "target_text" text,
  "pattern" text NOT NULL,
  "replacement" text NOT NULL,
  "variable_mapping" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "output_guidance" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "visible" boolean DEFAULT false NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_rule_overrides" (
  "subscription_id" uuid NOT NULL REFERENCES "character_pack_subscriptions"("id") ON DELETE cascade,
  "rule_id" uuid NOT NULL REFERENCES "regex_rules"("id") ON DELETE cascade,
  "disabled" boolean NOT NULL,
  CONSTRAINT "subscription_rule_overrides_subscription_id_rule_id_pk" PRIMARY KEY ("subscription_id", "rule_id")
);
--> statement-breakpoint
CREATE TABLE "pack_assistant_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "pack_id" uuid NOT NULL REFERENCES "beautification_packs"("id") ON DELETE cascade,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_regex_preferences" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "regex_rule_id" uuid NOT NULL REFERENCES "regex_rules"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT true NOT NULL,
  CONSTRAINT "user_regex_preferences_user_id_regex_rule_id_pk" PRIMARY KEY ("user_id", "regex_rule_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" ("username");
--> statement-breakpoint
CREATE INDEX "packs_owner_idx" ON "beautification_packs" ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "packs_public_hot_idx" ON "beautification_packs" ("is_public", "subscriber_count");
--> statement-breakpoint
CREATE INDEX "characters_visibility_created_idx" ON "characters" ("visibility", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "characters_owner_idx" ON "characters" ("owner_id");
--> statement-breakpoint
CREATE INDEX "chat_sessions_user_idx" ON "chat_sessions" ("user_id", "last_message_at" DESC);
--> statement-breakpoint
CREATE INDEX "messages_session_created_idx" ON "messages" ("session_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "char_pack_sub_uidx" ON "character_pack_subscriptions" ("character_id", "pack_id");
--> statement-breakpoint
CREATE INDEX "char_pack_sub_order_idx" ON "character_pack_subscriptions" ("character_id", "order_index");
--> statement-breakpoint
CREATE INDEX "regex_rules_pack_order_idx" ON "regex_rules" ("pack_id", "order_index");
--> statement-breakpoint
CREATE INDEX "pack_assistant_msgs_pack_idx" ON "pack_assistant_messages" ("user_id", "pack_id", "created_at");