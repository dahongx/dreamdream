# Chat Generation Controls — Handover

> Companion: [insights/chat-generation-controls.md](../insights/chat-generation-controls.md)
>
> Rewind persistence details remain in [conversation-fork.md](./conversation-fork.md).

This change closes three related chat UX gaps: blank space after history is
trimmed, drafting while the model is streaming, and genuinely stopping an
in-flight model response. It also adds per-request response variation so a
regenerate or identical first turn does not keep producing the same candidate.

## Client behavior

`src/components/chat/ChatRoom.tsx` owns all controls:

- The textarea is never disabled by generation. The user can prepare the next
  message while the current response streams; sending remains locked until the
  active request settles.
- Once `useChat` reaches `streaming`, `#nj_chat_send_button` changes from the
  send icon to a square stop icon. The selector is unchanged, so published
  creator CSS remains compatible.
- `useChat.stop()` keeps the received tokens. The client marks the last
  assistant message with public `metadata.stoppedByUser` so the UI shows the
  localized stopped notice and the next request can shape history correctly.
- Manual `/api/chat/continue` streaming has its own `AbortController` and uses
  the same stop button. Its message id is passed to `ChatMessagesList` so the
  continued suffix stays on the streaming render path.
- A short post-abort send lock gives the server time to persist the partial row;
  without it, a new turn can race the abort settlement and hit the session's
  in-flight-user guard.

## Server cancellation and persistence

Both generation routes forward `req.signal` to `streamText`.

### `/api/chat`

- The response uses `consumeSseStream: consumeStream`. This keeps the server
  branch consumed after the browser closes its branch, allowing abort cleanup
  and database settlement to finish.
- Text deltas are accumulated independently of the UI stream.
- `onFinish`, `onAbort`, and `onError` share a promise-based settle-once guard,
  preventing duplicate inserts, refunds, or transaction settlement.
- A stopped partial response is stored with `debug_info.stoppedByUser = true`.
- If the player stops before the first visible token, an empty assistant row is
  still stored to preserve user/assistant alternation, but the currency charge
  is refunded and the stored row has zero currency amount.

### `/api/chat/continue`

- The raw text response is teed. One branch goes to the browser and the other
  is consumed internally, so abort settlement is not abandoned with the client
  connection.
- A stopped continuation appends the received partial text to the existing
  assistant row. A stop before any new text refunds that continuation charge.
- `debug_info.lastContinuation.stoppedByUser` records the event without marking
  the entire original assistant message as a rejected draft.

## Stopped-message history shaping

`src/lib/chat/history-messages.ts` keeps a stopped assistant turn in the role
sequence but replaces its model-facing content with a neutral internal note.
The raw partial remains in storage and UI. This prevents adjacent user turns
while also ensuring the next generation does not imitate prose the player just
rejected.

`src/app/chat/[characterId]/page.tsx` reconstructs the public safety/stopped
metadata from `debug_info` on reload. No system prompt or developer-only debug
payload is exposed through this metadata.

## Response variation

`src/lib/ai/response-variation.ts` builds a model-only cue appended to the
latest wrapped player turn:

- Every request receives a fresh variation key. This gives identical first
  turns in separate sessions a different creative tie-breaker without changing
  stored user text.
- Regenerate sends the rejected assistant text in the request body. The helper
  bounds it to 6,000 characters, quotes it as reference data, and explicitly
  tells the model not to reproduce its wording or narrative beats.
- The cue is never written to `messages` or returned to the browser.

## Frozen-height cleanup

The stream-to-ready transition intentionally applies a temporary `min-height`
to prevent browser scroll clamping. Every destructive history operation now
calls `prepareForHistoryTrim()` before changing React messages. It synchronously
clears that height and resets captured stream metrics; a layout effect then
scrolls to the new natural bottom. This covers assistant-pair delete,
user-pair delete, and rewind/fork.

## Verification

- `bun run typecheck`
- `bun test src/lib/ai/__tests__/response-variation.test.ts src/lib/chat/__tests__/history-messages.test.ts`
- `bun test src` (the repository's pre-commit test scope)
- `bun run build`
