/**
 * Server-side queries for regex_rules. Pure reads; mutations live in actions.ts.
 */

import { and, asc, eq } from "drizzle-orm";
import type { Dict } from "@/i18n/types";
import { db } from "@/lib/db/client";
import type { RegexRule } from "@/lib/db/schema";
import {
  beautificationPacks,
  characterPackSubscriptions,
  regexRules,
  subscriptionRuleOverrides,
  userRegexPreferences,
} from "@/lib/db/schema";
import { ensureOfficialPackSeed, OFFICIAL_PACK_ID } from "@/lib/packs/official";
import { localizeOfficialRules } from "@/lib/packs/official-rule-copy";

/**
 * Load all rules for a character, aggregated across all subscribed packs.
 * Ordered by subscription.orderIndex then rule.orderIndex.
 * Applies subscription_rule_overrides (creator-level disable).
 */
export async function loadCharacterRules(
  characterId: string,
  officialDict?: Dict,
): Promise<RegexRule[]> {
  // Prompt guidance and iframe replacement are canonical shared assets. Seed
  // once per process before chat reads, even when nobody visited the plaza.
  await ensureOfficialPackSeed();
  const rows = await db
    .select({ rule: regexRules, disabled: subscriptionRuleOverrides.disabled })
    .from(characterPackSubscriptions)
    .innerJoin(
      regexRules,
      eq(regexRules.packId, characterPackSubscriptions.packId),
    )
    .leftJoin(
      subscriptionRuleOverrides,
      and(
        eq(
          subscriptionRuleOverrides.subscriptionId,
          characterPackSubscriptions.id,
        ),
        eq(subscriptionRuleOverrides.ruleId, regexRules.id),
      ),
    )
    .where(eq(characterPackSubscriptions.characterId, characterId))
    .orderBy(
      asc(characterPackSubscriptions.orderIndex),
      asc(regexRules.orderIndex),
    );

  return localizeOfficialRules(
    rows.filter((r) => r.disabled !== true).map((r) => r.rule),
    officialDict,
  );
}

/**
 * Concatenate globalCss from all subscribed packs in subscription order.
 */
export async function loadCharacterGlobalCss(
  characterId: string,
): Promise<string> {
  const rows = await db
    .select({ globalCss: beautificationPacks.globalCss })
    .from(characterPackSubscriptions)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, characterPackSubscriptions.packId),
    )
    .where(
      and(
        eq(characterPackSubscriptions.characterId, characterId),
        eq(characterPackSubscriptions.cssEnabled, true),
      ),
    )
    .orderBy(asc(characterPackSubscriptions.orderIndex));

  return rows
    .map((r) => r.globalCss ?? "")
    .filter(Boolean)
    .join("\n");
}

export async function getRegexRule(ruleId: string): Promise<RegexRule | null> {
  const rows = await db
    .select()
    .from(regexRules)
    .where(eq(regexRules.id, ruleId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Load rules + user's visible-rule opt-outs. Used by the chat pipeline.
 * Signature unchanged; internals now use loadCharacterRules.
 */
export async function loadRulesAndPrefs(
  characterId: string,
  userId: string,
  officialDict?: Dict,
): Promise<{ rules: RegexRule[]; userPrefs: Map<string, boolean> }> {
  const rules = await loadCharacterRules(characterId, officialDict);
  if (rules.length === 0) return { rules, userPrefs: new Map() };

  const prefs = await db
    .select({
      regexRuleId: userRegexPreferences.regexRuleId,
      enabled: userRegexPreferences.enabled,
    })
    .from(userRegexPreferences)
    .where(eq(userRegexPreferences.userId, userId));

  const userPrefs = new Map<string, boolean>();
  for (const p of prefs) userPrefs.set(p.regexRuleId, p.enabled);
  return { rules, userPrefs };
}

/**
 * List rules belonging to a specific pack (for the studio editor).
 */
export async function listPackRules(
  packId: string,
  officialDict?: Dict,
): Promise<RegexRule[]> {
  if (packId === OFFICIAL_PACK_ID) await ensureOfficialPackSeed();
  const rules = await db
    .select()
    .from(regexRules)
    .where(eq(regexRules.packId, packId))
    .orderBy(asc(regexRules.orderIndex), asc(regexRules.createdAt));
  return localizeOfficialRules(rules, officialDict);
}

/**
 * Authorize that the requesting user owns the pack that owns the rule.
 */
export async function getOwnedRule(
  ruleId: string,
  userId: string,
): Promise<{ rule: RegexRule; packId: string } | null> {
  const rows = await db
    .select({ rule: regexRules, ownerUserId: beautificationPacks.ownerUserId })
    .from(regexRules)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, regexRules.packId),
    )
    .where(
      and(
        eq(regexRules.id, ruleId),
        eq(beautificationPacks.ownerUserId, userId),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;
  return { rule: rows[0].rule, packId: rows[0].rule.packId };
}

/**
 * Toggle a user's preference for a visible rule (chat-side panel).
 */
export async function upsertRegexPreference(
  userId: string,
  regexRuleId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .insert(userRegexPreferences)
    .values({ userId, regexRuleId, enabled })
    .onConflictDoUpdate({
      target: [userRegexPreferences.userId, userRegexPreferences.regexRuleId],
      set: { enabled },
    });
}
