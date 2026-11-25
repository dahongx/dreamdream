# Rule-level Pack Selection — Product Insights

**Related:** [docs/handover/rule-level-pack-selection.md](../handover/rule-level-pack-selection.md)

## The problem we solved

User feedback (2026-05-20): "我想要的是有一个官方美化包，里面包含了 Dearm 手机，这时候玩家可以只勾选 Dearm 手机，而不是整个美化包都一起勾选。"

Two issues compounded:
1. **The "Dearm 手机" official pack was a single-rule pack** — a pack with only one regex rule inside. This made "pack" a redundant wrapper. The pack concept's whole point is bundling multiple components; we'd accidentally degenerated it into 1:1 with rules.
2. **The UI was pack-level prefab**: tick the pack, get everything; untick the pack, get nothing. A creator could in theory mute individual rules via `SubscribedPacksEditor`'s expanded view, but that was a separate UI on a separate code path. New characters didn't have that surface at all.

So a user wanting "just the phone, nothing else" from a multi-component official pack had no way to do that during character creation. They'd have to attach the pack, save, edit, expand the pack, mute the unwanted rules. Five clicks instead of one.

## What we changed

- **Rules are now the primary unit of selection** in the character form. Packs are visual grouping (a folded section header with name + badges).
- **One UI for both new + edit flows** (`PackRuleSelector`). The old split between `PackPicker` (form state only) and `SubscribedPacksEditor` (live DB writes) collapsed.
- **The "Dearm 手机" pack became "寄情官方组件"** — a true collection. Three rules ship in v1: Dearm 手机, 环境状态面板, 动态记忆区. Room for more (角色记忆、剧情时间线、关系阶段进度条 are candidates).
- **Subscription is now an implementation detail.** Users don't think "I'm subscribing to a pack" — they think "I'm enabling this component." The subscription row is opportunistically created / dropped behind the scenes by `setCharacterRuleEnabledAction`.

## 竞品对照

This matches the competitor UX. Their 美化包 lets you pick individual items inside a bundle, not the bundle as a whole. We were diverging on accident; now we're back to parity for this surface.

But we keep one thing they don't: the creator can still **publish a pack with all rules enabled by default**, and the user only has to opt out of the ones they don't want. The user's selection state is a delta against the pack's defaults, not an explicit allowlist. That's what `subscription_rule_overrides` was designed for.

## What this unlocks

- **Official rules can grow without coupling.** We can ship 5, 10, 20 official rules under one pack as we build out v1 components. Users curate at the rule level. No "should this be its own pack or in the bundle?" agonizing.
- **Community packs can do the same.** A creator with a pack of 8 character-themed components can ship it knowing users will only enable the 2-3 they want, not feel pressured to expose all 8.
- **The data model now matches the UX model.** When a creator says "subscribe my pack," they actually mean "subscribe my rules" — and that's literally what the DB now reflects via the override semantics.

## What we considered and didn't do

- **Rule as first-class entity (no pack at all).** "Just a flat list of all rules, subscribe one at a time." Cleaner mental model, but breaks the publishing unit (creators want to ship a *thing*, not 8 things). Defer to v2.
- **Per-rule globalCss.** Currently a pack's `global_css` is injected as a whole whenever the pack has any active rule. Per-rule CSS would let "Dearm phone's CSS" only load when "Dearm phone rule" is active. Not blocking — Dearm phone's CSS is harmless to other rules — but worth doing if pack CSS bundles grow.
- **Per-character pack ordering UI.** The `subscription.order_index` still exists in the DB and matters when multiple packs have rules matching the same tag (winner = lower index). Restoring a drag-to-reorder UI is a follow-up if creators hit that case.

## Naming notes

- The component is `PackRuleSelector` — "select rules grouped by pack."
- The action is `setCharacterRuleEnabledAction` — explicit boolean, no "toggle" verb (toggling without knowing current state has race-condition smells; explicit setter is safer).
- The official pack is named in zh first per CLAUDE.md (中文优先). English fallback added to dict later.

## Future evolution

- **v2 rule marketplace.** When packs accumulate to dozens and the official pack hits 10+ rules, the form needs search / filter / sort. Right now we render a flat checkbox list, which is fine for ≤20 rules total.
- **Per-rule preview tooltip.** Hovering a rule name could show a mini-screenshot of what it renders. Punted from v1 to keep scope tight.
- **Bundle suggestions.** "Other users with these rules also enabled X" — only meaningful once we have real users.
