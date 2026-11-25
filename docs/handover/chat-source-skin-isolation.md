# Chat source skin isolation — TEST released, acceptance incomplete

Related product rationale: [insights](../insights/chat-source-skin-isolation.md).

## Latest continuation — 2026-10-27 15:08 UTC

Final update 15:21 UTC: candidate 66ebb684 deployed at 15:18:24 UTC as TEST
image c371a6a19246. Project/runtime hashes and Tips guards verify. Fu Chiling,
Chengfeng and the four legacy focus cards pass toolbar background/image/border/
shadow equality and no root overflow at 390 and 1280 (12 unique combinations,
13 observations). This closes the toolbar-family gate, not full visual acceptance.
Deployment wall 746905 ms is explicitly not Agent net time.

Allowed-donor c2a7d220 is deployed as TEST image 478e86399ec0; the four
legacy focus cards pass background/border/shadow checks at 390 and 1280.
The subsequent 113-card mobile pass found one remaining default-family mismatch
on Fu Chiling. The no-replay-donor branch now resets all four defaults together,
instead of preserving replay's unrelated native gradient/currentColor defaults.
97 scoped tests and scoped typecheck pass. One-file candidate 66ebb684 is
building under the shared TEST release lock; it is not yet visually accepted.
Evidence and actual-version verification live in outputs/chat-skin-upgrade.
Legacy scene provenance and out-of-scope Portal theme coverage remain open.

## Verified defects

2026-10-27 public DOM comparison: Chengfeng source and target header/composer
RGBA match, but source stage base is #494c54 with a black 60% overlay;
target reveals the global #0b1220 base with a blue 60% overlay. Fuchiling
additionally loses root variables and composer transparency. Its multiple source
style elements were concatenated across an unfinished comment/block, swallowing
the next stylesheet. See the research JSON for measurements.

## Local changes

- ChatStage opts verified Mufy component/rendered-opening provenance into a
  source-colored backdrop. No global token replacement, brightness adjustment,
  database migration, or name-based detection. Source colors are compatibility
  data, not a new platform palette. Author-scoped styles can override defaults.
- Each imported explicit stylesheet ends at its own EOF before concatenation.
  The runtime also preserves boundaries when provided separate style tags.
  Safety filtering still runs afterward.
- User clarification supersedes the earlier independent-model policy: all four
  toolbar controls use the replay visual family, including legacy cards without
  a Mufy provenance marker. A model-only skin falls back to the group's defaults.
  No fixed icon width,
  transform, pseudo-label or behavior is copied. Source input-box descendant
  selectors for the model trigger map to the toolbar container.

## Release gates still pending

2026-10-27: eight-file scoped candidate deployed to 8091 only. Manifest and
deployment timing are in outputs/chat-skin-upgrade/release-candidate. Real
Chengfeng page confirms source stage rgb(73,76,84), unchanged authored header
and composer RGBA, and preserved explicitly styled model control. 390x844
CDP viewport confirmed; model menu opens. Device override was cleared.
This does not establish full-card or streaming acceptance. Fuchiling's 18
public stylesheet blocks are saved for historical skin recovery, not yet applied.

User clarification: scope includes semantic component mapping, not only matching
source selector names. Audit header actions, all four composer actions, their
hover/focus/selected/disabled states, menus, and creator-note surface. Reuse an
equivalent source control's visual declarations for platform-only equivalents
without copying labels, icon dimensions, positioning, or behavior. Preserve
author theme colors and visible focus/state feedback. Independent model-only
paint is not an exception to the requested toolbar family. The Sitthikorn user
screenshot demonstrates mixed host/source styling and is an additional fixture;
do not assume its bright mask outline is a defect before inspecting state.

Do not mark real cards accepted based on unit tests. Existing flattened corrupt
CSS has already lost stylesheet boundaries: recover public source style blocks
and update through the normal authorized editor/import UI, never guess missing
braces in historical flattened text or access the database. Validate desktop and
mobile header, composer, all four control states, opening/replies/status panels,
scroll and streaming stability. Check independently styled model controls,
no-style cards, ordinary native cards and old imported cards.

Do not deploy the whole dirty worktree. A TEST-only release must compare remote
baseline, stage only reviewed changes, pass disk preflight, retain rollback and
verify 8091 after release. Production and database remain out of scope.

## 2026-10-27 full accessible TEST inventory audit

- Normal website inventory exposed 105 public cards and 30 own cards; 8 own
  cards were additional, giving **113 unique accessible cards**. Other accounts'
  private cards were not queried or inferred. No database/API inventory access.
- All 113 were opened through normal UI and measured at 1280×900 and 390×844.
  Jianghuai's first navigation timeout was rechecked successfully; deduplicate
  evidence by index (114 attempts, 113 final records).
- 28 model backgrounds differ from replay; 3 additional cards differ only in
  border color. These are unresolved on the currently deployed version. No root
  horizontal overflow or header/composer control outside the mobile viewport
  was measured. This is not full visual, iframe, streaming or WCAG acceptance.
- 16 cards have verified source provenance. Legacy cards without it still need
  toolbar paint and functional-label compatibility, but must not automatically
  receive imported-scene backdrop defaults.
- Junlishang's public stylesheet contains a truncated `linear-gradient(...rgba(1`
  declaration. The browser parses only 138 rules and ignores the compatibility
  tail. The candidate drops malformed declarations instead of guessing values;
  valid preceding declarations and subsequent host safeguards remain scoped.
- Screenshot capture sometimes returned a prior desktop composition resized to
  mobile width. Those frames are not accepted mobile visual evidence. A fixed
  mobile-viewport recapture completed 14 cards before Chrome displayed
  `ERR_BLOCKED_BY_CLIENT`; full visual acceptance remains false.
- Latest one-file candidate is `outputs/chat-skin-upgrade/platform-family`.
  86 scoped tests / 212 assertions pass; the design detector reports no findings.
  TEST publication has **not succeeded**: SSH TCP connects but closes before the
  remote protocol banner/key exchange. No authentication or site outage cause
  has been established. Do not bypass Chrome restrictions or weaken SSH guards.
- Cleanup removed unused intermediate build layers and the older layout rollback
  image; the current running image and immediate prior rollback are retained.
  Build cache can be regenerated. No volumes, user data or database were touched.
- Evidence and exact mismatch list:
  `outputs/chat-skin-upgrade/full-audit-20261027/REPORT.md`.

### Coordinated release follow-up (13:35 UTC)

The preceding publication/blocking statements are historical. The platform-family
patch and exact missing avatar resource subsequently deployed. Mobile DOM checks
cover 113 cards; 107 initially matched model/replay paint, with four generic
button donors and two currentColor border cases left. The border cases now match
on the running contrast version; the generic donor candidate has 89 passing
tests / 216 assertions and a clean scoped typecheck/design scan.

Two TEST releases overlapped. SSH disconnection did not stop the remote builds,
and one source rollback left project source older than running image code. User
authorized cross-thread coordination; Tips publication is paused. Its verified
running image d317133ac51a and ten-file manifest must be preserved.

The skin release helper now holds `.test-release.lock` with `flock` across source
copy/build/switch/rollback, backs up the actual container image (not `latest`),
checks the running version before switching, and can guard all Tips file hashes
with `--preserve-tips`. `--durable` leaves the build running with controlled logs
after SSH returns. Submission is not success: inspect release markers and verify
the actual container image and file hash before writing deployment success.
Never start an automatic second release or rollback after a disconnected session.

The legacy-family build `chat-skin-20261027133443728` was cancelled before switch
after actual public CSS revealed replay exclusions through attribute selectors.
The corrected candidate is `outputs/chat-skin-upgrade/generic-replay-exclusions`;
its completed build backup is `chat-skin-20261027134855473`. Deployment was verified
at image 4bac71d19dd7 with project/runtime hash fb59f4cf...263e3d8 and Tips guards.
Four-card mobile/desktop checks pass backgrounds; Gongjiangye still fails border
and inset shadow. An additional LOCAL-only donor filter now requires
`isSelectorAllowed` before mirroring; 96 tests / 262 assertions pass. That last
fix is not in the published manifest and needs a new exact-baseline candidate.
Desktop recheck now covers all 113 cards: 109 paint matches, four legacy cases
await the new candidate. Model/replay paint equality is only one acceptance gate.
Legacy backdrop defaults and model-menu Portal theming remain separate follow-up
risks, not covered by model/replay color equality alone.
