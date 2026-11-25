export const CHARACTER_FORM_CSS_PACK_FIELD = "cssPackIds";
export const CHARACTER_FORM_OPENING_PACK_FIELD = "openingPackIds";

export type RulePackRef = {
  id: string;
  packId: string;
};

export type SubscriptionInsertPlan = {
  characterId: string;
  packId: string;
  orderIndex: number;
  cssEnabled: boolean;
  openingEnabled: boolean;
};

export type RuleOverridePlan = {
  subscriptionId: string;
  ruleId: string;
  disabled: boolean;
};

export function buildCharacterSubscriptionPlans({
  characterId,
  privatePackId,
  selectedRules,
  cssEnabledPackIds,
  openingEnabledPackIds,
}: {
  characterId: string;
  privatePackId: string;
  selectedRules: RulePackRef[];
  cssEnabledPackIds: Set<string>;
  openingEnabledPackIds: Set<string>;
}): {
  orderedPackIds: string[];
  selectedByPack: Map<string, Set<string>>;
  subscriptions: SubscriptionInsertPlan[];
} {
  const packIdsToSubscribe = new Set<string>([privatePackId]);
  const selectedByPack = new Map<string, Set<string>>();

  for (const rule of selectedRules) {
    packIdsToSubscribe.add(rule.packId);
    const set = selectedByPack.get(rule.packId) ?? new Set<string>();
    set.add(rule.id);
    selectedByPack.set(rule.packId, set);
  }

  for (const packId of cssEnabledPackIds) {
    packIdsToSubscribe.add(packId);
  }

  for (const packId of openingEnabledPackIds) {
    packIdsToSubscribe.add(packId);
  }

  const orderedPackIds = Array.from(packIdsToSubscribe);
  return {
    orderedPackIds,
    selectedByPack,
    subscriptions: orderedPackIds.map((packId, orderIndex) => ({
      characterId,
      packId,
      orderIndex,
      cssEnabled: packId === privatePackId || cssEnabledPackIds.has(packId),
      openingEnabled:
        packId === privatePackId || openingEnabledPackIds.has(packId),
    })),
  };
}

export function buildSubscriptionRuleOverridePlans({
  privatePackId,
  allRules,
  selectedByPack,
  subIdByPack,
}: {
  privatePackId: string;
  allRules: RulePackRef[];
  selectedByPack: Map<string, Set<string>>;
  subIdByPack: Map<string, string>;
}): RuleOverridePlan[] {
  const overrides: RuleOverridePlan[] = [];

  for (const rule of allRules) {
    if (rule.packId === privatePackId) continue;
    const subscriptionId = subIdByPack.get(rule.packId);
    if (!subscriptionId) continue;

    const selected = selectedByPack.get(rule.packId) ?? new Set<string>();
    if (!selected.has(rule.id)) {
      overrides.push({ subscriptionId, ruleId: rule.id, disabled: true });
    }
  }

  return overrides;
}
