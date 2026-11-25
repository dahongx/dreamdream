-- Studio sessions can now target an opening component for editing.
--
-- Opening components join the studio AI-session model as a third session type
-- (type="opening", alongside "css" and "component"). The `type` column is a
-- plain text column so widening its TS union needs no DB change; this migration
-- only adds the edit-target FK, mirroring target_rule_id for regex rules.
-- New opening sessions leave it null (create); editing an existing component
-- sets it. ON DELETE SET NULL keeps session history if the component is removed.

ALTER TABLE "studio_sessions"
  ADD COLUMN "target_opening_component_id" uuid;
--> statement-breakpoint

ALTER TABLE "studio_sessions"
  ADD CONSTRAINT "studio_sessions_target_opening_component_id_fk"
  FOREIGN KEY ("target_opening_component_id")
  REFERENCES "opening_components"("id") ON DELETE SET NULL;
