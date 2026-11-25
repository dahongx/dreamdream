# Chat Generation Controls — Product Insights

> Companion: [handover/chat-generation-controls.md](../handover/chat-generation-controls.md)

## “Can type” and “can send” are different permissions

The old UI treated generation as a blanket disabled state. That prevents double
sends, but it also blocks harmless preparation: roleplay users often know their
next action while a long reply is still arriving. The right split is:

- drafting stays available;
- submitting, model selection, currency switching, and destructive message
  actions stay locked until the active generation settles.

This preserves the server's one-generation-per-session invariant without
making the user wait before they can think in writing.

## Stop must be an end-to-end contract

A stop icon that only disconnects the browser is misleading. The provider may
continue spending tokens, the partial reply may vanish on refresh, and the
database may remain with an unmatched user turn. “Stop” therefore means all of
the following together:

1. abort the provider request;
2. keep already visible text;
3. persist the partial assistant turn;
4. settle or refund currency exactly once;
5. leave the conversation structurally ready for the next user turn.

The zero-token case deserves explicit handling. Persisting an empty stopped
assistant row looks odd in raw data, but it is the smallest representation that
preserves role alternation and prevents the next send from being mistaken for a
concurrent request. The UI communicates it through a quiet status line rather
than inventing dialogue for the character.

## A stopped draft is visible history, not creative precedent

The user stopped because the direction was unwanted. Feeding that partial text
back into the next model call turns rejection into reinforcement and makes
repetition worse. The product needs two views of the same event:

- storage/UI: keep the exact partial text, because it is what the user saw;
- model history: keep the assistant role but replace the content with a neutral
  “rejected draft” marker.

This is the same broader principle used by state-history shaping: display
history and model context do not have to be byte-identical when a faithful UI
record would actively damage the next generation.

## Regenerate should explore, not replay

Sampling alone is not a strong product guarantee. A stable prompt, a relay, or
the model's highest-probability continuation can still yield the same response,
especially on the first turn. Two signals are stronger than blindly raising
temperature:

- a fresh, model-only variation key on every request;
- the rejected candidate on regenerate, explicitly marked “do not copy.”

Raising temperature globally would also make ordinary turns less coherent.
The chosen approach targets variation where it matters while preserving
character consistency and the existing provider defaults.

## Blank space was state, not spacing

The reported blank area looked visual, but changing CSS gaps would have hidden
the symptom only. The real source was imperative scroll-stability state: a
`min-height` frozen at the last streaming frame. Any operation that removes
messages must clear that state as part of the same transaction from the user's
perspective. Treating rewind and delete as one “history trim” concept removes
the class of bug instead of patching one button at a time.

