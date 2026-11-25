# Regex System — Insights

> Companion: [handover/regex-system.md](../handover/regex-system.md)

## User problem

Creators want to make AI roleplay output _legible_:
- Rich status panels (time / weather / mood) every turn
- Short XML-tag protocols (`<env>...</env>`) for compactness
- Stable visual hierarchy (system block ≠ AI bubble ≠ narration)

Without regex they'd have to invent prompt tricks that break across models
and refactors. Competing platforms nailed this with a manual regex authoring surface; we
inherit the model and lower the friction (built-in templates, test panel,
output-guidance auto-injected into system prompt).

## Design rationale

### Why separate `output_guidance` from `replacement`?

A single rule pulls double duty. The `replacement` tells the renderer what
to make of the AI's XML output. The `output_guidance` tells the AI **when**
to emit the XML in the first place. Conflating them would force creators
to manually duplicate the schema in two places. By keeping
`output_guidance` first-class and folding it into the system prompt under
`## 扩展标签协议` (placed right after the host's `## 渲染协议` so保留标签 +
自定义标签作为同一族协议被 LLM 一起吸收), we get a single source of truth
that the LLM and the renderer both see.

### Why `gms` default flags?

`g` is necessary (`replace` only matches the first occurrence otherwise).
`m` makes line anchors useful when creators write `^.*$` patterns. `s`
makes `.` match newlines — almost everyone wants this for multiline XML
output. Creators who need stricter semantics can fall back to `/body/flags`
literal form.

### Why a separate `runtime` field?

The plan calls for double-track rendering — DOMPurify for static HTML and
iframe sandbox for `<script>`. Pinning the path on the rule itself (not on
the message) means rules can be authored once and the rendering decision
is stable. W7 will read this field to dispatch.

### Why does the test panel show raw HTML?

Creators are editing their own rules on their own character cards. The
preview is what they'd see if everything sanitized — but in v1 W4 we
don't have DOMPurify on the render path, so the preview is "trusted creator
content rendered in their own browser session". Treat the surface area as
no different from `dangerouslySetInnerHTML` in a creator-only editor. W6
swaps in sanitize so the preview becomes truthful for the live chat.

## What surprised me building this

- **XML-sample auto-derive needs document-order traversal.** fast-xml-parser
  returns an object tree, which is fine for parsing but loses ordering and
  whitespace. Capture groups need to be `$1, $2, $3` in tag order, so I
  hand-rolled a tag-span scanner that respects appearance order. This is
  the only place v1 reaches past fast-xml-parser.
- **Match-and-skip-disabled needs `enabled` AND `visible+pref` checks.**
  The most natural way to think about a switch was a single boolean; in
  practice the visibility opt-in creates a 2D matrix (owner-on/off ×
  user-on/off/never-asked). The decision tree lives in `applyRegex`.
- **`mode` / `toolType` were over-engineered.** Original schema split rules
  into `general` (write your own pattern) vs `tool` with four subtypes
  (`code_component` / `symbol_match` / `text_style` / `content_filter`).
  In practice 99% of usage was `code_component` and the rest were edge
  features creators rarely reached for. Cut both fields entirely
  (2026/05/22) — the form now has a single path: optional XML sample
  auto-derives pattern, creator writes replacement. Smaller mental model,
  one fewer "what does this mean?" decision in the create flow.

## What I'd want for V1.5

- ReDoS pattern linter (warn on `.*.*.*` style)
- Multi-rule test panel (apply ALL of a character's rules to a fixture)
- Rule reordering UI (drag in the list view; v1 forces creators to edit `orderIndex` manually)
- "Regenerate pattern from target" button (currently the effect runs only
  when targetText changes — if creator manually edits pattern then wants to
  revert, they have to clear targetText and re-paste)

## Future-facing

- **A creator-AI symbiosis is the real moat.** The "✨ AI 生成" buttons
  (W9) for replacement HTML / CSS / output guidance / target text fold
  the LLM into the authoring loop. Once that ships, the unit of "I have
  an idea" → "this is a working rule" should be <5 minutes.
- **Visibility opt-in becomes a community signal.** A `visible=true` rule
  is the creator saying "users can turn this off if they want lighter
  output". Long term, surface this in the chat sidebar so users have
  one-click control.
