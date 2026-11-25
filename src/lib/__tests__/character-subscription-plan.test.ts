import { describe, expect, test } from "bun:test";
import {
  buildCharacterSubscriptionPlans,
  buildSubscriptionRuleOverridePlans,
} from "../characters/subscription-plan";

describe("character subscription plan", () => {
  test("keeps rule and global CSS selections independent on create", () => {
    const { orderedPackIds, selectedByPack, subscriptions } =
      buildCharacterSubscriptionPlans({
        characterId: "character-1",
        privatePackId: "private-pack",
        selectedRules: [
          { id: "rule-a", packId: "rule-pack" },
          { id: "css-rule-c", packId: "css-and-rule-pack" },
        ],
        cssEnabledPackIds: new Set(["css-only-pack", "css-and-rule-pack"]),
        openingEnabledPackIds: new Set(),
      });

    expect(orderedPackIds).toEqual([
      "private-pack",
      "rule-pack",
      "css-and-rule-pack",
      "css-only-pack",
    ]);
    expect(subscriptions).toEqual([
      {
        characterId: "character-1",
        packId: "private-pack",
        orderIndex: 0,
        cssEnabled: true,
        openingEnabled: true,
      },
      {
        characterId: "character-1",
        packId: "rule-pack",
        orderIndex: 1,
        cssEnabled: false,
        openingEnabled: false,
      },
      {
        characterId: "character-1",
        packId: "css-and-rule-pack",
        orderIndex: 2,
        cssEnabled: true,
        openingEnabled: false,
      },
      {
        characterId: "character-1",
        packId: "css-only-pack",
        orderIndex: 3,
        cssEnabled: true,
        openingEnabled: false,
      },
    ]);

    const overrides = buildSubscriptionRuleOverridePlans({
      privatePackId: "private-pack",
      selectedByPack,
      subIdByPack: new Map([
        ["private-pack", "sub-private"],
        ["rule-pack", "sub-rule"],
        ["css-only-pack", "sub-css-only"],
        ["css-and-rule-pack", "sub-css-rule"],
      ]),
      allRules: [
        { id: "private-rule", packId: "private-pack" },
        { id: "rule-a", packId: "rule-pack" },
        { id: "rule-b", packId: "rule-pack" },
        { id: "css-rule-a", packId: "css-only-pack" },
        { id: "css-rule-b", packId: "css-only-pack" },
        { id: "css-rule-c", packId: "css-and-rule-pack" },
        { id: "css-rule-d", packId: "css-and-rule-pack" },
      ],
    });

    expect(overrides).toEqual([
      { subscriptionId: "sub-rule", ruleId: "rule-b", disabled: true },
      {
        subscriptionId: "sub-css-only",
        ruleId: "css-rule-a",
        disabled: true,
      },
      {
        subscriptionId: "sub-css-only",
        ruleId: "css-rule-b",
        disabled: true,
      },
      {
        subscriptionId: "sub-css-rule",
        ruleId: "css-rule-d",
        disabled: true,
      },
    ]);
  });
});
