/**
 * Server-side queries for opening_components. Pure reads; mutations live in
 * actions.ts.
 *
 * Opening components are STATIC in-pack items (no regex, no system prompt).
 * They render once per session in the standalone opening slot. See schema.ts
 * for the full rationale.
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { OpeningComponent } from "@/lib/db/schema";
import {
  beautificationPacks,
  characterOpeningSlotValues,
  characterPackSubscriptions,
  characters,
  openingComponentOverrides,
  openingComponents,
} from "@/lib/db/schema";

/** An opening component plus the per-character slot values to fill its {{...}}. */
export type OpeningComponentWithSlots = OpeningComponent & {
  slotValues: Record<string, string>;
};

/**
 * Load the opening components that should render for a character, aggregated
 * across its subscribed packs and ordered by subscription.orderIndex then
 * component.orderIndex.
 *
 * Per-component toggle: applies opening_component_overrides (creator-level
 * per-character disable), mirroring loadCharacterRules. A component is hidden
 * when its override row has disabled=true.
 *
 * Slot values: each returned component carries the character's filled-in slot
 * values (character_opening_slot_values), keyed by slot name. OpeningSlot feeds
 * these to interpolateOpening so {{日记正文}} etc. resolve per character.
 *
 * owner-private boundary (the one behavior that differs from regex rules):
 * only components from packs whose owner === the character's owner are
 * returned. A character that subscribes someone else's public pack gets that
 * pack's dialogue components (regex rules) but NOT its opening components —
 * a creator's bespoke opening stays a moat and never leaks to subscribers.
 */
export async function loadCharacterOpeningComponents(
  characterId: string,
): Promise<OpeningComponentWithSlots[]> {
  const rows = await db
    .select({
      component: openingComponents,
      disabled: openingComponentOverrides.disabled,
    })
    .from(characterPackSubscriptions)
    .innerJoin(
      openingComponents,
      eq(openingComponents.packId, characterPackSubscriptions.packId),
    )
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, characterPackSubscriptions.packId),
    )
    .innerJoin(
      characters,
      eq(characters.id, characterPackSubscriptions.characterId),
    )
    .leftJoin(
      openingComponentOverrides,
      and(
        eq(
          openingComponentOverrides.subscriptionId,
          characterPackSubscriptions.id,
        ),
        eq(openingComponentOverrides.openingComponentId, openingComponents.id),
      ),
    )
    .where(
      and(
        eq(characterPackSubscriptions.characterId, characterId),
        eq(characterPackSubscriptions.openingEnabled, true),
        eq(openingComponents.enabled, true),
        // owner-private: pack owner must be the character owner
        eq(beautificationPacks.ownerUserId, characters.ownerId),
      ),
    )
    .orderBy(
      asc(characterPackSubscriptions.orderIndex),
      asc(openingComponents.orderIndex),
    );

  const visible = rows
    .filter((r) => r.disabled !== true)
    .map((r) => r.component);
  if (visible.length === 0) return [];

  const slotMap = await loadCharacterOpeningSlotValues(characterId);
  return visible.map((c) => ({ ...c, slotValues: slotMap[c.id] ?? {} }));
}

/**
 * List a pack's opening components for an authorized owner-facing surface.
 * The owner predicate lives in the query itself so a future route cannot
 * accidentally serialize another creator's source into an RSC payload.
 */
export async function listOwnedPackOpeningComponents(
  packId: string,
  ownerUserId: string,
): Promise<OpeningComponent[]> {
  return db
    .select({ component: openingComponents })
    .from(openingComponents)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, openingComponents.packId),
    )
    .where(
      and(
        eq(openingComponents.packId, packId),
        eq(beautificationPacks.ownerUserId, ownerUserId),
      ),
    )
    .orderBy(
      asc(openingComponents.orderIndex),
      asc(openingComponents.createdAt),
    )
    .then((rows) => rows.map((row) => row.component));
}

/**
 * Per-character opening-component disables, for the character edit page to
 * render each component's toggle in the correct state. Returns the set of
 * opening_component ids the character owner has turned off (disabled=true).
 */
export async function loadCharacterOpeningOverrides(
  characterId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ componentId: openingComponentOverrides.openingComponentId })
    .from(openingComponentOverrides)
    .innerJoin(
      characterPackSubscriptions,
      eq(
        characterPackSubscriptions.id,
        openingComponentOverrides.subscriptionId,
      ),
    )
    .where(
      and(
        eq(characterPackSubscriptions.characterId, characterId),
        eq(openingComponentOverrides.disabled, true),
      ),
    );
  return new Set(rows.map((r) => r.componentId));
}

/**
 * Load every filled-in slot value for a character, grouped by opening
 * component id: { [componentId]: { [slotKey]: slotValue } }.
 */
export async function loadCharacterOpeningSlotValues(
  characterId: string,
): Promise<Record<string, Record<string, string>>> {
  const rows = await db
    .select({
      componentId: characterOpeningSlotValues.openingComponentId,
      slotKey: characterOpeningSlotValues.slotKey,
      slotValue: characterOpeningSlotValues.slotValue,
    })
    .from(characterOpeningSlotValues)
    .where(eq(characterOpeningSlotValues.characterId, characterId));

  const out: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    let group = out[r.componentId];
    if (!group) {
      group = {};
      out[r.componentId] = group;
    }
    group[r.slotKey] = r.slotValue;
  }
  return out;
}
