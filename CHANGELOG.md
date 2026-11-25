# Changelog

## v1.x post-ship polish — 2026-05-18 → 2026-05-19

Eighteen small commits closing real shortfalls that surfaced after v1
landed. Each is documented in detail in its own commit message.

### Chrome / surface gaps

- **v1.5** — `/mine` library page (rail link was a dead 404)
- **v1.6** — `/settings` page (display name → `{{user}}` substitution,
  username, sign out)
- **v1.12** — `/chat` (no sessionId) redirects to most recent session
  or `/explore`; branded `not-found.tsx`
- **v1.14** — branded `error.tsx` (was Next default stack trace) +
  `loading.tsx` (consistent breathing-dots vocabulary)
- **v1.17** — `/signin` no longer throws on form submit when
  `EMAIL_SERVER` is unset (default dev state). Server-side env gate
  renders a dev-mode card instead of the form.

### Bugs caught (not just polish)

- **v1.8** — `characters.conversation_count` was never incremented;
  /explore "popular" sort was silently identical to "latest". Fixed
  with `sql\`... + 1\`` inside `createSessionForCharacter`. Also: no
  UI to delete a session, added with confirm gate.
- **v1.10** — regex form's test panel rendered raw HTML; chat surface
  ran the same content through DOMPurify + segments. Preview was
  lying to creators about what would actually render. Now goes
  through `expandSpecialTags → applyRegexToSegments → sanitizeHtml`
  same as production.
- **v1.13** — `deleteCharacterAction` had shipped in W2 but no UI ever
  called it (same shape as session-delete). Wired into edit page with
  name-echo confirm. Also explicit owner-only redirect.

### Creator UX

- **v1.1** — visible-rule toggle for end users in chat header (schema
  + server action shipped W1, UI was missing)
- **v1.4** — regex rule up/down reordering buttons (was: manually type
  orderIndex)
- **v1.9** — auto-name sessions from first user message (was: every
  thread titled with character name → indistinguishable in sidebar)
- **v1.11** — character clone action (private fork, ownerId rewritten,
  reuses export pipeline)

### Performance / correctness

- **v1.3** — `applyRegex` stopped double-compiling regex per match
  (was O(matches²)). Substitutes `$1..$9 / $&` from callback args
  directly.

### Docs / tests / examples

- **v1.2** — 28 new tests covering import-export schema, AI registry,
  segments / iframe (75 total)
- **v1.3** — `docs/handover/ai-generators.md`, `docs/insights/
  ai-generators.md`, `docs/handover/chat-pipeline.md`, `docs/insights/
  chat-pipeline.md`
- **v1.7** — README post-ship refresh (v1 surface table, security
  contract); seed exports under `public/examples/` (one full
  character card + one regex pack), linked from the relevant empty
  states for cold-start creators
- **v1.9** — `deriveSessionTitle` + 7 case tests (82 total)
- **v1.16** — `docs/handover/characters.md` + `docs/insights/
  characters.md` (CRUD lifecycle, visibility matrix, opening parser
  semantics, owner-enforcement layers)
- **v1.18** — `docs/handover/sessions.md` + `docs/insights/
  sessions.md` (lifecycle, auto-naming, cascade map, debug_info
  storage). Module-level docs coverage now 7/7.

## v1.0 — 2026-05-18

First public-shaped release. Eight major modules from the v1 foundation
plan landed across W1–W10. Highlights:

### Modules

- **Explore** (W2 + W10 polish) — character grid with NSFW toggle,
  search by name/bio, tag filter chips, latest/popular sort
- **Chat** (W3 + W6/W7) — streaming chat via Vercel AI SDK + Claude
  Sonnet 4.6, regex-applied / DOMPurify'd / markdown-rendered bubbles,
  iframe sandbox path with host postMessage API
- **Characters** (W2) — 16-field CRUD with A/B/C grouped form
  (info / persona / advanced)
- **Regex system** (W4 + W5) — schema + general/tool modes, 6-step
  workflow, output_guidance integration into system prompt
- **Sanitize render path** (W6) — applyRegexStreaming + DOMPurify +
  react-markdown + rehype-raw
- **iframe sandbox path** (W7) — RegexIframe + CSP + host API
  (sendMessage, getHistory, getCharacter, setComponentState)
- **Debug mode** (W6) — owner-only toggle, per-bubble panel exposing
  rawOutput / matched rules / unmatched / token / latency / system prompt
- **Global styling** (W8) — `nj_*` selector contract, CSS allowlist
  walker with scope prefix, special-tag pre-pass (`<message>` / `<system>`
  / `<narration>`)
- **AI authoring helpers** (W9) — 4 generators (target-text /
  replacement-html / global-css / output-guidance) behind
  `/api/ai/generate` with prompt templates sealed server-side, 20 req/hr
  rate limit
- **Import / export** (W10) — JSON character + regex_rules payloads,
  zod-validated, version-gated; owner-rewrite on import; downloadable via
  `/api/export/*`

### Stance kept

- Zero content moderation. `nsfw` is metadata only.
- No content marketplace. JSON exports are creator-owned and
  platform-blind.
- Selector contract (`nj_*`) treated as API once published.

### Known v1.5 work

- Streaming-incremental refinement of `applyRegexStreaming` for
  pathological patterns
- `chat_sessions.component_states` jsonb for cross-session iframe state
- Image re-host on cross-instance import
- Image upload (R2)
- Auth SMTP wired (W1 deferred dev fallback in place)
- Live preview in CSS editor

See `docs/handover/*` for per-module technical detail and
`docs/insights/*` for design rationale.
