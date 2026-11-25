# Sessions Module — Insights

> Companion: [handover/sessions.md](../handover/sessions.md)

## Why auto-name from the first user message, not the first AI reply

Considered both. AI reply has the advantage of being more
descriptive ("She tells you about the bookstore"). But:

- AI replies are long — truncating loses meaning faster than for
  short user prompts
- The first AI reply often *quotes* the opening `<message>` field
  before doing anything else, so the title would just be the
  opening line repeated across every session of the same character
- User prompts are what the user remembers; "the night I asked about
  the umbrella" is more recallable than "She said something poetic
  about umbrellas"

User-message naming also has zero latency: it lands the moment the
first POST /api/chat completes, not after streaming finishes.

## Why `conversation_count` doesn't decrement on session delete

The denormalized counter tracks "how many threads have ever existed",
not "how many are currently open". Three reasons:

1. **Backup / restore wobble.** If a user nukes 100 sessions, the
   character's count drops from 100 to 0 then any restore push it
   back up. Sort order would be unstable in a way that's hard to
   explain.
2. **Spam-clean defense.** Deleting old sessions shouldn't be a way
   to deflate your own card's apparent popularity.
3. **/explore "popular" sort intent.** What we want to surface is
   "the cards people keep coming back to" — a high-traffic card
   with a churning session history is still high-engagement.

Cost: the counter overstates active engagement slightly. The plan
explicitly calls this a denormalized counter, refreshed lazily; once
it matters we can add a periodic batch job to reconcile.

## Why opening `<message>` bodies are persisted, not synthesized

Two options at session-create time:

1. **Synthesize on read** — every time `getSessionWithMessages`
   fires, parse the character's opening and prepend the messages
2. **Persist at create** — INSERT actual rows once

Option 2 wins on three axes:

- **Edit semantics.** What if the creator edits the opening field
  later? With option 1, all existing sessions' opening lines
  suddenly change — which feels like history rewriting itself. Option
  2 freezes the opening at session-creation time.
- **Tokens.** Once persisted, the opening is just a regular message;
  it goes through the same regex pass + applyRegex caching + tokens
  counter as everything else.
- **iframe host API.** `host.getHistory()` returns the message list
  verbatim. Synthesized rows would either be missing (creators write
  components expecting them) or specially-flagged (bridge contract
  gets ugly).

The trade-off is that mid-flight changes to `opening` only affect
new sessions. That's the right default; if a creator needs to retcon
an old session they can delete it and create a fresh one.

## Why debug_info goes in messages, not its own table

Considered both. Single-column wins because:

- Debug data is **per-AI-message** — joining `messages` with a
  separate `message_debug` table for every read is wasteful
- The 1–5KB jsonb fits cleanly in the row's TOAST buffer; Postgres
  handles wide jsonb columns well
- The 模块 8 plan describes a future split into `debug_summary` (always
  loaded) + `debug_full` (on-demand). That split is easy to add
  later without breaking the current callsites — just rename the
  column and add a `debug_summary` jsonb of common subset fields

## Why session-delete cascades but character-delete name-echo confirms

Both are owner-only, both cascade through FKs. The asymmetry in UX
isn't accidental:

- A character is "a thing I built" — long-lived asset, irreplaceable
  if not exported. Worth a name-echo confirm + an "export JSON first"
  hint in the danger-zone hint text.
- A session is "a conversation I had" — short-lived, frequently
  spawned and abandoned. Simple "are you sure?" is enough friction.

Both shipped in v1.8 (sessions) and v1.13 (characters).

## What surprised me

- **Auto-name's "only fire when title equals character.name" guard
  is more robust than it looks.** Considered using a separate
  `auto_named_at` column, then a `boolean has_been_renamed`. Both
  introduced state that could get out of sync. The simple
  equality-check is self-healing: if the title ever happens to
  match the character name again (e.g. someone manually renames
  back to it), the next message will re-name from current content,
  which is probably what the user wanted anyway.
- **`last_message_at` is fed by `chat_sessions.updated_at` in many
  Drizzle-style places.** Not here: we keep them separate so
  schema migrations that touch other columns don't perturb the
  sidebar ordering.

## What I'd build next

- **Manual rename.** Pencil icon on the sidebar row → editable title.
  Once the user renames, the auto-name path stays off (handled by
  the equality check already in place).
- **Branch a session.** "What if?" copy that forks at a specific
  message. Same primitive as `cloneCharacterAction` — read source,
  insert copy, remap FKs.
- **Active session bookmark.** A pin or star at the top of the
  sidebar for sessions a user wants to keep handy. New column
  `pinned_at` would handle the sort.
- **Per-session debug toggle persistence on the server.** Currently
  the debug toggle lives in localStorage; if you have it on for one
  card you have it on for all. Per-session would be a nice creator
  affordance.

## Future-facing

Once SMTP + real auth lands, the user_id on sessions becomes a real
identity. The cascade rules already work correctly — they just need
to be re-verified once multiple real users coexist. The session ACL
("only your user_id can read this session") is correct today, just
trivially true because there's only one user.
