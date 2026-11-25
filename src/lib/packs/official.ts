import { eq } from "drizzle-orm";
import { en } from "@/i18n/en";
import { db } from "@/lib/db/client";
import { beautificationPacks, regexRules, users } from "@/lib/db/schema";
import {
  localizeOfficialPack,
  OFFICIAL_PACK_CANONICAL_DESCRIPTION,
  OFFICIAL_PACK_CANONICAL_NAME,
  type OfficialPackCopy,
} from "@/lib/packs/official-copy";
import {
  OFFICIAL_PACK_ID,
  OFFICIAL_RULE_ENV_PANEL_ID,
  OFFICIAL_RULE_MEMORY_ID,
  OFFICIAL_RULE_YEARN_PHONE_ID,
  OFFICIAL_SYSTEM_USER_ID,
} from "@/lib/packs/official-ids";
import { getRegexTemplates } from "@/lib/regex/templates";

export {
  OFFICIAL_PACK_ID,
  OFFICIAL_RULE_ENV_PANEL_ID,
  OFFICIAL_RULE_MEMORY_ID,
  OFFICIAL_RULE_YEARN_PHONE_ID,
  OFFICIAL_SYSTEM_USER_ID,
};
export { localizeOfficialPack, type OfficialPackCopy };

/**
 * The database has one shared official row, so its persisted copy must never
 * depend on the current request locale. English is the locale-neutral
 * canonical source; request-specific names/descriptions are projected by ID
 * with localizeOfficialPack().
 */
export const OFFICIAL_PACK_NAME = OFFICIAL_PACK_CANONICAL_NAME;

const OFFICIAL_PACK_GLOBAL_CSS = [
  ".nj_phone_shell {",
  "  color: var(--text-primary);",
  "}",
  ".nj_phone_frame {",
  "  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);",
  "}",
].join("\n");

const CANONICAL_TEMPLATES = getRegexTemplates(en);

function canonicalPreset(templateId: string) {
  const template = CANONICAL_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error(`template ${templateId} not found`);
  return template.preset;
}

function officialRule(id: string, templateId: string, orderIndex: number) {
  return {
    id,
    ...canonicalPreset(templateId),
    enabled: true,
    orderIndex,
  };
}

const OFFICIAL_RULES = [
  officialRule(OFFICIAL_RULE_YEARN_PHONE_ID, "yearn_phone_placeholder", 0),
  officialRule(OFFICIAL_RULE_ENV_PANEL_ID, "env_state_panel", 1),
  officialRule(OFFICIAL_RULE_MEMORY_ID, "dynamic_memory", 2),
];

let officialPackSeedPromise: Promise<void> | null = null;

async function seedOfficialPack() {
  await db
    .insert(users)
    .values({
      id: OFFICIAL_SYSTEM_USER_ID,
      email: "system@yearn.local",
      name: "system",
      displayName: "Dearm",
      username: "system",
    })
    .onConflictDoNothing();

  await db
    .insert(beautificationPacks)
    .values({
      id: OFFICIAL_PACK_ID,
      ownerUserId: OFFICIAL_SYSTEM_USER_ID,
      name: OFFICIAL_PACK_NAME,
      description: OFFICIAL_PACK_CANONICAL_DESCRIPTION,
      globalCss: OFFICIAL_PACK_GLOBAL_CSS,
      isPublic: true,
    })
    .onConflictDoUpdate({
      target: beautificationPacks.id,
      set: {
        name: OFFICIAL_PACK_NAME,
        description: OFFICIAL_PACK_CANONICAL_DESCRIPTION,
        globalCss: OFFICIAL_PACK_GLOBAL_CSS,
        isPublic: true,
        updatedAt: new Date(),
      },
    });

  for (const rule of OFFICIAL_RULES) {
    await db
      .insert(regexRules)
      .values({ packId: OFFICIAL_PACK_ID, ...rule })
      .onConflictDoUpdate({
        target: regexRules.id,
        set: {
          name: rule.name,
          targetText: rule.targetText,
          pattern: rule.pattern,
          replacement: rule.replacement,
          variableMapping: rule.variableMapping,
          outputGuidance: rule.outputGuidance,
          enabled: rule.enabled,
          visible: rule.visible,
          orderIndex: rule.orderIndex,
          updatedAt: new Date(),
        },
      });
  }
}

export async function getOfficialPack(copy?: OfficialPackCopy) {
  const rows = await db
    .select()
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, OFFICIAL_PACK_ID))
    .limit(1);
  return rows[0] ? localizeOfficialPack(rows[0], copy) : null;
}

export async function ensureOfficialPackSeed() {
  if (!officialPackSeedPromise) {
    officialPackSeedPromise = seedOfficialPack().catch((error) => {
      console.warn("[dearm] failed to seed official pack; continuing.", error);
      officialPackSeedPromise = null;
    });
  }

  await officialPackSeedPromise;
  return OFFICIAL_PACK_ID;
}
