# Beautification Packs — Product Insights

**Related:** [docs/handover/beautification-packs.md](../handover/beautification-packs.md)

## Why we decoupled

The original design bound regex rules and CSS to a single character card. This worked for v1 MVP but created a ceiling: a creator who built a great "小手机" component had to manually copy it into every new character. There was no way to share or reuse.

Competitor research showed that the most engaged creators on competing platforms maintain a personal "美化库" — a set of components they apply across all their characters. That's the mental model we're building toward.

## Subscription vs fork

We chose **subscription** (live sync) over fork (copy-on-create) because:
- Creators iterate on their packs constantly — a fork model means every character drifts out of sync
- The "小手机" use case is exactly this: one author maintains the component, dozens of characters use it, author fixes a bug and everyone benefits immediately
- The downside (author breaks something → all subscribers affected) is acceptable at this scale; we surface subscriber count before deletion as a warning

## CSS ordering

Multiple subscribed packs concatenate their CSS in `subscription.order_index` order. Later packs override earlier ones (standard cascade). The UI lets creators drag-reorder subscriptions, which is the primary tool for resolving conflicts. We don't enforce namespace isolation in v1 — creators are expected to use `nj_*` selectors per the selector contract.

## The studio editor

The left/right split editor is deliberately minimal in v1:
- No Monaco/CodeMirror — plain textarea with mono font. The audience is creators who already know CSS; syntax highlighting is nice-to-have, not blocking.
- AI assistant tab gives suggestions but never auto-applies. This is intentional: auto-patching a creator's carefully crafted CSS would be a trust violation. The assistant is a collaborator, not an autopilot.
- Preview uses mock messages. We can't simulate real model output, and we say so explicitly in the UI. The preview is for visual iteration, not behavioral testing.

## What's next (v1 post)

- Pack-level CSS namespace isolation (prefix all selectors with `[data-pack-id="..."]`)
- Soft-delete for public packs (warn subscribers before deletion, offer archive)
- Pack versioning / changelog
- "Fork this pack" for users who want to customize a public pack without affecting the original
