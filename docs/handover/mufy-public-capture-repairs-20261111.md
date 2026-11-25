# Public-capture preparation repairs (2026-11-11)

This is preparation and repair guidance, not a record that the batch passed. Read the [product notes](../insights/mufy-public-capture-repairs-20261111.md) and each worker's current checkpoint before editing a card. Never repeat an import to repair an existing card.

## Current source of truth

- Authorized archive metadata and original hashes: `outputs/mufy-local-archives-rank52-100-20261109/manifest.json`.
- Independent checkpoints: `outputs/mufy-rank71-80-20261111`, `outputs/mufy-rank81-90-20261111`, `outputs/mufy-rank91-100-20261111`.
- Read-only aggregate: `outputs/mufy-rank71-100-coordination-20261111/current-static-audit.json`. Run `bun scripts/audit-mufy-rank71-100-live.ts` to refresh it. It never promotes a card to accepted.
- Browser acceptance remains opening, two complete distinct real replies, desktop/mobile, and every actual source-specific component/state. Source inventories and successful XML roundtrips do not replace those checks.

## 1. Capture serialization must be complete

The browser tool truncated individual strings at about 200,000 characters while preserving the rest of an object. This occurred in `componentMarkup` even when every separate `documents[]` entry was complete. The previous preparer counted iframe tags in that truncated string and silently omitted later components.

Measure lengths in the browser before serialization, read long strings in bounded chunks, concatenate them locally, and compare JavaScript UTF-16 `.length` to the original measurements. Do not fill a purported browser measurement from the length of an already truncated local file. Record real `observedAt` and step `elapsedMs`.

Call `assertMufyPublicCaptureIntegrity(capture)` from `src/lib/import/mufy-public-capture-integrity.ts` before preparing. It rejects terminal `[Truncated]`, malformed fields, inconsistent optional `capturedLengths`, and invalid supplied elapsed times. It accepts complete strings above 200k and empty frame documents because emptiness and runtime availability need a separate browser decision. This check establishes serialization integrity only.

## 2. Preserve ordinary HTML interleaved with frames

Do not implement the introduction as `documents.slice(0, iframeCount)`. The source can contain ordinary HTML between independent Preview frames. That lost, among other things, rank85's iMessage/PDF panels and rank99's four profile folds and introduction.

Use `deriveMufyPublicIntroductionSequence` from `src/lib/import/mufy-public-introduction-sequence.ts`. It parses inertly, uses DOM ranges to preserve ordinary fragments and their partial ancestors in original order, and keeps each attribute-decoded srcdoc independent. It neither executes source programs nor fetches remote resources.

Check `readyForPreparation`, `unresolved`, and the coverage ledger before use. A remote frame without readable srcdoc, an empty unresolved frame, or an ambiguous literal fence must remain an explicit repair task. Never silently approve a partial result.

If a source frame is inside an authored `details`, a split sequence alone cannot preserve that control's ownership. The gate `FRAME_INSIDE_DETAILS_REQUIRES_BOUND_CONTROL` intentionally returns an empty renderable result while retaining audit documents and the original frame markup. Rank78's “古风乐府” and rank83's “♫” are blocked examples. Do not apply their earlier mixed candidates.

Ordinary fragments may inherit an explicitly captured `parentTextStyle` (`fontSize`, `lineHeight`, optional `fontFamily` and `color`). These must come from the visible source parent's computed style. The tool does not guess a 14px default. It inserts a zero-specificity, non-important baseline before ordinary-fragment author styles; original frame-document branches do not receive it. The ledger records adopted values and affected fragment count. The canonical preparer passes the optional capture through, and absence remains absence.

Shared author CSS is projected onto each fragment's actual DOM and public script references. Copying every stylesheet to every fragment is incorrect: unrelated sidebar selectors can trigger legacy floating detection. The first rank85 experiment produced six false floating widgets and was rejected. The corrected candidate is `rank85-opening-component-candidate-v2.txt`; the original 199127-character candidate is invalid.

Also test the *actual renderer route*: visible ordinary panels must remain inline; real source fixed widgets must remain floating. Counting only iframe widgets is insufficient because rank99 also has a genuine sidebar in ordinary HTML.

The canonical preparation helper `scripts/prepare-mufy-rank52-70-captures.ts` now invokes both checks. Independent worker copies must be reviewed explicitly; changing the canonical helper does not retroactively repair already imported cards.

## 3. Owner repair preserves existing identity and history

1. Open the existing card's normal owner UI and confirm name, ID and pack.
2. Back up the current complete component or theme. Compare against the expected baseline after CRLF-to-LF normalization; retain the original backup bytes too.
3. If another worker changed it, inspect and merge that change. Do not overwrite it merely because the older prepared XML passed.
4. Save the bounded repair through the UI, then read back the saved value.
5. Hard reload the existing chat and verify the intended live DOM, state, image and geometry. Keep failure evidence when the attempt fails.

Updating the role's opening does not rewrite an existing conversation's saved initial message. Historical appearance may therefore require a narrowly scoped private theme correction as well as a corrected opening for new sessions. Do not erase history or create a replacement card to hide this distinction.

## 4. Literal source class versus host selector translation

`renameLegacySelectors` maps the literal `mufy_` prefix to `nj_` throughout CSS, including attribute values. Existing source opening HTML can still contain the original `mufy_ai_message_bubble` class. A theme saved successfully but renamed to `.nj_ai_message_bubble` did not match it, leaving a 179px square avatar.

For the reviewed private repair, the CSS token `[class~="mufy\5f ai_message_bubble"]` represents the exact original class using standard CSS escaping. It survives the business prefix translation while retaining normal CSS safety scoping. Static tests confirmed it matches the source token and excludes the outer `nj_ai_message_bubble`; the rank92 browser then confirmed a 36px round avatar in the existing chat. Do not replace this with a broad substring selector that also affects host messages.

Always use each card's measured speech geometry. Rank92 used absolute positioning; rank86's source was **relative**. Do not reuse one card's entire bubble dimensions, colors or font for another. Capture the public avatar/bubble computed styles during initial observation; never mistake a small avatar for the cover/background image.

## 5. Generic button paint and input-wrapper mapping

Rank81 used bare `button` paint. The safety allowlist rejected that selector; the toolbar adapter nevertheless reset controls to default glass and could not reuse the rejected donor. Header buttons also lacked a mapping. The reviewed private candidate copies only source paint to known public controls; it does not allow arbitrary buttons, change functions, or copy source labels/icons/dimensions. Actual browser checks restored the same pink-purple gradient and border across all nine controls.

The composer is a separate case. Its candidate maps source wrapper, input, placeholder and send-button paint to `nj_chat_input_container`, `nj_chat_input_box`, `nj_chat_input_textarea`, and `nj_chat_send_button`. A button-only success is not proof that the input area matches. Both candidates require normal UI save and real reload verification.

## 6. Floating geometry needs two coordinate systems

Do not use empty `innerText` or zero main-document buttons to conclude that an opaque iframe floating layer is absent. Inspect layer children, actual iframe bounds, and public element bounds inside the frame.

Rank85's floating frame existed at 72×72. Its source root retained `bottom:140px` inside that small viewport, putting the controls at negative coordinates. The measured source is 48×78 at viewport right16/bottom140. Repair must separately own viewport anchoring and local document origin, preserve authored appearance and sandboxing, and verify both desktop and mobile. Merely making a colored line visible is not acceptance.

## 7. Empty author bridge frames can own real interactions

Rank92's last empty visible document contains the public author's `censy-ph-bridge-7k-live` bridge. Its source listener targets later `.ph .ib` phone controls in the parent page. An empty visible body therefore does not prove an unused component. Source was reopened successfully and the public bridge was observed; target had no corresponding parent marker. Keep this interaction pending until a generated phone and its draft insertion are actually checked.

The existing source-frame draft relay and `window.parent.document` adaptation intentionally stay local to the sandbox. The native quick phone button only inserts the online-chat prefix. Neither is proof of support for a separate parent-page listener. A future bounded native adapter must preserve draft selection, append semantics and component ownership without adding send authority or weakening sandboxing. No such adapter was shipped in this batch.

## 8. Rank82 player: localized program is only a candidate

The public capture's document 2 contains three visible status folds and the `censy-ghost-music-v4` player template. Its controller reads `window.parent.document` before its try block and exports player functions and state into the parent. The source player actually progressed and paused; the target audit found no corresponding player. Keep routing/serialization and cross-parent execution as distinct possible failure stages until the live route is traced.

`mufy-public-ghost-music-localizer.ts` is a staging-only candidate. It requires the exact observed controller SHA, template and five inline controls before moving those known references into its own sandbox. Unknown programs remain unchanged. Tests and the rank82 ledger prove preserved three status blocks, template CSS, three original track URLs and idempotence. They do not prove viewport anchoring, player accessibility or target audio progress. The candidate was not integrated, owner-saved or deployed; do not use its test success to close the media defect.

## 9. Bind avatars to the current role, never the first recent-chat image

The original collector used `document.querySelector('img[alt="roleAvatar"]')`. That selects the first avatar in Mufy's recent-chat list, not the current role. Local metadata showed one URL across 22 different source role IDs. Repetition was a diagnostic signal; live same-name header checks on rank94 and rank86 established the actual defect. `userProfile` is a different logged-in user image and is also not a role image.

Read the actual current-role header/profile container, verify its exact title, URL role ID and follow-button context, and require one visible loaded image inside that container. Record its natural dimensions: not every original is 430×430. Rank77 retains its separately verified source-name alias; do not rename the role just to match a photo. Export only that observed asset with the browser pageAssets capability. Update the existing owner's avatar through the normal upload/crop/save UI; verify the chat header name, loaded image and actual face. Never derive character IDs from storage directory names.

`mufy-public-role-avatar-binding.ts` validates the recorded role ID/name/source URL, unique container/title/image, load state and actual timestamp/elapsed values. It does not prove a browser observation by itself. Save `public-media-binding.json` as a new observation; preserve raw captures before updating only annotated media fields. Keep the original body observation time. Known raw captures must not be overwritten to look as though they originally contained the correction.

The rank91–100 preparer now requires this guard and the mixed-introduction ledger. Rank96's 110379-character XML was generated with its own bound avatar, two original frames and three ordinary fragments, then roundtrip checked. A transparent schema normalization preserved its raw observation, renamed `name` to `roleName`, extracted the already visible follow label, and represented a missing alt attribute as the standard empty DOM alt property. No new browser facts were invented. Other entry points and the frozen sharing package require a separately reviewed update; this is not a claim that the old distributed package is now certified.

## 10. Declared fonts and saved screenshots can be stale evidence

Rank52 had the same computed `Source Han Serif CN, serif` declaration on both sites, yet Chrome actually drew source text with SimSun and target text with Microsoft JhengHei. A successful `document.fonts.check()` or equal `font-family` strings did not prove visual equivalence. Read the actual rendered fonts for a public narrative/bubble node with the supported browser CDP `CSS.getPlatformFontsForNode` when a visible discrepancy remains. The private repair kept the author's preferred family and added the actually observed SimSun fallback; it did not substitute an unrelated font or change mono author-note text.

The first final screenshot also predated the all-width bubble-margin repair. Its filename did not make it current. Preserve that image, capture a new version, and compare visible column positions and glyphs against current DOM measurements. Rank52 v3 images, the rendered-font evidence, and six actual avatar-width checks support its later closure; v1 images do not.

Use per-tab viewport overrides during parallel QA and clear them afterwards. Browser-wide resizing can invalidate another worker's screenshot dimensions. A viewport or screenshot change is not permission to redo successful interactions or resend paid generation requests.

## 11. CSS-as-text requires a render-path repair

Rank96 retained its complete public opening and style through preparation and sanitization. Markdown HTML-block boundaries then split the style at an empty line, exposing later rules as paragraphs. A narrowly bound opening rule routes the matched original HTML into the existing iframe segment without deleting CSS, changing subsequent messages, or expanding sandbox permissions. The live owner UI import appended one rule while retaining the original opening component; actual chat recheck confirmed the visible CSS leak disappeared. Fold, media, generated-reply and responsive checks remain separate acceptance requirements.

Rank93 is a distinct branch: its locally applied compatibility rule prevents the leak, so current target leakage requires checking the actual enabled rule, binding and opening match through normal owner UI. Do not infer live execution from a prepared XML rule. Raw artifact children also lose HTML tags through text extraction; they are not interchangeable with an explicit source document. See the bounded reproduction and candidate notes under `outputs/mufy-rank71-80-20261111/`.

## 12. Keep the normal owner rule editor reachable

Rank93's saved rule cannot be diagnosed from an AI studio draft: the draft is a different object, and enabled subscription controls do not prove the saved rule's pattern, replacement or global enabled flag. The pack detail page already loads the saved rules, but previously rendered only the opening-component management list.

The local candidate adds the existing `RegexRuleList` in compact mode inside the existing `isOwner` branch on `/packs/[id]`. Its existing links lead to `/packs/[id]/rules/[ruleId]/edit`; that route independently checks `getOwnedRule` and pack identity. Visitors receive no new rule-management list or raw-editor links. Existing studio AI editing, ordering, permissions and action handlers are reused, not bypassed. No guessed rule UUID, new endpoint, database execution, or auth change is involved.

This candidate is not deployed. At the consolidated build boundary, verify owner links and saved-rule fields through normal UI, then diagnose rank93 against the exact current opening. Also verify a non-owner view has no management section. Do not infer that restoring the editor fixes rank93's rendering defect by itself.

See the matching product note in `docs/insights/mufy-public-capture-repairs-20261111.md`.

## 13. Preserve source paragraph text without restoring HTML code leaks

Rank100's public opening, prepared XML and normal owner editor all retained the exact same 2941 characters, including a double LF inside `p.leading-5.text-white`. The rendered text lost one LF. `normalizeHtmlBlocks` deliberately collapses HTML-internal blank lines to prevent CommonMark from printing indented creator markup as code; removing that protection globally would reintroduce the earlier 贺韫/程彧 defect.

The local `mufy-public-paragraph-lf.ts` integration protects text LFs only in those explicit public paragraphs when `mufySourceDefaults` is enabled. It does not touch native Dearm output, attribute newlines, comments or raw code/style/script content. It restores ordinary text nodes after `rehypeRaw`, so copy and final DOM contain the original LF with no added markers. A no-op lexical pass avoids an extra collision sanitizer call for ordinary streamed segments. Existing sanitization and sandbox permissions are unchanged.

The actual production `MessageRenderer` and the existing markdown protections passed the focused 21-test, 150-assertion suite. This is a local integration, not a deployed visual pass. After the agreed consolidated build, recheck rank100's actual paragraph text and geometry. Browser screenshots taken during a side-panel transition or returned from a stale tab capture must not be relabeled as final proof.

See the matching discussion in `docs/insights/mufy-public-capture-repairs-20261111.md`.

## 14. Public loading placeholders and isolated-document box sizing

Rank68's mobile author note initially showed `CN`, while the normally opened public role profile later loaded the actual author image. Do not permanently copy that placeholder. Wait for the public profile through normal UI, verify the loaded image/natural dimensions, then close the profile panel and let its closing transition finish before capturing comparison evidence.

Its source `summary` used `width:100%` with padding and borders under the source's border-box preflight. The target isolated document lacked that descendant preflight, so the same inline style became content-box: a 341px viewport acquired a 372px scroll width and unwanted nested scrollbars. The owner-UI repair added only observed `summary{box-sizing:border-box}` and the original first-paragraph top margin to the existing introduction's head. Saved readback proved removing that insertion restores the original component byte-for-byte. It does not justify a universal box-sizing override for every unrelated media program.

The card's ordinary replies and folds remain distinct from manual command generation. One real `$八卦` request produced a forum but ended in a half comment plus a visible conversation error. Keep that failure and the card's unaccepted state; automatic end decoration and two earlier complete replies do not prove this new command succeeded.

## Time and operational boundaries

Keep calculation/process wall time and individual browser observations separate. Do not sum overlapping workers, generation waits, scheduler delays or user login time as Agent net work. No invented token totals. A browser-tool timeout is not evidence that a card failed or a site banned the account.

The aggregate requires both the worker checkpoint and the per-card QA state to explicitly agree on acceptance, with an observed timestamp and no remaining items. It reports a disagreement rather than promoting an import. Pending timeline review is counted separately from held and source-unavailable rows so the 30-row total reconciles.

Use normal authenticated browser UI and read-only public source DOM. Do not read credentials, hidden source state or private source prompts, and do not access either database. Keep cards private until the agreed acceptance/publication gate. Any runtime candidate is reviewed separately and built only at the authorized batch boundary; a local module or owner-UI repair is not a deployment.

## 15. Compact public warning and native markup baselines

The rank69 warning is now physically integrated locally in the converter and FloatingSlot, using the finite observed contract and the existing dismissal state. The actual physical files passed 6 tests / 44 assertions. Unknown styles and missing public observations keep the legacy branch. No consolidated runtime build or owner warning replacement has occurred; actual glyphs, 28px placement and dismissal remain deployment gates.

Rank79 exposed a different contract loss: a source gradient with transparent text fill was painted across a block Narration wrapper because the target lacked text clipping. A private owner-theme append restores background-clip:text without changing the original cream gradient. Imported literal opening bubbles also retain source utility classes that are not necessarily compiled by Tailwind; measure actual avatar dimensions and responsive visibility before adding a scoped baseline. For79, source desktop avatar36px and visibility at640/768 versus absence at639/390 were observed, not borrowed from another card. Keep original theme prefixes and verify saved reload bytes.

## 16. Distinguish stream observation failure from persisted reply completeness

Rank79 had two normal live requests that displayed an error and a partial sentence. A later normal fresh chat navigation revealed both complete saved replies, without reissuing either request. The older rank68 manual command similarly had a full saved forum after refresh. Preserve the original failure evidence and the fresh observation separately. A client error does not by itself prove that the server saved only a partial message; conversely, a complete persisted reply does not make the live-stream error pass. Live delivery remains an independent open finding. Do not repeat paid requests merely to replace a lost client stream.

See the paired discussion in ../insights/mufy-public-capture-repairs-20261111.md.

## 17. Rank79: language, actual fallback fonts and tracking are separate source contracts

In the observed Windows Chrome source/target pair, the rank79 author note initially had the same declared mono stack on both sites, yet its actual Chinese glyphs differed. Source rendered Latin with Consolas (122 glyphs), Chinese with NSimSun (130) and emoji with Segoe UI Emoji (3). Target retained Consolas/emoji but used MicrosoftJhengHeiRegular for the 130 Chinese glyphs. Target tracking was also 0.32px rather than source `normal`, and wrapping differed. With the same approximately 346.667px text width, the target note was 369.333px high versus source 349.333px. Equal computed `font-family`, width or line-height was therefore insufficient.

The original native opening paragraph had a second mismatch: source actual MicrosoftYaHeiUI129 glyphs versus target MicrosoftJhengHeiRegular129. Source's declared UI sans/system stack, 14px/20px,400 weight and normal tracking did not survive the platform's explicit TC stack,450 weight and inherited tracking. Its source paragraph also had white text, `margin:0 0 10px`, `white-space:pre-wrap`, `word-break:break-word` and `overflow-wrap:anywhere`; these are distinct from the author's generated semantic narration skin.

The bounded repair was appended through the **existing private owner's theme**, preserving its original prefix and existing avatar, responsive gutter, purple bubble/decorations and narration-gradient repairs:

- Author-note body only: keep Latin Consolas first, then explicitly select the observed NSimSun Chinese fallback before generic mono families; restore normal tracking and `overflow-wrap:break-word`. Preserve the full note body, colors and14px/20px styling.
- Original opening paragraph only: select direct `p.leading-5.text-white` children of the native source document containing the verified literal speech/avatar markup; restore the observed Microsoft YaHei UI family (CSS family name; `MicrosoftYaHeiUI` is its PostScript name), UI sans/system fallback,400 weight, normal tracking and measured spacing/wrapping. Do not target the generated `.nj_message_narration`, whose authored600 weight and gradient remain intact.
- Native literal quote and note heading only: restore source Segoe UI/Microsoft YaHei UI,400 weight and normal tracking. No platform-wide font change or new shared runtime was needed for this private correction.

Normal owner reload/readback retained the entire original theme prefix. The21-character raw length difference was exactly21 CRLF pairs normalized to LF in the appended CSS, not a lost style or a reason to overwrite/reimport. The later **actual platform-font recheck** confirmed the note's Consolas122 + NSimSun130 + Emoji3 and opening paragraph's MicrosoftYaHeiUI129. The note returned to380px width and349.333px height with normal tracking. These are observed corrections, not conclusions inferred from the candidate's CSS declarations or local tests.

Evidence under `outputs/mufy-rank71-80-20261111/rank79/`:

- [Original author-note actual-font mismatch](../../outputs/mufy-rank71-80-20261111/rank79/author-note-actual-platform-fonts-root.json), [source note geometry/style](../../outputs/mufy-rank71-80-20261111/rank79/source-author-note-observation-root.json) and [mobile380px observation](../../outputs/mufy-rank71-80-20261111/rank79/source-author-note-mobile-root.json).
- [Opening actual-font/language mismatch](../../outputs/mufy-rank71-80-20261111/rank79/native-paragraph-actual-font-mismatch-root.json) and [measured paragraph spacing/wrapping](../../outputs/mufy-rank71-80-20261111/rank79/native-paragraph-computed-defaults-root.json).
- [Applied finite addition](../../outputs/mufy-rank71-80-20261111/rank79/actual-typography-final-addition-root.css), [owner reload/readback](../../outputs/mufy-rank71-80-20261111/rank79/actual-typography-save-readback-root.json) and [actual final fonts/geometry](../../outputs/mufy-rank71-80-20261111/rank79/actual-typography-final-platform-fonts-root.json).

### Language proposal remains unimplemented

The observed source language was `zh-cmn-Hans`; the target inherited `zh-TW`. Current native MessageRenderer wrappers have no explicit source-language attribute. However, the author-note aside is outside that wrapper, and `html[lang="zh-TW"]` explicitly chooses the TC `--font-body-zh` stack. Adding a descendant `lang` alone would neither rewrite that ancestor-selected CSS variable nor repair missing font resources. Language is a plausible contributor to generic CJK fallback, not a proven universal root cause or universal fix.

The [local language-scope proposal](../../outputs/mufy-rank71-80-20261111/rank79/actual-fonts-language-scope-proposal.json) recommends recording the actual public content language, then considering an optional, verified per-card language boundary on both native content and author note while retaining the user's app UI locale. It was **not implemented or deployed**. Preserve independently authored iframe language and verify it separately; do not assume host language reaches opaque documents. Do not set NSimSun, Microsoft YaHei UI or `zh-CN` globally for all migrated cards.

This closes the documented rank79 typography findings only. It does not promote the whole card or batch to accepted, and does not close the independent live-stream delivery finding in section16. Actual glyph/geometry checks remain necessary on affected source/target views after future relevant changes. See the paired [product notes](../insights/mufy-public-capture-repairs-20261111.md).
 

## 18. Rank97: imported global CSS can be present while bare control selectors are absent

On 2026-11-12 the actual target had six loaded source documents and a 12,861-character scoped style. The role binding and enabled theme were correct. Static comparison then proved that 25 selector occurrences had been discarded, including 18 distinct bare control selectors such as button/input/textarea by the existing selector whitelist. The platform's ten-ID glass fallback consequently painted the header and four composer controls. This is a missing finite selector mapping, not an absent import, a missing subscription or proof that every card needs a global palette replacement.

The normal owner theme editor supplied the exact 4,732-character baseline. The repair appended only the source green gradient, green 2px border, white ink, square corners and observed shadow/hover family to nine named platform controls. It retained actual native labels, geometry, disabled behavior and the active-mask glow. Eleven-ID specificity exceeds the already installed ten-ID fallback. The sanitizer currently splits selector lists on commas, so a compressed :is(list-with-commas) proposal was rejected before use. The final finite candidate uses validated individual selectors and private paint variables instead.

Source runtime inspection was necessary for the input: static authored CSS mentioned pale green, but the real textarea was transparent with white text, 25%-white placeholder and a green double border; its outer wrapper remained dark and rounded. The repair paints only the textarea and preserves outer layout, input sizing and scrolling. Never copy a static pale background without inspecting final source text color.

The saved theme was read again after a normal reload: 8,363 characters, exact original prefix and exact appended candidate. Actual desktop and 390px controls showed the expected green gradient, 2px border, white ink and zero-radius corners, with the model selector in the same family. Evidence is in outputs/mufy-rank91-100-20261111/rank97/theme-finite-host-paint-save-root.json, finite-host-paint-actual-desktop-root.json and the paired current screenshots. No reimport or shared deployment was performed.

This does not close the card. Two distinct ordinary live replies both showed generic errors while a normal refresh recovered their full saved bodies. Their live failures and saved completeness are separately recorded, without paid resends. Empty-input scroll arrows also remain on the old runtime: a measured desktop37px to mobile40px metric transition exposed the autosize effect's missing viewport/font trigger and border accounting. The new shared autosize helper is locally integrated/tested, awaiting the agreed whole-batch build and actual deployed recheck. Source-original audio no-progress and its white/dark native control difference also remain qualified rather than replaced.

See the paired product discussion in ../insights/mufy-public-capture-repairs-20261111.md.

## 19. Rank73: loaded audio with inert controls needs controller-order inspection

The actual source player progressed and paused, while the original target audio was ready4 with the same URL but stayed paused/time0 after a visible title click. The unique public author controller first accessed parent.document.body, then registered local player events. A sandbox exception at that earlier statement can prevent the later handlers; downloading or replacing the audio would not repair this known ordering problem.

The finite repair binds the known controller SHA a0e75b2a955b273a43cdafb7822e2c49467b6a38dc0c5c7ed723f1cb8be1eee5 and a fresh normal owner frame SHA. It moves only the wake listener into its own document body. A naive substitution is insufficient: local player clicks now bubble to that body and could restart the first pause. The approved replacement excludes player descendants, keeps listening through those excluded clicks, removes the listener only on a genuine local outside click, and cleans up on pagehide. The source host-wide wake area is deliberately narrowed to the frame; no parent permission or RPC is added.

The owner UI source editor is reached through Studio → 開場元件 → the component row's 查看原始碼. The adjacent 編輯 entry opens the AI assistant, not the direct code editor. Back up the entire fresh value; change only the bound first frame; save; reload the normal UI and read it again. Rank73's current component changed79859→80259 characters by exactly the400-character wake replacement. Other fields/documents were not regenerated or imported.

Actual target verification after fresh reload: ready4, real time11.919; first pause28.358 stayed at28.358 on a later observation; resumed normally; visible progress-track click sought to180.537 of361.074 seconds; final pause181.482. This closes that media-control defect, not the whole card. Evidence is under outputs/mufy-rank71-80-20261111/rank73/controller-localizer/. A separate9-character markup-boundary proposal removes a bogus fence-only frame and redundant title opener; it preserves every script/style and the new audio frame but still awaits normal fresh-owner application. Never use a global replacement of triple backticks inside author programs.

See the paired discussion in ../insights/mufy-public-capture-repairs-20261111.md.

## 20. Rank62 fixed-only player canvas (2026-11-12)

Normal source UI showed a self-contained 100px Preview with an 80px fixed, centered record icon. The target retained the same public author controller/audio URLs but its flow body measured zero, so the iframe collapsed to 1px and cut the icon at y=-39px. This is not a missing parent floating sidebar: no new native variant or parent access is needed.

The repair binds fresh owner component SHA `86b789c039e120bf71fb0626b107a1be1c26958807e97851bd39492e252dc0c9`, changes only document2 of5, and adds one hidden, noninteractive 100px flow spacer. All original author scripts/styles and the other four documents are byte-preserved. Normal owner UI saved34507 characters with fresh exact SHA `e4ca9275e135962b7a5c17c22faa1370dc7c4b3a62ca7f70f03bf07ed756ec9d`.

Actual target recheck found body/frame100px on desktop and mobile, the loaded original image, original audio advancing7.937→20.699 seconds and a real image click pausing at20.699325. Hover transforms intentionally change the painted image bounds; do not mistake the hover92px for an authored base-size change. Source click ready4/time0 remains a recorded limited observation, not proof of universal source playback failure. Evidence: `outputs/mufy-rank53-70-20261111/rank62/cat-flow-actual-recheck-root.json` and paired target PNGs. Whole-card acceptance remains false.

A separate ordinary reply iframe was33707px while actual body content was1906.667px and html rect1922.667px; html client/scroll height retained the old iframe viewport. Its resize floor needs an independent guarded runtime correction. The player canvas repair does not fix or certify that reply-height issue.
