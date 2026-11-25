# Global Styling — Insights

> Companion: [handover/selector-contract.md](../handover/selector-contract.md)

## Why a custom CSS walker (not postcss)

Postcss would be more thorough — full AST, plugin ecosystem, value-level
parsing. Trade-offs:

- ~80KB on the chat-page bundle even with tree-shaking
- One more "magic abstraction" creators don't see but their CSS has to
  pass through
- We're only doing a handful of checks: scope prefix, selector head
  inspection, a small set of property-value blacklists

For v1 the cost/benefit tilts toward the hand-rolled scanner. If the
selector list or rule set grows beyond ~50 entries, postcss becomes
worth it.

## Scope-by-attribute vs Shadow DOM

Two options for keeping creator CSS from leaking globally:

1. Shadow DOM around the chat surface
2. `[data-character-css="<id>"]` attribute on a wrapper + prefix-walker

Shadow DOM is cleaner but breaks things v1 relies on: react-markdown
output flows through unstyled (we'd have to ship Tailwind into the
shadow root); accessibility flows like screen-readers handle shadow
roots inconsistently; and Next.js + RSC streaming through a shadow root
is a maze.

The attribute-prefix approach is uglier (every selector gets a 30-char
prefix) but works with the existing render tree and the runtime cost is
zero. Pick uglier-but-works for v1.

## Why bake `<message>` / `<system>` / `<narration>` in

These three tags are part of the platform contract. If creators could
override them via regex rules with the same name, one card's CSS
expectations could be silently broken by another card's regex on the
same page (e.g. exporting / forking).

Baking the expansion into a pre-pass before user regex rules see the
output means the selectors are always `nj_ai_message_inner` /
`nj_message_system` / `nj_message_narration` — predictable, no
collision space.

`<scenario>` is the odd one — it's stripped at render time because it
was already folded into the system prompt during session init. Leaving
it visible would double-render the scenario the AI is already
referencing.

## What I'd ship in v1.5

- **Live preview in the editor.** Right now creators have to save the
  card and refresh the chat page to see CSS take effect. A `<style>`
  attached to a hidden mock chat preview inside the editor would close
  the loop.
- **Warning visibility.** `sanitizeAndScopeCss` returns warnings; they
  go to `console.warn` only. Surface them in the editor next to the
  textarea so creators see "@import blocked" inline.
- **Selector-coverage helper.** When a creator writes
  `.nj_chat_unknown { ... }` we silently drop it (no match in the
  contract). A "Did you mean `.nj_chat_input_container`?" hint would
  save head-scratching.

## Future-facing

- **Theme inheritance.** Creators could write `--accent-primary: gold`
  in their CSS and the host design tokens would cascade. Today the host
  uses CSS custom properties (`var(--accent-primary)`) for most colors,
  so this almost works for free — but enabling it means relaxing the
  walker on `:root` slightly.
- **Component states ↔ CSS.** Once `chat_sessions.component_states`
  lands (v1.5), creators can transition iframe-component CSS based on
  state attributes — e.g. `[data-dearm-mode="dark"] .nj_dearm_phone`.
