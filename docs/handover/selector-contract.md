# Selector Contract — nj_*

> Companion: [insights/global-styling.md](../insights/global-styling.md)

This document lists every stable `nj_*` selector that 寄情 (Dearm) exposes
to creators via the `global_css` field on `characters`. Once a selector
appears here it is **API**: breaking changes require a deprecation
window with an alias kept for at least one major version (per
v1-foundation.md §模块 5.1).

## Scope

All creator CSS is auto-scoped to the chat surface via a wrapper element
that carries `data-character-css="<characterId>"`. The CSS allowlist
walker (`src/lib/styling/whitelist.ts`) prepends
`[data-character-css="<characterId>"] ` to every selector. Creators
should write selectors **as if they were global** — the walker handles
scoping.

```css
/* creator writes this */
.nj_ai_message_bubble { color: #d4af37 }

/* walker emits this */
[data-character-css="abc-123"] .nj_ai_message_bubble { color: #d4af37 }
```

## Selectors

### Stage shell

| Selector | Type | Where |
|----------|------|-------|
| `#nj_chat_app` | id | `<ChatStage>` root that wraps the whole chat surface |
| `#nj_background_image` | id | Character cover-image background layer |
| `#nj_background_overlay` | id | Readability overlay (~60% base) above the background image |

### Chat header

| Selector | Type | Where |
|----------|------|-------|
| `#nj_chat_header` | id | `<header>` at the top of `<ChatRoom>` |
| `#nj_back_button` | id | Back-to-sessions button (top-left) |
| `#nj_header_clarity_btn` | id | Clarity / focus-mode toggle (top-right) |

### Session sidebar

| Selector | Type | Where |
|----------|------|-------|
| `#nj_chat_sidebar` | id | Session list container — same id on desktop column and mobile drawer |
| `.nj_chat_sidebar_item` | class | Each session row inside the sidebar |

### Message list

| Selector | Type | Where |
|----------|------|-------|
| `#nj_chat_messages` | id | Scroll container for messages |
| `#nj_opening_slot` | id | Standalone opening-component slot, rendered once at the top of the message scroll container (static, owner-private; see [opening-components.md](./opening-components.md)) |
| `.nj_ai_message_row` | class | Outer row wrapping a single assistant turn (layout-only) |
| `.nj_user_message_row` | class | Outer row wrapping a single user turn (layout-only) |
| `.nj_message_bubble_row` | class | Inner row pairing the AI bubble with its avatar |
| `.nj_ai_message_bubble` | class | Each assistant message bubble |
| `.nj_user_message_bubble` | class | Each user message bubble |
| `.nj_message_system` | class | Content emitted by `<system>...</system>` special tag |
| `.nj_message_narration` | class | Content emitted by `<narration>...</narration>` special tag |
| `.nj_message_think` | class | Content emitted by `<think>...</think>` special tag (collapsible) |
| `.nj_scenario_section` | class | Content emitted by `<scenario>...</scenario>` special tag |
| `.nj_artifact_iframe` | class | LLM-emitted `<artifact>` block rendered as a sandboxed iframe |
| `.nj_regex_iframe` | class | Each runtime='iframe' regex segment iframe |

### Composer

| Selector | Type | Where |
|----------|------|-------|
| `#nj_chat_input_container` | id | `<form>` wrapping the composer |
| `#nj_chat_input_box` | id | The composer `<textarea>` |
| `#nj_chat_send_button` | id | The send `<button>` |

### Inside-message conventions (creator-added classes)

Creators may attach the following classes inside their `replacement` HTML
or AI output to opt into platform-defined styling defaults:

| Selector | Convention |
|----------|------------|
| `.nj_emphasis_text` | Inline emphasis (gold + bold by default) |
| `.nj_code_block` | Code blocks the platform emits |
| `.nj_env_panel` | Reference name used by the built-in env-state-panel template — rename freely on your own card |
| `.nj_memory` | Reference name used by the built-in dynamic-memory template |

### Safe non-`nj_*` selectors

The CSS walker also permits styling these bare HTML tags so creators can
style markdown output:

```
details summary
details li
pre
code
strong
em
ul ol li
blockquote
```

`html`, `body`, `:root`, and `*` are **blocked** by the walker.

## Special tags (parsed before regex rules)

Some XML-style tags get rewritten by the platform before user-defined
regex rules run, so they always render to a known class:

| Source                              | Renders as                                            |
|-------------------------------------|-------------------------------------------------------|
| `<message>...</message>`            | `.nj_ai_message_bubble` (the bubble is the content)  |
| `<system>...</system>`              | `<div class="nj_message_system">...</div>`           |
| `<narration>...</narration>`        | `<div class="nj_message_narration">...</div>`        |
| `<think>...</think>`                | `<div class="nj_message_think">...</div>` (collapsible) |
| `<scenario>...</scenario>` / `<sce>`| `<div class="nj_scenario_section">...</div>` (creator-styled) |
| `<artifact>...</artifact>`          | `<iframe class="nj_artifact_iframe">` (sandboxed)    |
| markdown `**bold**`                 | `<strong>...</strong>` (creator may style `strong`)  |
| markdown ` ```...``` `              | `<pre><code>...</code></pre>`                        |

## CSS allowlist

The walker permits these properties + value families:

- Colors: `color`, `background`, `background-*`, `border-color`
- Typography: `font-*`, `letter-spacing`, `line-height`, `text-*`
- Box: `border`, `border-*`, `border-radius`, `outline`, `outline-*`
- Shadow / filter: `box-shadow`, `text-shadow`, `filter`, `backdrop-filter`
- Opacity / transform / animation: `opacity`, `transform`, `transition`, `animation`, `@keyframes`
- Spacing: `margin`, `padding`, plus flex/grid layout (`flex-*`, `grid-*`, `gap`, `align-*`, `justify-*`)
- Visibility / overflow: `visibility`, `overflow`

Blocked properties / values:

- `position: fixed | sticky` (relative / absolute scoped within selector are fine)
- `pointer-events` (any value)
- `cursor: none`
- `z-index > 100` (clamped to 100)
- `@import` (any form)
- `expression(...)`
- `url(javascript:...)`

@-rules allowed: `@keyframes`, `@media`, `@supports`. Others are stripped.

## Deprecation policy

If a selector is renamed:

1. New name lands in this doc + the codebase
2. Old name kept as an alias for at least one major version (`nj_old` →
   `nj_new` redirect via a CSS shim in `globals.css`)
3. CHANGELOG entry explicitly notes the alias

Creators reading this doc should rely on the table above as the
contract. Any selector elsewhere in the codebase that lacks an entry
here is **not** stable.

## Reserved for v1.5+

The following selectors are NOT in the v1 contract — they will be
added when the corresponding features ship. Creators writing CSS
should treat them as non-existent until they land here:

- `#nj_author_note` — author's-note panel (free-form text per
  session, akin to SillyTavern's). Pending UI design.

## Not part of the platform contract

The `nj_phone_*` family (e.g. `.nj_phone_shell`, `.nj_phone_wechat_row`)
ships inside the built-in **yearn-phone** regex preset. Those classes
are owned by the preset's `replacement` HTML, not by the platform —
copies of the preset live entirely inside individual creator cards and
move with them. Don't rely on them from `global_css`.

Likewise the studio-side selectors (`#nj_chat_app` aside) such as
`.nj_pack_studio_*`, `.nj_character_form`, `.nj_show_nsfw`, and
`.nj_locale` exist on creator-side authoring pages, not the chat
surface that `global_css` targets. They are intentionally outside
this contract.
