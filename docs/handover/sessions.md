# Sessions Module — Handover

> Companion: [insights/sessions.md](../insights/sessions.md)
>
> Render-side details live in [chat-pipeline.md](./chat-pipeline.md);
> this doc focuses on the session lifecycle (create / name / persist
> / delete) and where the messages table fits in.

## Schema

```
chat_sessions {
  id              uuid PK
  user_id         uuid FK → users(id)        cascade
  character_id    uuid FK → characters(id)   cascade
  title           varchar(256) nullable
  created_at      timestamptz default now()
  updated_at      timestamptz default now()
  last_message_at timestamptz default now()
}

messages {
  id           uuid PK
  session_id   uuid FK → chat_sessions(id)   cascade
  role         text  'user' | 'assistant'
  content      text  raw model output (no regex pass)
  rendered_html text  applyRegex output (null if no rules changed it)
  model        varchar(64)  e.g. 'claude-sonnet-4-6'
  tokens_in / tokens_out / latency_ms  int
  debug_info   jsonb {
    rawOutput, systemPrompt,
    matchedRules:   [{id, name}],
    unmatchedRules: [{id, name}],
  }
  created_at   timestamptz default now()
}
```

Index: `messages(session_id, created_at)` covers the chat-page history
fetch. Sessions list query uses `chat_sessions(user_id, last_message_at desc)`.

## Create — `createSessionForCharacter`

Server action in `src/lib/sessions/actions.ts`. Flow:

1. Resolve current user
2. Load the character; refuse if private and not owned by current user
3. Resolve `userCtx = { char, user }` for `{{char}}` / `{{user}}` interpolation
4. INSERT a new session with `title = character.name` (seed)
5. **Bump** `characters.conversation_count` via `sql\`${col} + 1\`` (fixed v1.8)
6. Parse `character.opening` with `parseOpening`; INSERT any `<message>` bodies
   as assistant rows (interpolated). `<scenario>` and `<system>` aren't
   stored — they get folded into the system prompt at /api/chat time.
7. `redirect(\`/chat/\${session.id}\`)`

The opening parser tolerates loose / non-tagged text by treating it as
an implicit `<message>` (see `parseOpening` in `build-prompt.ts`).

## Auto-name — `/api/chat` first message

When the first user message lands, /api/chat checks if `session.title`
still equals `character.name` (the seed). If yes, calls
`deriveSessionTitle(lastText)` and updates the title.

`deriveSessionTitle` (in `src/lib/sessions/title.ts`) is a pure helper:

- collapses whitespace runs to single spaces
- empty input → `null` (caller keeps the seed)
- caps at 40 chars
- prefers cutting at a late-string space if one falls past index 32
- strips trailing sentence-cutoff punctuation

Only fires on the first message because subsequent ones see
`title !== character.name`. So if v1.x adds manual rename, the
auto-name path doesn't fight it.

## Read — `getSessionWithMessages` / `listSessionsForUser`

`getSessionWithMessages(id, userId)` returns null on owner mismatch
(don't leak existence to the wrong user). Returns
`{session, character, messages[]}`.

`listSessionsForUser(userId)` is the sidebar query: joins to
`characters` for name + avatar, orders by `last_message_at desc`.

## Persist a turn — `POST /api/chat`

1. Auth + ownership check on session
2. Load character, regex rules, user prefs via `loadRulesAndPrefs`
3. Append user message to messages table
4. Auto-name if needed (see above)
5. `buildSystemPrompt({ character, user, rules })` — system prompt
   includes regex `output_guidance` aggregation (see [regex-system.md](./regex-system.md))
6. `streamText` from AI SDK with `defaultModel()`
7. `onFinish`:
   - Run `applyRegex` on the final assistant text
   - Persist assistant row with `content`, `rendered_html` (null if
     regex didn't change anything), model / tokens / latency / debug_info
   - Update `chat_sessions.last_message_at` so the sidebar reorders

## Delete — `deleteSessionAction`

Owner-only (`WHERE user_id = $current`). Cascades to messages via FK.

`conversation_count` on the character is NOT decremented — the counter
tracks "lifetime starts", not active threads, so backups / restores
don't make it wobble.

Wired into the chat sidebar (`<SessionDeleteButton>`, v1.8) with a
window.confirm gate. If deleting the active session, the client
redirects to /explore so the user doesn't land on a 404.

## Visibility integration

Sessions inherit access from the character:

| character.visibility | session creation | session read | session delete |
|----------------------|------------------|--------------|----------------|
| `public` | any user | session owner | session owner |
| `unlisted` | any user with link | session owner | session owner |
| `private` | owner only | session owner | session owner |

Once the session exists, only the session's `user_id` can read or
delete it — no separate sharing model in v1.

## Debug info

Per-assistant-message jsonb (see schema). Populated in onFinish from
the regex pipeline + the assembled system prompt. Surfaced via
`<DebugPanel>` on the chat page when the **Debug** toggle is ON and
the current user is the character's owner.

Size: ~1–5KB per AI message; mostly the system prompt. v1 stores it
all in one column. The 模块 8 plan describes a `debug_summary` /
`debug_full` split for when the DB gets crowded — not needed yet.

## Cascade map

When a character is deleted:
```
characters → chat_sessions → messages   (FK cascade)
characters → regex_rules                 (FK cascade)
regex_rules → user_regex_preferences     (FK cascade)
users      → chat_sessions → messages    (FK cascade)
users      → characters → ...            (FK cascade)
```

So `deleteCharacterAction` (v1.13) is intentionally a hard wipe — the
DB walks all four cascades. Hence the name-echo confirm in
`<DeleteCharacterButton>`.

## What's NOT in this module

- Manual session rename — `deriveSessionTitle` only fires once;
  there's no UI to edit `title` afterwards (v1.5)
- Branch a session — the "what if I'd said X instead?" workflow.
  Would need session copy semantics like character clone
- Sharing a session URL with another user — sessions are strictly
  per-`user_id`
- Search inside session history — not in v1 (Postgres full-text
  could do it cheaply)
