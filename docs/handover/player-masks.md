# Player Masks Handover

Product context: [player mask insights](../insights/player-masks.md).

## What Shipped

Player masks let a user define private self-persona fields and bind one mask to a single chat session. The selected mask is folded into the next `/api/chat` system prompt. If no mask is selected, existing `{{user}}` interpolation continues to use profile display name / username / fallback.

## Data Model

- `user_masks`: private masks owned by `users.id`.
- `chat_sessions.active_mask_id`: nullable session-level selection, `ON DELETE SET NULL`.
- Migration: `drizzle/0007_user_masks.sql`.

Field limits are enforced by `src/lib/masks/actions.ts`: note 2000, name 128, gender 10, description 2000, preference 200, instruction 4000.

## Runtime Flow

- Chat page loads masks with `getSessionMaskState(sessionId, userId)` and passes them into `ChatRoom`.
- `MaskDialog` creates/updates/deletes masks and sets the current session's active mask through server actions.
- `/api/chat` calls `getSessionActiveMask(session.id, userId)` immediately before `buildSystemPrompt`, so a saved selection applies to the next send/regenerate without a page reload.
- `buildSystemPrompt` uses `mask.name` for `{{user}}` and injects two sections before the character persona: `## 玩家人设` (name/gender/description/preference, via `buildPlayerPersonaSection`) and `## 玩家补充指令` (the `instruction` meta-directive, via `buildPlayerInstructionSection`). Empty optional fields are omitted, and the word "面具" never reaches the prompt — the model only sees "玩家人设". With no active mask both sections are absent and `{{user}}` falls back to the profile display name.

## UI Contract

Selectors added:

- `#nj_mask_btn`
- `#nj_mask_dialog`
- `.nj_mask_list_item`
- `.nj_mask_form_field`

The mask button lives in the floating input toolbar beside regenerate/model controls. Dialog styling follows Dearm dark tokens.

## Verification

- `bun run typecheck`
- `bun run lint`
- `bun test`

Prompt behavior is covered in `src/lib/__tests__/build-prompt.test.ts`.
