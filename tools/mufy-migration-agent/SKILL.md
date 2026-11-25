---
name: mufy-migration-agent
description: Migrate authorized local Mufy character archives to the Dearm test site through normal browser UI, compare public source appearance and interactions, repair differences, and verify assigned cards before human review. Use for Mufy migration batches and their acceptance, not ordinary chat or production deployment.
---

# Mufy migration and acceptance

Release gate: this is 1.0.1-rc.2, not certified for distributed batch execution. Until an actual single-card end-to-end trial is recorded, limit use to package validation and an explicitly scoped canary. The earlier 1.0.0 package omitted batch preparation compatibility steps and must not be used for bulk imports.

This package is a versioned Codex workflow plus deterministic tools. Codex performs public-browser observation, semantic comparison and code repair; the CLI performs preparation, ownership and evidence checks. A successful CLI check is never proof that an unobserved page matches.

## Start and ownership

Read the user's repository AGENTS.md/CLAUDE.md and applicable browser skill. Run `bun <this-package>/dist/agent.mjs doctor`; do not use a changed package. Ask the coordinator for the job folder and your assignment, then claim only assigned ranks. A job's `packageId`, frozen roster hash and target runtime fingerprint must match. Shared source roles stay with one worker, with one record per local archive. Do not touch another worker's card, shared renderer or release process while doing per-card work. For exact commands and file formats read [references/operator.md](references/operator.md).

This version allows the existing 8091 test origin and loopback development only. The tools do not log in, access databases, call models, publish cards or deploy. Browser UI authorization does not authorize direct database access. Never use old credential-reading collectors, fetch private prompts from Mufy, inspect cookies/storage/hidden state, bypass authentication or weaken an iframe sandbox. User-provided local originals stay local; do not put them into the shared code package. Use normal login in the browser; do not transfer credentials between workers.

## Capture, prepare and import

1. Confirm role name and source URL after real content has loaded. Capture only public DOM, authored styles, public settings/rules and public assets. Record observedAt, measured elapsedMs and original URLs. Read large public DOM in chunks and verify full lengths. Never substitute a placeholder or infer an absent public rule capture as an empty rule list.
2. Bind the explicitly supplied local archive by SHA256 and identity facts; age/punctuation alone does not decide a match. Preserve original source bytes. Create the public-detail, public-rule capture and loaded-complete source proof described in the operator reference, then run `prepare` for this card. The existing parser, CSS conversion, ordered-rule envelope and XML roundtrip are frozen into the package. Errors produce a repair task, never a partially approved import.
3. Import the generated XML once through the authorized test site's normal import UI. Record the resulting chat URL with `receipt`. Existing imports are repaired in normal owner beauty UI; never create a second card to fix appearance. Local output, imports and code proposals are private until the coordinator authorizes their publication.

## Self-check → self-repair → actual recheck

Build a complete source component inventory, then compare every component/state with the target, including source-specific controls and media. Follow [references/acceptance.md](references/acceptance.md); do not load unrelated historical documents as current truth.

When a difference appears, save failure evidence first, distinguish missing source capture from parser, renderer, model-output or external-resource failure, and choose the narrowest correction that restores the author's behavior. The CLI's `repair` supports the proven migration-owned player box-model recipe and produces a separate proposal, never overwriting the source. It does not invent a universal automatic fix. For other defects Codex edits the bounded conversion/compatibility code or authorized owner beauty UI, runs relevant regressions and rechecks the changed behavior through the actual browser. Read [references/repair.md](references/repair.md) when a failure needs correction.

Player-name substitution must use the actual player/mask context without replacing creator credits/code/attributes or remounting stateful documents. Preserve authored colors, avatar opt-ins, animations, fixed widgets, fold geometry and selection/caret behavior. Source buttons and additional equivalent platform buttons should share the observed style family; do not invent source labels for unrelated functions. A success message, enabled button or copied receipt does not prove the effect: verify actual draft, pasted text, scroll coordinates, visible animation, media progress or saved/reloaded content as applicable.

Do not repeat completed same-version checks without a relevant change. After a tool interruption, inspect actual page and saved evidence before retrying a mutation. AUTH_REQUIRED/429/global blocking: save the reason and continue independent local work; use normal authentication rather than blind retries. A tool timeout is not evidence that Mufy banned the account. Record unavailable original media honestly; never replace it with a different asset just to pass.

## Finish and coordination

Each card requires real opening and at least two distinct existing/authorized real replies, mobile and desktop, source-specific states and public evidence. `review` checks the evidence's integrity and completeness; it rejects missing checks, unloaded DOM, stale runtime, missing screenshots, incomplete replies and unresolved findings. It never creates a passing report for you. A failing report gives the repair queue; Codex fixes and rechecks before resubmitting.

Workers return their assignment, immutable evidence and card reports to the coordinator. Only the coordinator merges reports, fixes shared renderer code and coordinates one release after the agreed whole-batch prebuild review. Any release changes the runtime fingerprint and invalidates affected old checks; revalidate affected cards before declaring completion. Human review is the final audit, not a substitute for Agent acceptance. Keep held cards and reasons separate from passed cards; preserve the original roster and historical failures. See [references/multi-worker.md](references/multi-worker.md).

Record process wall time and per-browser-step elapsedMs separately. Do not count user/scheduler waits as Agent net work or invent token totals. Keep normal repeated runs quiet; notify for actionable blocking, important recovery and final delivery according to the user's preference. Respect paused/cancelled goals.
