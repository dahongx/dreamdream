# Opening Components — Insights

> Companion: [handover/opening-components.md](../handover/opening-components.md)

## The problem

Every "互动件" in a beautification pack was a *dialogue component*: a regex rule
whose tag the model is taught to re-emit every turn, re-rendered each turn from
that turn's capture groups. Great for live state panels (env, mood, a phone
that reacts to the conversation). Wrong for the thing a creator actually asked
for next: a beautifully designed widget that *plays the character's opening*
and then stays put — an entrance, not a live readout.

Forcing that into a regex rule is the wrong abstraction. There's nothing to
match (the model isn't emitting anything), so pattern / capture groups /
output-guidance are all dead weight, and feeding its tag into the system prompt
would actively make the model re-emit it mid-conversation — the opposite of
"static."

## The decision: split the concept, don't overload regex

Two explicit kinds:

- **对话组件 (dialogue component)** — regex rule, per-turn, follows model output.
- **开场组件 (opening component)** — first-class static entity, no regex, no
  system prompt, rendered once. Authored with its **own** generator prompt.

"Static across turns" then falls out of the architecture for free: the opening
component renders from its *own* content in a standalone slot, never from the
message pipeline, so there's no turn loop to track.

## Where it lives, and the owner-private twist

We deliberated three homes: a per-character private pack, a direct
character→component binding, or "just put it in a pack." We landed on packs —
for authoring convenience (creators already think in packs, the studio is
pack-scoped) — but added the rule that actually resolves the original tension:

**An opening component is owner-private.** It rides in a shareable pack but
never propagates to other creators who subscribe that pack — it only renders on
the *owner's own* characters. So packs stay genuinely reusable for dialogue
components, while a creator's bespoke opening (the "精美的沈志恒开场") is a moat
that can't be lifted by subscribing. This is the same instinct as the prompt-
asset protection stance ([[feedback_prompt_assets_stay_private]]): the creator's
craft doesn't leak.

Worth being precise about *who* "can't see it": **other creators**, not players.
A player chatting with the owner's character is exactly who the opening was
built for — they see it. Only a different creator who subscribes the pack to
*their* character is denied it.

## Why a separate generator prompt

The replacement-html generator is built around capture-group mapping ($1/$2)
and the sanitize HTML contract. An opening component has no capture groups and
wants to be interactive (iframe artifact, may read `host.getCharacter()`), seeded
from character context (name / opening text / persona) rather than a regex
sample. Different inputs, different constraints, different output shape — so it
gets its own sealed backend template, not a flag on an existing one.

## Why the studio session flow (not a standalone form)

An earlier cut shipped opening-component authoring as a standalone form with a
one-shot "AI generate" box. That was a shortcut, and it read as inconsistent:
dialogue components are authored in the studio's **session model** (multi-turn
chat → proposal → live preview → commit), so opening components popping a
separate modal felt like a different product. They're the same authoring loop,
so they now share it — `opening` is a third session type beside `component` and
`css`, mirroring the `component` pathway end to end (proposal kind `add-opening`,
draft payload, preview focus, commit into `opening_components`). The standalone
form, its routes, and the one-shot `opening-component` generator were deleted.

## Future directions

- Export/import must keep opening components owner-only when that module lands.
- A richer "session splash" placement (full-screen tap-to-start / CG entrance)
  was considered; v1 ships the inline-above-stream slot, which is enough to
  "play the opening" without a new render surface.
