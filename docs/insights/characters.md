# Characters Module — Insights

> Companion: [handover/characters.md](../handover/characters.md)

## Why 16 fields, grouped A/B/C

The full competitor form is ~50 fields. Picking the minimum to ship is a
philosophical question, not a technical one. Our cut:

- **A. Info** (10 fields) — everything that's metadata or appearance.
  Things creators want to surface to other users but that shouldn't
  leak into the model's context window.
- **B. Persona** (4 fields) — the core "who this character is" prompt.
  Most cards live or die by `persona` alone.
- **C. Advanced** (4 fields, collapsed by default) — power-creator
  fields. `plot_setting` / `output_setting` / `sample_dialogue` /
  `global_css`. Hidden by default so new creators
  don't bounce off a 16-field wall.

The grouping is also a design hint: if you can describe your character
in section A + persona, you have a shippable card. Section C is for
"this character is special enough to be worth the extra ceremony."

## Why visibility is enforced server-side, not via CSS

Initial sketch: render private cards but hide them with a CSS rule
visible to non-owners. Killed that immediately — the network response
still contains the data. The action surface needs to refuse to return
private cards to non-owners, full stop. UI hide-on-list is just an
ergonomic add-on after the data layer says no.

Same for the edit / regex / delete pages: server-side redirect for
non-owners (v1.13 added explicit redirect on edit). The form's
update action would refuse anyway, but bouncing earlier means
non-owners don't see the danger zone in a weird half-state.

## Why image uploads are server-mediated

The old "paste a URL" flow was friction masquerading as flexibility.
Creators should pick a file, see it previewed, and have the app own the
upload path. The server route keeps R2 config out of the browser,
enforces size/type limits, and still persists only the public URL in
the character table.

## Why clone forces `private`

Three reasons:

1. **Intent inference.** A clone is "I want to edit." If the result
   should also be public, the creator can flip the toggle. Defaulting
   to public would let a careless click double the listing.
2. **/explore noise floor.** Cloning trivially produces "X（副本）"
   entries; if those auto-list, the explore page gets a thousand
   near-duplicates the first time a popular card lands.
3. **Authorship.** A private fork is unambiguous: the cloner owns it,
   period. A public fork raises social questions about who "made"
   the character that we don't want to adjudicate.

## Why `owner_id` is rewritten on clone

Honoring the source's owner_id would let a bad actor screenshot a
clone URL and "claim" they got it from someone else. Treating clone
as "always create under me" closes the laundering loop. There's no
UI to gift a card to another user in v1; that whole problem space
stays out.

## Why opening lives in its own field (vs being a regex rule)

A regex rule could in principle replace `<message>...</message>` with
the right thing. But two qualities of `opening` make it special:

1. **It's parsed at session-creation time**, not at every message.
   Creating a session for a character with an opening seeds those
   `<message>` bodies as actual assistant rows in the messages table
   — so they show up in `getHistory()` for iframe-mode rules, count
   toward token budgets, and can be deleted with the session.
2. **`<scenario>` is silent-render.** It feeds the system prompt but
   doesn't show up as a bubble. The opening parser handles that
   asymmetry; a regex rule would have to fork into rendering vs
   prompt-only behavior, which is the whole "two kinds of thing in
   one schema" smell.

## What surprised me

- **`{{char}}` + `{{user}}` interpolation is brittle in `sample_dialogue`.**
  Creators write `## User: ...` blocks but sometimes also paste in
  raw `{{user}}` tokens expecting them to substitute. They do —
  we run `interpolate()` on every prompt-bound field. But the result
  in `sample_dialogue` reads like the model has actually said
  "Maat replies to..." instead of seeing it as a fill-in. The fix is
  in the prompt's own framing — we wrap that field as "仅作风格参考，
  非真实历史" — but it's a leaky abstraction worth knowing about.
- **`conversation_count` dead-code was a real bug** (v1.8 fix). Easy
  to miss because the field looked "obviously" computed somewhere.
  Lesson: any denormalized counter needs a test that proves something
  writes to it, not just reads.

## What I'd want next

- **Drafts.** Creating a character is a 16-field form; losing it to
  a accidental navigation is brutal. localStorage-backed draft would
  be cheap.
- **Per-card analytics.** `messages_count`, `unique_users`,
  `avg_session_length`. Useful for the creator to know which cards
  resonate.
- **"Test session" mode.** A scratchpad chat that doesn't increment
  `conversation_count` or pollute the user's session sidebar.
  Especially useful while iterating on regex rules.
- **Field-level help-on-hover.** The placeholder text covers basics
  but several fields (`adversity`, `default_cognition`) benefit
  from a longer "why this matters" tooltip that doesn't fit in the
  placeholder.

## Future-facing

When SMTP / real auth lands (v1.5+), the `owner_id` field's identity
gains weight — currently it's all the dev fallback user. The visibility
checks already work correctly; they just need to be re-verified once
multiple real users coexist on the same instance.
