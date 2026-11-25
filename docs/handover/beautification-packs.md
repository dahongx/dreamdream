# Beautification Packs — Technical Handover

**Related:** [docs/insights/beautification-packs.md](../insights/beautification-packs.md)

## What changed

Regex rules and global CSS were previously hard-bound to a single character card (`regex_rules.character_id`, `characters.global_css`). Both are now decoupled into **beautification packs** — shareable containers that characters subscribe to.

## Schema (migration: `drizzle/0001_beautification_packs.sql`)

| Table | Purpose |
|---|---|
| `beautification_packs` | Pack entity: name, description, global_css, is_public, subscriber_count, owner_user_id |
| `character_pack_subscriptions` | Character ↔ pack M:M with order_index |
| `subscription_rule_overrides` | Creator-level disable of individual rules per subscription |
| `regex_rules` | Now has `pack_id` FK instead of `character_id` |

`characters.global_css` column removed. `regex_rules.character_id` column removed.

## Data migration

Each existing character gets one private pack (`<name> 的美化包`) that absorbs its old rules and CSS. The character auto-subscribes to it at `order_index=0`. No data loss.

## Key query paths

- **Chat pipeline**: `loadRulesAndPrefs(characterId, userId)` → internally calls `loadCharacterRules(characterId)` which joins subscriptions → packs → rules, applies `subscription_rule_overrides`, orders by subscription then rule orderIndex.
- **CSS injection**: `loadCharacterGlobalCss(characterId)` concatenates `global_css` from all subscribed packs in subscription order.
- **Pack CRUD**: `src/lib/packs/actions.ts` + `queries.ts` + `permissions.ts`

## Routes

| Route | Purpose |
|---|---|
| `/packs` | My packs + plaza (search, hot sort) |
| `/packs/new` | Create pack |
| `/packs/[id]` | Pack detail (public or owner) |
| `/packs/[id]/studio` | Studio editor (owner only) |

Old `/characters/[id]/regex/*` routes deleted; `/characters/[id]/regex` redirects to `/packs`.

## Studio editor

`/packs/[id]/studio` — left/right split:
- Left: Rules tab (RegexRuleList) / CSS tab (textarea + AI generate + 1.5s autosave) / AI assistant tab (SSE chat, suggestions only)
- Right: PreviewCanvas — mock messages run through the full render pipeline (expandSpecialTags → applyRegexToSegments → sanitize/iframe), CSS injected via sanitizeAndScopeCss

## Subscription flow

1. Creator opens character edit → "美化包" section → `SubscribedPacksEditor`
2. Click "+ 添加美化包" → browse own packs or public plaza → subscribe
3. `subscribePackToCharacterAction(packId, characterId)` → inserts subscription, increments `subscriber_count`
4. Creator can disable individual rules per subscription via `toggleSubscriptionRuleOverrideAction`
5. Reorder subscriptions via `reorderSubscriptionsAction` (affects CSS cascade and rule application order)

## selector contract additions

> ⚠️ 本节曾列出的 `#nj_pack_studio_left` / `#nj_pack_studio_right` / `.nj_pack_studio_tab`
> 在 studio 改版后已不存在于代码。selector 的唯一权威清单是
> `docs/contracts/nj-selectors.md`（§2.4 已于 2026-07-04 按代码盘点补全），这里不再维护副本。

`nj_pack_*` namespace 现存：`#nj_pack_studio`, `#nj_pack_studio_preview_canvas` 等（见字典 §2.4），另有 `#nj_char_subscribed_packs`, `.nj_char_pack_row`, `.nj_char_pack_override_toggle`
