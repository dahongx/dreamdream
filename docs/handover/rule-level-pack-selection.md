# Rule-level Pack Selection — Technical Handover

**Related:** [docs/insights/rule-level-pack-selection.md](../insights/rule-level-pack-selection.md)

## What changed

The character form's "D · 美化包" section used to be **pack-level** — you toggled a whole pack with one checkbox. To turn off a single rule inside a subscribed pack, you had to first attach the pack, then expand it in `SubscribedPacksEditor` and click another button. Two-step, non-obvious.

It is now **rule-level**: each pack renders its rules as a checkbox list. The pack-level checkbox is just a "select all / none" master toggle with indeterminate state. Subscribing and unsubscribing happens implicitly:

- Tick the first rule under a pack → subscription is created.
- Untick the last enabled rule → subscription is deleted (cascade removes overrides).
- Anywhere in between → subscription stays, unticked rules get a `subscription_rule_overrides` row with `disabled=true`.

## Schema

**Zero schema change.** The existing `subscription_rule_overrides` table already represented "subscribed pack with N rules muted." The refactor only changes which UI surface writes to it.

## Files touched

| File | Change |
|---|---|
| `src/components/packs/PackRuleSelector.tsx` | **new** — unified rule-level selector for both new + edit flows |
| `src/components/packs/SubscribedPacksEditor.tsx` | **deleted** — superseded |
| `src/components/characters/CharacterForm.tsx` | replaced PackPicker + SubscribedPacksEditor with PackRuleSelector; new `selectedRuleIds: Set<string>` state |
| `src/lib/packs/actions.ts` | added `setCharacterRuleEnabledAction(characterId, packId, ruleId, enabled)` — atomic |
| `src/lib/characters/actions.ts` | `createCharacterAction` reads `ruleIds` form input (was `packIds`); subscribes packs and writes overrides per rule |
| `src/lib/packs/official.ts` | renamed: pack "Dearm 手机" → "寄情官方组件"; added 2 more rules (env panel, dynamic memory). Pack UUID unchanged. |
| `src/lib/auth/current-user.ts`, `src/lib/packs/queries.ts`, `src/app/packs/page.tsx` | renamed import: `ensureOfficialYearnPhonePackSeed` → `ensureOfficialPackSeed`, `OFFICIAL_YEARN_PHONE_PACK_ID` → `OFFICIAL_PACK_ID` |

## State model in CharacterForm

```ts
const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(() => {
  if (!initial) return new Set();           // new character: empty
  // edit: derive from subscriptions ∖ disabled overrides
  const next = new Set<string>();
  for (const entry of subscriptions) {
    const disabled = new Set(entry.overrides.filter(o => o.disabled).map(o => o.ruleId));
    for (const r of (packRules[entry.pack.id] ?? entry.rules)) {
      if (!disabled.has(r.id)) next.add(r.id);
    }
  }
  return next;
});
```

## Toggle path

**Edit mode (character already exists):**
1. UI optimistically updates `selectedRuleIds`
2. `setCharacterRuleEnabledAction(characterId, packId, ruleId, enabled)` fires
3. On failure: state is reverted; we log to console (no toast yet)

**New mode (character not yet created):**
1. UI updates `selectedRuleIds` only
2. On form submit, hidden `<input name="ruleIds" value={ruleId}>` per selected rule
3. `createCharacterAction` reads `ruleIds` from formData, groups by pack, subscribes packs, writes `disabled=true` overrides for non-selected rules in those packs

## The atomic action

`setCharacterRuleEnabledAction(characterId, packId, ruleId, enabled)`:

- **enabled=true**: subscribe pack if not yet; delete any override row for this (subscription, rule)
- **enabled=false**: no-op if not subscribed; otherwise upsert override(disabled=true); if every pack rule now has a disabled override, unsubscribe the pack (cascade cleans overrides)

Returns `{ subscriptionId: string | null }` so the client could (in the future) revalidate state from server.

Old per-rule action `toggleSubscriptionRuleOverrideAction` and pack-level `subscribePackToCharacterAction` / `unsubscribePackAction` are kept for `SubscribeToCharacterButton.tsx` (used on the pack detail page) and as low-level primitives. The new action is the recommended one for character-edit context.

## Official pack changes

- Pack id `00000000-0000-0000-0000-000000000002` is now named **"寄情官方组件"** instead of "Dearm 手机".
- It contains 3 rules:
  - `00000000-0000-0000-0000-000000000003` — Dearm 手机
  - `00000000-0000-0000-0000-000000000004` — 环境状态面板
  - `00000000-0000-0000-0000-000000000005` — 动态记忆区
- Rule contents for env / memory are sourced from `REGEX_TEMPLATES` in `templates.ts` (no duplication).
- `ensureOfficialPackSeed()` is idempotent: it upserts pack + every rule on each call (runs on first user login per `current-user.ts`).

## Limitations / known issues

- **Per-pack globalCss is still injected even if only one rule from the pack is selected.** The pack's `global_css` is loaded by `loadCharacterGlobalCss` in `queries.ts` for every subscribed pack. Short-term this is fine (Dearm phone's CSS doesn't break env / memory). Future work: per-rule CSS bundling, or scope CSS to the rules that are actually active.
- **Pack reorder UI removed.** Subscription `orderIndex` still exists in the DB (controls which rule wins when multiple packs match the same tag), but there's no UI to change it. Re-add if creators report ordering issues.
- **No subscription test coverage.** Existing pack actions had no integration tests either; we follow the same pattern. Manual verification only.

## Verification

1. `bun test` — full suite green
2. `bunx tsc --noEmit` — type-clean
3. `bunx biome check src/` — lint-clean
4. `bun run dev`, log in, go to a character edit page → "D · 美化包" → 「寄情官方组件」展开默认显示 3 条 rule + 每条独立 checkbox
5. Tick "Dearm 手机" only → DB:
   - `character_pack_subscriptions` row appears for official pack
   - `subscription_rule_overrides` rows appear for 环境状态面板 + 动态记忆区 (`disabled=true`)
6. Untick all 3 → subscription row gone (cascade clears overrides)
7. Create a new character with only "Dearm 手机" ticked → after redirect, edit page should reflect the same state
