# Opening Components — Handover

> Companion: [insights/opening-components.md](../insights/opening-components.md)
> Related: [handover/beautification-packs.md](./beautification-packs.md) · [handover/regex-system.md](./regex-system.md) · [handover/chat-pipeline.md](./chat-pipeline.md) · [handover/selector-contract.md](./selector-contract.md)

## What this is

A **second kind of in-pack item**, parallel to regex rules (dialogue
components). Whereas dialogue components match each turn's model output via
regex and re-derive from capture groups (so they change every turn), an
**opening component** is *static*: it matches nothing, renders once per
session in a standalone slot above the message stream, and never changes
after the conversation starts.

Opening components are **not** regex rules — no `pattern`, no capture groups,
no `output_guidance`, never folded into the system prompt. They're authored
directly (or via a dedicated AI generator) as self-contained HTML/iframe.

## Data model

`opening_components` (migration `drizzle/0008_opening_components.sql`):

| column | notes |
|--------|-------|
| `id` | uuid pk |
| `pack_id` | FK → `beautification_packs` (cascade) — opening components live in packs, alongside `regex_rules` |
| `name` | display name |
| `content` | self-contained HTML; `<artifact>…</artifact>` → iframe sandbox, else sanitize HTML (same routing convention as the regex segment pipeline) |
| `enabled` | bool |
| `order_index` | int |

Type exports: `OpeningComponent` / `NewOpeningComponent` (`schema.ts`,
re-exported from `@/types`). Migrations are hand-authored SQL applied by
`bun run db:migrate` (the drizzle journal is ignored — see `scripts/db-migrate.ts`).

## Access boundary — owner-private (the one rule that differs from regex)

A pack is subscribable/shareable. Regex rules from a subscribed pack apply to
the subscriber's character cross-owner. **Opening components do NOT.**

`loadCharacterOpeningComponents(characterId)` (`src/lib/opening/queries.ts`)
aggregates a character's subscribed packs' enabled opening components — but
JOINs `characters` + `beautification_packs` and keeps only rows where
`beautification_packs.owner_user_id == characters.owner_id`. So an opening
component only renders on the **pack owner's own** characters; subscribing
someone else's public pack never pulls in their opening components.

Note: this gates *other creators*, not players. A player chatting with the
owner's character still sees the opening component (it's the player-facing
opening experience). Non-owner UI surfaces also hide them: the pack detail
page (`/packs/[id]`) only shows the opening section + count badge when
`isOwner`, and `PackPreview` (the visitor surface) is never passed opening
components.

Authoring reads enforce the same boundary before data reaches the browser:

- `filterOwnerOpeningPacks()` removes other creators' public packs before a
  character create/edit route requests component content.
- `listOwnedPackOpeningComponents(packId, ownerUserId)` repeats the owner check
  in SQL by joining `beautification_packs`.
- Pack detail and Studio authorize the owner before querying full component
  rows.

This double check is intentional. `CharacterForm` is a Client Component, so
any prop passed to it is serialized into the RSC payload even when a nested UI
branch does not display it. Do not replace this with client-side hiding.

## Render path — standalone opening slot

- Chat RSC (`src/app/chat/[characterId]/page.tsx`) calls
  `loadCharacterOpeningComponents` and passes the list to `ChatRoom`.
- `ChatRoom` renders `<OpeningSlot>` at the top of `messagesNode` (inside the
  `#nj_chat_messages` scroll container, before `messages.map`).
- `OpeningSlot` (`src/components/chat/OpeningSlot.tsx`):
  - interpolates `{{char}}` / `{{user}}` (`interpolateOpening` in
    `src/lib/opening/content.ts`),
  - routes each component via `routeOpeningContent`: `<artifact>` → `RegexIframe`
    (the existing sandboxed host bridge, `captureGroups={[]}`), else
    `MessageRenderer` (sanitize),
  - is keyed/static by component id — it renders from the component content,
    never from messages, so it is immutable across turns.
- selector contract: `#nj_opening_slot` (add to selector-contract.md before launch).

## Authoring — studio AI-session flow (same as dialogue components)

Opening components are authored through the **studio session model**, identical
to dialogue components (`component`) and skins (`css`): pick in the chooser →
multi-turn chat in `AssistantTab` → AI emits a proposal → live preview in
`PreviewCanvas` → 「确认应用」commits. There is **no** standalone form or one-shot
generate box (an earlier draft had one; it was removed for a single path).

The `opening` pathway mirrors `component` end to end:

- **Session**: `studioSessions.type = "opening"`; edit target column
  `studioSessions.targetOpeningComponentId` (FK, mirrors `targetRuleId`).
  Created via `createStudioSessionAction({ type:"opening", targetOpeningComponentId? })`.
- **Chooser**: `NewSessionChooser` card 🎬 开场组件 → `handleCreate({type:"opening"})`
  (StudioLayout). Edit from the list/sidebar →
  `handleCreate({type:"opening", targetOpeningComponentId})`.
- **Generator**: the shared `pack-assistant` generator
  (`registry.ts` + `prompts/pack-assistant.txt`). When `sessionType==="opening"`
  it emits `<proposal type="add-opening">{name, content, description}` — static,
  no `$1/$2`, no pattern, no output guidance. `/api/ai/generate` injects
  `sessionType` + `targetOpening` (DB row or prior draft) server-side.
- **Proposal**: `ProposalAddOpening` parsed in `assistant-parser.ts`
  (`proposal-add-opening` segment) → `AddOpeningCard` (`ProposalCard.tsx`) →
  `onOpeningAdded` → `setSessionDraft({kind:"opening", opening})`.
- **Draft payload**: `StudioDraftPayload` variant `{kind:"opening", opening}`.
- **Preview**: `PreviewCanvas` focus `{kind:"opening", content, label}` renders
  the draft/persisted content via `routeOpeningContent` (html → `MessageRenderer`,
  artifact → sandbox placeholder), bypassing the regex-sample pipeline.
- **Commit**: `commitStudioSessionAction` → `writePackUpdates({newOpening | updatedOpening})`
  writes `opening_components` and returns the refreshed list.
- **Delete / reorder**: `src/lib/opening/actions.ts` keeps only
  `deleteOpeningComponentAction` + `swapOpeningComponentOrderAction`
  (used by `OpeningComponentList`); create/edit go through the session, so there
  is no standalone create/update action or form schema.
- **List**: `src/components/opening/OpeningComponentList.tsx` — studio passes
  `onCreate`/`onEditOverride`/`onDeleteOverride` (session-driven); the pack detail
  page (no callbacks) links create/edit into `/packs/[id]/studio`.
- **Sidebar**: `StudioSessionSidebar` lists opening sessions with edit/delete,
  resolving the target via `resolveTarget` (rule | opening).

selector contract: `#nj_opening_slot` (in selector-contract.md).
i18n: `dict.opening.*` + `dict.packs.studioSessionTypeOpening*` /
`proposalAddOpeningTitle` (`src/i18n/{types,zh,en}.ts`).

## Not built / future

- **Export/import**: no pack/character export module exists yet. When it's
  built, opening components must ride only in the **owner's own** export, never
  in any subscriber-facing extraction (owner-private).
- No per-user visibility toggle / per-subscription override for opening
  components in v1 (only `enabled` + subscription).
