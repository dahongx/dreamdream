# Player Masks Insights

Technical handover: [player masks](../handover/player-masks.md).

## Product Decision

Masks are session-scoped, not global. Roleplay identity is part of a specific story context; changing identity in one chat should not accidentally rewrite the player's identity in another character's conversation.

## Why Multiple Masks

Role-play users often play different selves across different characters. A single global profile name is too blunt: it works for `{{user}}`, but not for personality, boundaries, preferences, or instructions that should shape the model's behavior.

The feature keeps masks private and user-authored. They are not public profile data, creator assets, moderation metadata, or character-card export content.

## Prompt Placement

`## 玩家面具` sits after the host roleplay frame and before character persona. This gives the model the player's identity early without outranking host protocol, while still letting creator persona, output settings, and regex guidance keep their existing order.

`{{user}}` resolves to `mask.name` only when a mask is selected. This makes old cards immediately benefit from masks without requiring creator-side schema changes.

## Constraints

No automatic rewrite of history. Saving or switching a mask affects the next model turn only. Existing user/assistant messages remain as authored, which avoids surprising transcript mutation and keeps debug output explainable.
