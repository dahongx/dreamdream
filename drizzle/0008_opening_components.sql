-- Opening components — a second kind of in-pack item alongside regex rules.
--
-- Unlike dialogue components (regex_rules), opening components are STATIC:
-- they match no model output (no pattern / no capture groups / no
-- output_guidance / never enter the system prompt). They render once per
-- session in a standalone opening slot and do not change across turns;
-- content is authored via a dedicated AI generator.
--
-- Access boundary (owner-private): an opening component does NOT propagate to
-- other creators who subscribe the pack — it only renders when the pack owner
-- equals the character owner (see loadCharacterOpeningComponents). Packs stay
-- reusable for dialogue components, but a creator's bespoke opening component
-- is a moat that never leaks to subscribers.
--
-- content render routing reuses the regex-segments convention
-- (segments.ts ARTIFACT_ENVELOPE_RE): `<artifact>…</artifact>` → iframe
-- sandbox, otherwise sanitize HTML.

CREATE TABLE "opening_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pack_id" uuid NOT NULL,
  "name" varchar(128) NOT NULL,
  "content" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "opening_components"
  ADD CONSTRAINT "opening_components_pack_id_fk"
  FOREIGN KEY ("pack_id") REFERENCES "beautification_packs"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX "opening_components_pack_order_idx"
  ON "opening_components" ("pack_id", "order_index");
