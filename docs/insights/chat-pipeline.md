# Chat Render Pipeline — Insights

> Companion: [handover/chat-pipeline.md](../handover/chat-pipeline.md)

## Why two render paths

Competing platforms ship one render path (sanitize) and one workaround for the case
sanitize can't handle (`window.parent.document` DOM-hacks from a
`<script>` tag inside a regex replacement). That workaround is also the
exfiltration channel: anything the creator script does in the parent
DOM is by definition unisolated.

We split early so the unsafe path is constrained from day one:

- **sanitize path** for state panels, themed bubbles, simple custom
  tags. DOMPurify enforces the boundary.
- **iframe path** for interactive components (Dearm phone, an
  inventory grid that expands on click). `connect-src 'none'` is the
  red line — even with `allow-scripts`, the iframe cannot fetch
  externally, can't postMessage to a known URL, can't open a websocket.
  All it can do is talk to us through the host bridge.

The split decision happens at rule-author time (`runtime` field),
not at render time. That keeps the runtime branching simple and lets
us validate rule semantics during creation.

## Why the streaming buffer cuts at `<`

A regex like `<env>(.*?)</env>` can't match `<env>...</en` (no closing
`>`). If we apply rules on every chunk, the user sees `<env>` flicker
into rendered HTML and back. The fix is "don't try if you don't have
the close tag yet" — `findSafeBoundary` cuts at the last unclosed `<`.

This means the streaming tail can be longer than ideal when the model
emits long tag bodies. Trade-off accepted: visual stability beats
"render every keystroke."

## Why special tags get a pre-pass

The selector contract promises `nj_ai_message_inner` (for `<message>`)
and `nj_message_system` (for `<system>`). If creators could name a
regex rule "message" with their own pattern, two cards could ship
incompatible CSS expectations.

We bake the special tags into a pre-pass that runs BEFORE user-defined
regex rules. The downside is creators can't override the special tags
(by design) — but they can layer additional rules on top, since the
output of the pre-pass is already in `nj_*` form.

## Why segments instead of a single sanitized string

The plan originally returned a single HTML string from `applyRegex` and
let DOMPurify strip `<script>` / `<iframe>`. That works for the
sanitize path but loses the iframe path entirely (script gets stripped,
iframe gets stripped, the creator's interactive component never runs).

Returning segments means iframe-mode rules carve out their slot during
the regex pass. The React render then dispatches per-segment:
sanitized HTML for one, `<RegexIframe>` for the other. The boundary
between "trusted to render as HTML" and "untrusted, must be sandboxed"
is the segment type — not a string transformation that could ever
collapse them.

## Why `host.context.captureGroups` AND `host.getHistory()`

Two access patterns:

- **Static reference** (`captureGroups`): the iframe just needs the
  $1 / $2 that triggered it. Always there, synchronous, no roundtrip.
- **Dynamic query** (`getHistory()`): the iframe wants the full
  conversation context to render history-aware UI. Lazy + async.

Either alone is awkward. With both, creators write whatever they need.

## What I'd build next

- **Component state persistence.** `setComponentState` is in-memory
  only today. A `chat_sessions.component_states` jsonb column would
  let Dearm phone-style components remember scroll position / last
  state across page reloads. The migration is small and explicitly
  called out in v1-foundation.md §11.
- **History windowing.** `getHistory()` returns the entire array
  today. For long sessions this is fine (chat history is just text),
  but if creators write expensive components we might want pagination.
- **Per-iframe quotas.** A creator with a deliberate infinite loop in
  their `<script>` can lock up the iframe. Browser sandboxing protects
  the parent, but the iframe itself can chew CPU. v1.5 could add a
  watchdog that kills + remounts an iframe that's blocked the main
  thread N times.

## What surprised me

- **Iframe origin is `"null"`, not `"about:srcdoc"`.** Spent an
  embarrassing amount of time trying to use `origin` checks in the
  postMessage handler before realizing the sandbox origin is always
  `"null"` and no check is meaningful. Switched to MessagePort-based
  RPC (the bridge sends + receives via a pre-shared port handle,
  origin checks become unnecessary).
- **`react-markdown` + `rehype-raw` does fold in `<style>` blocks
  inside messages.** Convenient — creators can write per-message
  themed cards in their replacements without going through
  `global_css`. Slightly worried about CSS leakage across messages;
  the scoped `[data-character-css]` attribute mitigates the cross-
  card case but not the cross-message-within-the-same-card case. Not
  exploitable, just untidy.
