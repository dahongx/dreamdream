# Chat Render Pipeline — Handover

> Companion: [insights/chat-pipeline.md](../insights/chat-pipeline.md)

The path between "AI streams a chunk" and "user sees a styled bubble"
is the densest part of the codebase. This is the map.

```
streamText (api/chat)
  → onFinish persists raw content + debug_info to messages table
  → client useChat() exposes m.parts[].text

For each rendered message:
  text
  → expandSpecialTags()       (W8) — <message>/<system>/<narration> → nj_*
  → findSafeBoundary(buf)     (W6) — cut at last unclosed `<`
  → applyRegexToSegments()    (W7) — split into html / iframe segments
       ├ sanitize segments → sanitizeHtml() + Markdown + rehypeRaw
       └ iframe segments   → <RegexIframe sandbox="allow-scripts" srcdoc=...>
  → trailing tail rendered raw (greyed) while streaming
```

## Per-step contract

### `expandSpecialTags(text)`

`src/lib/styling/special-tags.ts`. Pure string → string.

| Source | Output |
|--------|--------|
| `<message>x</message>` | `<div class="nj_ai_message_inner">x</div>` |
| `<system>x</system>` | `<div class="nj_message_system">x</div>` |
| `<narration>x</narration>` | `<div class="nj_message_narration">x</div>` |
| `<scenario>x</scenario>` | stripped (already in system prompt) |

Runs BEFORE user-defined regex rules so the platform's selector
contract always holds.

### `findSafeBoundary(buf)`

`src/lib/regex/stream.ts`. Returns index up to which applying regex
is safe — basically `buf.length` unless the buffer ends with an
unclosed `<`. The unsafe tail (a partial tag) is kept verbatim until
the next chunk arrives.

### `applyRegexToSegments(safeText, rules, { userPrefs })`

`src/lib/regex/segments.ts`. Walks rules in `orderIndex` order.
Returns:

```ts
type Segment =
  | { type: "html"; content: string }
  | { type: "iframe"; ruleId: string; ruleName: string;
      srcdoc: string; captureGroups: string[] }
```

Rule selection rules:
- `enabled=false` → skip
- `visible=true && userPrefs[id]===false` → skip (per-user opt-out)
- otherwise apply

`runtime='sanitize'` rules splice their replacement into an html
segment (substituting `$1..$9`). `runtime='iframe'` rules carve out a
dedicated iframe segment with raw captureGroups attached.

### `sanitizeHtml(htmlSegment)`

`src/lib/sanitize.ts`. DOMPurify isomorphic, config from W6:

- Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, all form
  elements, `formaction`, `srcdoc`
- Allows `<style>` blocks inside messages (creator-local theming)
- Whitelists `target`, `rel`, `class`, `style`, `data-*` attrs
- `javascript:` URIs blocked via `ALLOWED_URI_REGEXP`

### `<RegexIframe>`

`src/components/regex/RegexIframe.tsx`. Mounts one iframe per match.

- `sandbox="allow-scripts"` — no `allow-same-origin`, no
  `allow-forms`, no popups, no top-nav. Origin inside is `"null"`.
- CSP via `<meta http-equiv>` inside srcdoc:
  - `default-src 'self' 'unsafe-inline'`
  - `connect-src 'none'` ← absolute red line (no fetch/XHR exfil)
  - `script-src` + `style-src` whitelist: tailwindcss / jsdelivr /
    unpkg / fonts.googleapis / fonts.gstatic / cdnjs
  - `frame-src 'none'` (no nested iframes)
- Bridge script (built by `buildIframeSrcdoc`) wires `window.host`
  for RPC over MessageChannel — see Host API below

## Host API (iframe → host RPC)

| Method | Args | Returns | Backend |
|--------|------|---------|---------|
| `host.sendMessage({text})` | text | void | calls back into `useChat`'s sendMessage |
| `host.getHistory()` | — | `{role, content}[]` | host-side snapshot of current message list |
| `host.getCharacter()` | — | `{id, name, avatarUrl, tags, bio}` | character public meta only |
| `host.setComponentState({state})` | any | void | ephemeral, keyed by ruleId, lives in `useRef` |
| `host.context` | — | sync — `{captureGroups, userName, ruleId, ruleName}` | injected at init |

`setComponentState` is in-memory only in v1; the v1.5 plan is to
persist to `chat_sessions.component_states` jsonb.

## Debug pipeline

Each assistant message persists `debugInfo` jsonb in /api/chat
onFinish (W4/W6):

```ts
{
  rawOutput: string         // pre-regex
  systemPrompt: string      // assembled prompt
  matchedRules:   { id, name }[]
  unmatchedRules: { id, name }[]
}
```

Owner-only `<DebugPanel>` reads from the message's `initialDebug`
record and renders the folded panel under the bubble.

## What happens to user messages

User messages bypass the whole pipeline — just plain text in a bubble.
They're written to the messages table BEFORE the model call (so we
have them even if the model errors mid-stream).

## Why this is split across many small files

- `applyRegex` (single string) and `applyRegexToSegments` (array)
  share `buildRegExp` but produce different shapes — composing one
  from the other would force iframe rules into the wrong path.
- `findSafeBoundary` is a pure function with one job; isolating it
  makes the streaming test trivial.
- `buildIframeSrcdoc` is server-renderable HTML; keeping it out of
  the component means the React boundary stays clean.
