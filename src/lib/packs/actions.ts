"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  characterOpeningSlotValues,
  characterPackSubscriptions,
  openingComponentOverrides,
  openingComponents,
  regexRules,
  subscriptionRuleOverrides,
} from "@/lib/db/schema";
import { extractOpeningSlots } from "@/lib/opening/content";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createPackAction(opts: {
  name: string;
  description?: string;
  isPublic?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  const [row] = await db
    .insert(beautificationPacks)
    .values({
      ownerUserId: userId,
      name: opts.name.slice(0, 128),
      description: opts.description ?? null,
      isPublic: opts.isPublic ?? false,
    })
    .returning({ id: beautificationPacks.id });
  revalidatePath("/packs");
  return { ok: true, data: { id: row.id } };
}

export async function updatePackAction(
  packId: string,
  opts: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    globalCss?: string;
  },
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const result = await db
    .update(beautificationPacks)
    .set({
      ...(opts.name !== undefined && { name: opts.name.slice(0, 128) }),
      ...(opts.description !== undefined && { description: opts.description }),
      ...(opts.isPublic !== undefined && { isPublic: opts.isPublic }),
      ...(opts.globalCss !== undefined && {
        globalCss: opts.globalCss || null,
      }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(beautificationPacks.id, packId),
        eq(beautificationPacks.ownerUserId, userId),
      ),
    )
    .returning({ id: beautificationPacks.id });
  if (!result[0])
    return { ok: false, error: "找不到该美化包，或你没有编辑权限" };
  revalidatePath(`/packs/${packId}`);
  revalidatePath(`/packs/${packId}/studio`);
  return { ok: true, data: null };
}

export async function deletePackAction(
  packId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const result = await db
    .delete(beautificationPacks)
    .where(
      and(
        eq(beautificationPacks.id, packId),
        eq(beautificationPacks.ownerUserId, userId),
      ),
    )
    .returning({ id: beautificationPacks.id });
  if (!result[0])
    return { ok: false, error: "找不到该美化包，或你没有编辑权限" };
  revalidatePath("/packs");
  return { ok: true, data: null };
}

export async function subscribePackToCharacterAction(
  packId: string,
  characterId: string,
): Promise<ActionResult<{ subscriptionId: string }>> {
  const userId = await getCurrentUserId();

  // Verify character ownership
  const { characters } = await import("@/lib/db/schema");
  const [char] = await db
    .select({ ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!char || char.ownerId !== userId) {
    return { ok: false, error: "找不到该角色，或你没有编辑权限" };
  }

  // Verify pack is accessible (own or public)
  const [pack] = await db
    .select({
      ownerUserId: beautificationPacks.ownerUserId,
      isPublic: beautificationPacks.isPublic,
    })
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId))
    .limit(1);
  if (!pack || (!pack.isPublic && pack.ownerUserId !== userId)) {
    return { ok: false, error: "找不到该美化包" };
  }

  // Get next orderIndex
  const [maxRow] = await db
    .select({ max: sql<number>`max(${characterPackSubscriptions.orderIndex})` })
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.characterId, characterId));
  const orderIndex = (maxRow?.max ?? -1) + 1;

  const [sub] = await db
    .insert(characterPackSubscriptions)
    // Whole-pack subscribe is an explicit "pull this pack in" gesture, so
    // cssEnabled=true matches the creator's intent. (Rule-toggle auto-subscribe
    // takes the opposite default — see setCharacterRuleEnabledAction.)
    .values({ characterId, packId, orderIndex, cssEnabled: true })
    .onConflictDoNothing()
    .returning({ id: characterPackSubscriptions.id });

  if (!sub) return { ok: false, error: "这个角色已经添加了该美化包" };

  // Increment subscriber_count
  await db
    .update(beautificationPacks)
    .set({ subscriberCount: sql`${beautificationPacks.subscriberCount} + 1` })
    .where(eq(beautificationPacks.id, packId));

  revalidatePath(`/characters/${characterId}/edit`);
  return { ok: true, data: { subscriptionId: sub.id } };
}

export async function unsubscribePackAction(
  subscriptionId: string,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const { characters } = await import("@/lib/db/schema");

  const [sub] = await db
    .select({
      packId: characterPackSubscriptions.packId,
      ownerId: characters.ownerId,
      characterId: characterPackSubscriptions.characterId,
    })
    .from(characterPackSubscriptions)
    .innerJoin(
      characters,
      eq(characters.id, characterPackSubscriptions.characterId),
    )
    .where(eq(characterPackSubscriptions.id, subscriptionId))
    .limit(1);
  if (!sub || sub.ownerId !== userId) {
    return { ok: false, error: "找不到该角色与美化包的关联，或你没有操作权限" };
  }

  await db
    .delete(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.id, subscriptionId));

  await db
    .update(beautificationPacks)
    .set({
      subscriberCount: sql`greatest(0, ${beautificationPacks.subscriberCount} - 1)`,
    })
    .where(eq(beautificationPacks.id, sub.packId));

  revalidatePath(`/characters/${sub.characterId}/edit`);
  return { ok: true, data: null };
}

export async function reorderSubscriptionsAction(
  characterId: string,
  orderedPackIds: string[],
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const { characters } = await import("@/lib/db/schema");

  const [char] = await db
    .select({ ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!char || char.ownerId !== userId) {
    return { ok: false, error: "找不到该角色，或你没有编辑权限" };
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedPackIds.length; i++) {
      await tx
        .update(characterPackSubscriptions)
        .set({ orderIndex: i })
        .where(
          and(
            eq(characterPackSubscriptions.characterId, characterId),
            eq(characterPackSubscriptions.packId, orderedPackIds[i]),
          ),
        );
    }
  });

  revalidatePath(`/characters/${characterId}/edit`);
  return { ok: true, data: null };
}

export async function toggleSubscriptionRuleOverrideAction(
  subscriptionId: string,
  ruleId: string,
  disabled: boolean,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const { characters } = await import("@/lib/db/schema");

  const [sub] = await db
    .select({
      ownerId: characters.ownerId,
      characterId: characterPackSubscriptions.characterId,
    })
    .from(characterPackSubscriptions)
    .innerJoin(
      characters,
      eq(characters.id, characterPackSubscriptions.characterId),
    )
    .where(eq(characterPackSubscriptions.id, subscriptionId))
    .limit(1);
  if (!sub || sub.ownerId !== userId) {
    return { ok: false, error: "找不到该角色与美化包的关联，或你没有操作权限" };
  }

  if (disabled) {
    await db
      .insert(subscriptionRuleOverrides)
      .values({ subscriptionId, ruleId, disabled: true })
      .onConflictDoUpdate({
        target: [
          subscriptionRuleOverrides.subscriptionId,
          subscriptionRuleOverrides.ruleId,
        ],
        set: { disabled: true },
      });
  } else {
    await db
      .delete(subscriptionRuleOverrides)
      .where(
        and(
          eq(subscriptionRuleOverrides.subscriptionId, subscriptionId),
          eq(subscriptionRuleOverrides.ruleId, ruleId),
        ),
      );
  }

  revalidatePath(`/characters/${sub.characterId}/edit`);
  return { ok: true, data: null };
}

/**
 * Atomic rule-level toggle for the rule-picker UI.
 *
 * enabled=true:
 *   - subscribe the pack to the character if not yet subscribed
 *   - clear any override row for this (subscription, rule)
 * enabled=false:
 *   - if not subscribed: no-op
 *   - upsert override row (disabled=true)
 *   - if every rule in the pack now has a disabled-override, drop the subscription
 *     (cascade cleans up overrides)
 *
 * Returns the current subscription id (null if pack ended up unsubscribed).
 */
export async function setCharacterRuleEnabledAction(
  characterId: string,
  packId: string,
  ruleId: string,
  enabled: boolean,
): Promise<ActionResult<{ subscriptionId: string | null }>> {
  const userId = await getCurrentUserId();
  const { characters } = await import("@/lib/db/schema");

  const [char] = await db
    .select({ ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!char || char.ownerId !== userId) {
    return { ok: false, error: "找不到该角色，或你没有编辑权限" };
  }

  const [pack] = await db
    .select({
      ownerUserId: beautificationPacks.ownerUserId,
      isPublic: beautificationPacks.isPublic,
    })
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId))
    .limit(1);
  if (!pack || (!pack.isPublic && pack.ownerUserId !== userId)) {
    return { ok: false, error: "找不到该美化包" };
  }

  const [rule] = await db
    .select({ id: regexRules.id })
    .from(regexRules)
    .where(and(eq(regexRules.id, ruleId), eq(regexRules.packId, packId)))
    .limit(1);
  if (!rule) {
    return { ok: false, error: "该对话组件不属于此美化包" };
  }

  let [sub] = await db
    .select({ id: characterPackSubscriptions.id })
    .from(characterPackSubscriptions)
    .where(
      and(
        eq(characterPackSubscriptions.characterId, characterId),
        eq(characterPackSubscriptions.packId, packId),
      ),
    )
    .limit(1);

  if (enabled) {
    if (!sub) {
      const [maxRow] = await db
        .select({
          max: sql<number>`max(${characterPackSubscriptions.orderIndex})`,
        })
        .from(characterPackSubscriptions)
        .where(eq(characterPackSubscriptions.characterId, characterId));
      const orderIndex = (maxRow?.max ?? -1) + 1;
      const [created] = await db
        .insert(characterPackSubscriptions)
        // Rule toggle is *not* a CSS opt-in — start with cssEnabled=false so
        // the creator must explicitly tick the 🎨 row to pull in this pack's
        // globalCss. Otherwise the auto-created subscription silently applies
        // the entire pack's CSS as a side effect of touching one rule.
        .values({ characterId, packId, orderIndex, cssEnabled: false })
        .returning({ id: characterPackSubscriptions.id });
      sub = created;
      await db
        .update(beautificationPacks)
        .set({
          subscriberCount: sql`${beautificationPacks.subscriberCount} + 1`,
        })
        .where(eq(beautificationPacks.id, packId));
    }
    await db
      .delete(subscriptionRuleOverrides)
      .where(
        and(
          eq(subscriptionRuleOverrides.subscriptionId, sub.id),
          eq(subscriptionRuleOverrides.ruleId, ruleId),
        ),
      );
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: sub.id } };
  }

  if (!sub) {
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: null } };
  }

  await db
    .insert(subscriptionRuleOverrides)
    .values({ subscriptionId: sub.id, ruleId, disabled: true })
    .onConflictDoUpdate({
      target: [
        subscriptionRuleOverrides.subscriptionId,
        subscriptionRuleOverrides.ruleId,
      ],
      set: { disabled: true },
    });

  const packRuleRows = await db
    .select({ id: regexRules.id })
    .from(regexRules)
    .where(eq(regexRules.packId, packId));
  const disabledRows = await db
    .select({ ruleId: subscriptionRuleOverrides.ruleId })
    .from(subscriptionRuleOverrides)
    .where(
      and(
        eq(subscriptionRuleOverrides.subscriptionId, sub.id),
        eq(subscriptionRuleOverrides.disabled, true),
      ),
    );
  const disabledSet = new Set(disabledRows.map((r) => r.ruleId));
  const anyEnabled = packRuleRows.some((r) => !disabledSet.has(r.id));

  // Re-fetch cssEnabled — if the creator turned CSS off separately, we must
  // not silently wipe that signal by leaving the subscription alive *or* by
  // auto-unsubscribing prematurely. Only drop the subscription when both
  // signals say "no effect left": all rules disabled AND cssEnabled = false.
  const [subFull] = await db
    .select({
      cssEnabled: characterPackSubscriptions.cssEnabled,
      openingEnabled: characterPackSubscriptions.openingEnabled,
    })
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.id, sub.id))
    .limit(1);
  const cssOn = subFull?.cssEnabled ?? true;
  const openingOn = subFull?.openingEnabled ?? true;

  if (!anyEnabled && !cssOn && !openingOn) {
    await db
      .delete(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.id, sub.id));
    await db
      .update(beautificationPacks)
      .set({
        subscriberCount: sql`greatest(0, ${beautificationPacks.subscriberCount} - 1)`,
      })
      .where(eq(beautificationPacks.id, packId));
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: null } };
  }

  revalidatePath(`/characters/${characterId}/edit`);
  return { ok: true, data: { subscriptionId: sub.id } };
}

/**
 * Toggle whether a character's subscription to a pack pulls in that pack's
 * globalCss. Mirrors setCharacterRuleEnabledAction: turning ON auto-creates
 * the subscription if missing; turning OFF unsubscribes only when both
 * css_enabled becomes false AND all rules are disabled (full opt-out signal).
 */
export async function setSubscriptionCssEnabledAction(
  characterId: string,
  packId: string,
  enabled: boolean,
): Promise<ActionResult<{ subscriptionId: string | null }>> {
  const userId = await getCurrentUserId();
  const { characters } = await import("@/lib/db/schema");

  const [char] = await db
    .select({ ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!char || char.ownerId !== userId) {
    return { ok: false, error: "找不到该角色，或你没有编辑权限" };
  }

  const [pack] = await db
    .select({
      ownerUserId: beautificationPacks.ownerUserId,
      isPublic: beautificationPacks.isPublic,
    })
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId))
    .limit(1);
  if (!pack || (!pack.isPublic && pack.ownerUserId !== userId)) {
    return { ok: false, error: "找不到该美化包" };
  }

  let [sub] = await db
    .select({ id: characterPackSubscriptions.id })
    .from(characterPackSubscriptions)
    .where(
      and(
        eq(characterPackSubscriptions.characterId, characterId),
        eq(characterPackSubscriptions.packId, packId),
      ),
    )
    .limit(1);

  if (enabled) {
    if (!sub) {
      const [maxRow] = await db
        .select({
          max: sql<number>`max(${characterPackSubscriptions.orderIndex})`,
        })
        .from(characterPackSubscriptions)
        .where(eq(characterPackSubscriptions.characterId, characterId));
      const orderIndex = (maxRow?.max ?? -1) + 1;
      const [created] = await db
        .insert(characterPackSubscriptions)
        .values({ characterId, packId, orderIndex, cssEnabled: true })
        .returning({ id: characterPackSubscriptions.id });
      sub = created;
      await db
        .update(beautificationPacks)
        .set({
          subscriberCount: sql`${beautificationPacks.subscriberCount} + 1`,
        })
        .where(eq(beautificationPacks.id, packId));
    } else {
      await db
        .update(characterPackSubscriptions)
        .set({ cssEnabled: true })
        .where(eq(characterPackSubscriptions.id, sub.id));
    }
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: sub.id } };
  }

  // disable path
  if (!sub) {
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: null } };
  }

  await db
    .update(characterPackSubscriptions)
    .set({ cssEnabled: false })
    .where(eq(characterPackSubscriptions.id, sub.id));

  // Mirror setCharacterRuleEnabledAction's auto-unsubscribe logic: if CSS is
  // off AND every rule is disabled, the subscription has no remaining effect,
  // so drop it entirely.
  const packRuleRows = await db
    .select({ id: regexRules.id })
    .from(regexRules)
    .where(eq(regexRules.packId, packId));
  const disabledRows = await db
    .select({ ruleId: subscriptionRuleOverrides.ruleId })
    .from(subscriptionRuleOverrides)
    .where(
      and(
        eq(subscriptionRuleOverrides.subscriptionId, sub.id),
        eq(subscriptionRuleOverrides.disabled, true),
      ),
    );
  const disabledSet = new Set(disabledRows.map((r) => r.ruleId));
  const anyEnabledRule = packRuleRows.some((r) => !disabledSet.has(r.id));

  const [subState] = await db
    .select({ openingEnabled: characterPackSubscriptions.openingEnabled })
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.id, sub.id))
    .limit(1);
  const openingOn = subState?.openingEnabled ?? true;

  if (!anyEnabledRule && !openingOn) {
    await db
      .delete(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.id, sub.id));
    await db
      .update(beautificationPacks)
      .set({
        subscriberCount: sql`greatest(0, ${beautificationPacks.subscriberCount} - 1)`,
      })
      .where(eq(beautificationPacks.id, packId));
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: null } };
  }

  revalidatePath(`/characters/${characterId}/edit`);
  return { ok: true, data: { subscriptionId: sub.id } };
}

/**
 * Per-component opening toggle — mirrors setCharacterRuleEnabledAction but for
 * opening_components. Turning ON auto-creates the subscription if missing,
 * ensures openingEnabled=true (the pack-level gate the read query still checks),
 * and clears any disabled override. Turning OFF writes a disabled override; if
 * that leaves the pack with no effect (no enabled rules, css off, AND every
 * opening component disabled), the subscription is dropped.
 *
 * owner-private: opening components only render when pack owner == character
 * owner, so this action requires the caller to own both.
 */
export async function setCharacterOpeningComponentEnabledAction(
  characterId: string,
  packId: string,
  componentId: string,
  enabled: boolean,
): Promise<ActionResult<{ subscriptionId: string | null }>> {
  const userId = await getCurrentUserId();
  const { characters } = await import("@/lib/db/schema");

  const [char] = await db
    .select({ ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!char || char.ownerId !== userId) {
    return { ok: false, error: "找不到该角色，或你没有编辑权限" };
  }

  const [pack] = await db
    .select({ ownerUserId: beautificationPacks.ownerUserId })
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, packId))
    .limit(1);
  // Opening components are owner-private: pack owner must equal character owner.
  if (!pack || pack.ownerUserId !== userId) {
    return { ok: false, error: "找不到该美化包，或开场组件不可用" };
  }

  const [component] = await db
    .select({ id: openingComponents.id })
    .from(openingComponents)
    .where(
      and(
        eq(openingComponents.id, componentId),
        eq(openingComponents.packId, packId),
      ),
    )
    .limit(1);
  if (!component) {
    return { ok: false, error: "该开场组件不属于此美化包" };
  }

  let [sub] = await db
    .select({ id: characterPackSubscriptions.id })
    .from(characterPackSubscriptions)
    .where(
      and(
        eq(characterPackSubscriptions.characterId, characterId),
        eq(characterPackSubscriptions.packId, packId),
      ),
    )
    .limit(1);

  if (enabled) {
    if (!sub) {
      const [maxRow] = await db
        .select({
          max: sql<number>`max(${characterPackSubscriptions.orderIndex})`,
        })
        .from(characterPackSubscriptions)
        .where(eq(characterPackSubscriptions.characterId, characterId));
      const orderIndex = (maxRow?.max ?? -1) + 1;
      const [created] = await db
        .insert(characterPackSubscriptions)
        .values({
          characterId,
          packId,
          orderIndex,
          cssEnabled: false,
          openingEnabled: true,
        })
        .returning({ id: characterPackSubscriptions.id });
      sub = created;
      await db
        .update(beautificationPacks)
        .set({
          subscriberCount: sql`${beautificationPacks.subscriberCount} + 1`,
        })
        .where(eq(beautificationPacks.id, packId));
    } else {
      // Pack-level opening gate must be on for the read query to surface any
      // component; flipping one component on re-opens the gate.
      await db
        .update(characterPackSubscriptions)
        .set({ openingEnabled: true })
        .where(eq(characterPackSubscriptions.id, sub.id));
    }
    await db
      .delete(openingComponentOverrides)
      .where(
        and(
          eq(openingComponentOverrides.subscriptionId, sub.id),
          eq(openingComponentOverrides.openingComponentId, componentId),
        ),
      );
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: sub.id } };
  }

  if (!sub) {
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: null } };
  }

  await db
    .insert(openingComponentOverrides)
    .values({
      subscriptionId: sub.id,
      openingComponentId: componentId,
      disabled: true,
    })
    .onConflictDoUpdate({
      target: [
        openingComponentOverrides.subscriptionId,
        openingComponentOverrides.openingComponentId,
      ],
      set: { disabled: true },
    });

  // Drop the subscription only when it has no remaining effect: no enabled
  // rules, css off, AND every opening component disabled.
  const packRuleRows = await db
    .select({ id: regexRules.id })
    .from(regexRules)
    .where(eq(regexRules.packId, packId));
  const ruleDisabledRows = await db
    .select({ ruleId: subscriptionRuleOverrides.ruleId })
    .from(subscriptionRuleOverrides)
    .where(
      and(
        eq(subscriptionRuleOverrides.subscriptionId, sub.id),
        eq(subscriptionRuleOverrides.disabled, true),
      ),
    );
  const ruleDisabledSet = new Set(ruleDisabledRows.map((r) => r.ruleId));
  const anyRuleEnabled = packRuleRows.some((r) => !ruleDisabledSet.has(r.id));

  const packOpeningRows = await db
    .select({ id: openingComponents.id })
    .from(openingComponents)
    .where(
      and(
        eq(openingComponents.packId, packId),
        eq(openingComponents.enabled, true),
      ),
    );
  const openingDisabledRows = await db
    .select({ componentId: openingComponentOverrides.openingComponentId })
    .from(openingComponentOverrides)
    .where(
      and(
        eq(openingComponentOverrides.subscriptionId, sub.id),
        eq(openingComponentOverrides.disabled, true),
      ),
    );
  const openingDisabledSet = new Set(
    openingDisabledRows.map((r) => r.componentId),
  );
  const anyOpeningEnabled = packOpeningRows.some(
    (r) => !openingDisabledSet.has(r.id),
  );

  const [subState] = await db
    .select({ cssEnabled: characterPackSubscriptions.cssEnabled })
    .from(characterPackSubscriptions)
    .where(eq(characterPackSubscriptions.id, sub.id))
    .limit(1);
  const cssOn = subState?.cssEnabled ?? true;

  if (!anyRuleEnabled && !cssOn && !anyOpeningEnabled) {
    await db
      .delete(characterPackSubscriptions)
      .where(eq(characterPackSubscriptions.id, sub.id));
    await db
      .update(beautificationPacks)
      .set({
        subscriberCount: sql`greatest(0, ${beautificationPacks.subscriberCount} - 1)`,
      })
      .where(eq(beautificationPacks.id, packId));
    revalidatePath(`/characters/${characterId}/edit`);
    return { ok: true, data: { subscriptionId: null } };
  }

  revalidatePath(`/characters/${characterId}/edit`);
  return { ok: true, data: { subscriptionId: sub.id } };
}

/**
 * Save a character's slot values for one opening component. Slots are the
 * {{custom}} tokens the creator wrote in the component content (char/user are
 * reserved and excluded). Values are static text the character owner fills in
 * per character; rendered via interpolateOpening at chat time (no AI).
 *
 * Only slot keys that actually exist in the component content are persisted —
 * stale keys are ignored. Empty/whitespace values delete the row (so the token
 * falls back to showing {{slot}} as an unfilled placeholder).
 */
export async function setCharacterOpeningSlotValuesAction(
  characterId: string,
  componentId: string,
  values: Record<string, string>,
): Promise<ActionResult<null>> {
  const userId = await getCurrentUserId();
  const { characters } = await import("@/lib/db/schema");

  const [char] = await db
    .select({ ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!char || char.ownerId !== userId) {
    return { ok: false, error: "找不到该角色，或你没有编辑权限" };
  }

  // The component must belong to a pack the caller owns (owner-private).
  const [component] = await db
    .select({
      content: openingComponents.content,
      ownerUserId: beautificationPacks.ownerUserId,
    })
    .from(openingComponents)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, openingComponents.packId),
    )
    .where(eq(openingComponents.id, componentId))
    .limit(1);
  if (!component || component.ownerUserId !== userId) {
    return { ok: false, error: "找不到该开场组件，或你没有编辑权限" };
  }

  // Only honor slot keys that actually exist in the component content.
  const validSlots = new Set(extractOpeningSlots(component.content));

  await db.transaction(async (tx) => {
    for (const [key, raw] of Object.entries(values)) {
      if (!validSlots.has(key)) continue;
      const value = raw.trim();
      if (value === "") {
        await tx
          .delete(characterOpeningSlotValues)
          .where(
            and(
              eq(characterOpeningSlotValues.characterId, characterId),
              eq(characterOpeningSlotValues.openingComponentId, componentId),
              eq(characterOpeningSlotValues.slotKey, key),
            ),
          );
        continue;
      }
      await tx
        .insert(characterOpeningSlotValues)
        .values({
          characterId,
          openingComponentId: componentId,
          slotKey: key,
          slotValue: value,
        })
        .onConflictDoUpdate({
          target: [
            characterOpeningSlotValues.characterId,
            characterOpeningSlotValues.openingComponentId,
            characterOpeningSlotValues.slotKey,
          ],
          set: { slotValue: value },
        });
    }
  });

  revalidatePath(`/characters/${characterId}/edit`);
  return { ok: true, data: null };
}
