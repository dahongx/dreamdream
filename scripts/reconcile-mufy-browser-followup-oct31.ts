/** Merge measured public UI evidence only. Never builds, publishes or certifies a card. */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { publicComponentCoverage, type PublicComponentDisposition } from '../src/lib/import/mufy-public-component-coverage';

const root = 'logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const read = async (path: string) => JSON.parse(await readFile(`${root}/${path}`, 'utf8'));
const write = async (path: string, data: unknown) => writeFile(`${root}/${path}`, JSON.stringify(data, null, 2));
const started = performance.now();
const qa = await read('qa-progress.json');
const cursor = await read('continuation-next-20261031.json');
if (qa.rows.length !== 28 || new Set(qa.rows.map((r: {rank: number}) => r.rank)).size !== 28) throw Error('LOCAL_BASE_CHANGED');

const folds27 = await read('final-acceptance/27/profile-folds-source-target-20261031.json');
const chat28 = await read('final-acceptance/28/static-chat-collage-source-target-20261031.json');
const ribbon28 = await read('final-acceptance/28/gradient-ribbon-source-target-20261031.json');
const guide29 = await read('final-acceptance/29/guide-source-target-20261031.json');
const intro29 = await read('final-acceptance/29/static-intro-source-target-20261031.json');
const news44 = await read('final-acceptance/44/news-tabs-source-target-20261031.json');
const pages44 = await read('final-acceptance/44/profile-pages-visible-source-target-20261031.json');
const folds44 = await read('final-acceptance/44/instructions-folds-source-target-20261031.json');
const font44 = await read('final-acceptance/44/public-font-local-20261031.json');
const fontCandidate44 = await read('rule-repairs/44/public-plate-font/candidate-proof.json');
const font45 = await read('final-acceptance/45/public-font-runtime-local-20261031.json');
const motion45 = await read('final-acceptance/45/rain-motion-current-20261031.json');
const controls45 = await read('final-acceptance/45/profile-and-state-controls-check.json');
const qa48 = await read('final-acceptance/48/qa-cards-settled-source-target-20261031.json');
const social48 = await read('final-acceptance/48/social-cards-source-target-20261031.json');
const music48 = await read('final-acceptance/48/inline-audio-current-20261031.json');
const magazine48 = await read('final-acceptance/48/magazine-keyboard-source-target-20261031.json');
if (!folds27.complete || folds27.rows.length !== 4 || !folds27.rows.every((r: {textExact: boolean;source:{open:boolean};target:{open:boolean}}) => r.textExact && r.source.open && r.target.open)) throw Error('FOUR_ACTUAL_FOLDS_REQUIRED');
if (!chat28.textExact || !chat28.styleSampleExact || chat28.source.controls !== 0 || chat28.target.controls !== 0 || !ribbon28.paintExact) throw Error('STATIC_COMPONENT_EVIDENCE_REQUIRED');
if (!guide29.textExact || guide29.source.height <= 100 || guide29.target.height <= 100 || guide29.closed.source.maxHeight !== '' || guide29.closed.target.maxHeight !== '' || !intro29.textExact || !intro29.stylesExact) throw Error('RANK29_STABLE_PUBLIC_UI_REQUIRED');
if (!news44.complete || news44.rows.length!==3 || !news44.rows.every((r:{textExact:boolean})=>r.textExact) || !pages44.complete || pages44.rows.length!==4 || !pages44.rows.every((r:{textExact:boolean;source:{visibility:string;opacity:string};target:{visibility:string;opacity:string}})=>r.textExact&&r.source.visibility==='visible'&&r.target.visibility==='visible'&&r.source.opacity==='1'&&r.target.opacity==='1') || !folds44.complete || !folds44.rows.every((r:{textExact:boolean;textExactAfterRoleBinding?:boolean})=>r.textExact||r.textExactAfterRoleBinding===true) || !font44.textExact || !font44.fontDeclarationMatched || !font44.paintMatched || !fontCandidate44.exactReversePreservesAllOtherBytes) throw Error('RANK44_PUBLIC_UI_AND_LOCAL_REPAIR_REQUIRED');
if (!font45.textExact || !font45.fontMatched || !font45.paintMatched || !font45.animationConfigExact || font45.sendCount!=='0' || !motion45.sourceTransformAdvanced || !motion45.localTransformAdvanced || controls45.profile.length!==14 || !controls45.profile.every((r:{source:unknown;target:unknown})=>JSON.stringify(r.source)===JSON.stringify(r.target))) throw Error('RANK45_REAL_COMPONENT_EVIDENCE_REQUIRED');
if(!qa48.complete||!qa48.allVisible||!qa48.allTextExact||!social48.complete||!social48.allVisible||!social48.allTextExact||!music48.playbackAccepted||!music48.pausedAfterCheck.source.paused||!music48.pausedAfterCheck.target.paused||!magazine48.complete||!magazine48.allOpened||!magazine48.allTextExact||magazine48.restored.source.some((v:boolean)=>v)||magazine48.restored.target.some((v:boolean)=>v))throw Error('RANK48_ACTUAL_UI_AND_PLAYBACK_REQUIRED');
const focus34=await read('final-acceptance/34/relationships-stable-source-target-20261031.json');
const copy47=await read('final-acceptance/47/oc-form-copy-local-final-20261031.json');
const network47=await read('final-acceptance/47/network-folds-source-target-20261031.json');
const profile46=await read('rule-repairs/46/fullscreen-profile/candidate-proof.json');
const divider43=await read('final-acceptance/43/missing-divider-local-final-20261031.json');
const passive43=await read('final-acceptance/43/passive-ornament-local-fixed-20261031.json');
const island43=await read('final-acceptance/43/multimodule-island-local-final-20261031.json');
const island43Candidate=await read('rule-repairs/43/native-narrow-navigation/candidate-proof.json');
const timeline41=await read('final-acceptance/41/timeline-local-final-20261031.json');
const timeline41Candidate=await read('rule-repairs/41/public-timeline/candidate-proof.json');
const image35=await read('final-acceptance/35/image-island-local-final-20261031.json');
const image35Candidate=await read('rule-repairs/35/native-image-island/candidate-proof.json');
const opening38=await read('final-acceptance/38/opening-extract-local-final-20261031.json');
const opening38Mobile=await read('final-acceptance/38/opening-extract-mobile-20261031.json');
const phone38=await read('final-acceptance/38/phone-seven-chats-source-target-20261031.json');
const apps38=await read('final-acceptance/38/phone-five-apps-source-target-20261031.json');
if(!opening38.clipboardExact||!opening38.realPaste?.exact||opening38.sandbox!=='allow-scripts'||opening38.draft!==''||opening38.sends!=='0'||!opening38Mobile.clipboardExact||phone38.rows.length!==7||!phone38.rows.every((r:{correctViews:boolean;textExact:boolean})=>r.correctViews&&r.textExact)||apps38.rows.length!==5||!apps38.rows.every((r:{textExact:boolean;source:{active:boolean};target:{active:boolean}})=>r.textExact&&r.source.active&&r.target.active))throw Error('REAL_PUBLIC_OPENING_AND_PHONE38_REQUIRED');
if(!image35.all25PublicCopiesExact||!image35.imagesExact||!image35.sampledPaintExact||!image35.localSizeExact||!image35.parentRepaintRetainsTab||!image35.audioNotStarted||image35.sends!=='0'||!image35Candidate.allOtherOwnerBytesPreserved)throw Error('REAL_IMAGE_ISLAND_PROOF_REQUIRED');
if(!timeline41.fourModalTextsExact||!timeline41.sampledTriggerPaintExact||!timeline41.closedAfterParentRepaint||!timeline41.keyboardOpenEscapeClose||timeline41.iframeCount!==0||!timeline41Candidate.allOtherOwnerBytesPreserved)throw Error('FOUR_REAL_TIMELINE_ENTRIES_REQUIRED');
if(focus34.rows.length!==7||!focus34.rows.every((r:{source:{focused:boolean;opacity:string};target:{focused:boolean;opacity:string};textExact:boolean})=>r.source.focused&&r.target.focused&&r.source.opacity==='1'&&r.target.opacity==='1'&&r.textExact))throw Error('SEVEN_SETTLED_RELATIONSHIPS_REQUIRED');
if(!copy47.clipboardExact||!copy47.realPaste.exact||copy47.sends!=='0'||copy47.sandbox!=='allow-scripts'||!copy47.cleared.statusHidden||!network47.complete||!profile46.allOtherOwnerBytesPreserved||!profile46.originalProgramPreserved)throw Error('PROFILE_AND_REAL_CLIPBOARD_PROOF_REQUIRED');
if(!divider43.textExact||!divider43.childStylesExact||divider43.localVisible.opacity!=='1'||!passive43.sameResourceAndDimensions||passive43.localCanvasHeight!==100||!island43.commandsComplete||island43.commands.length!==26||!island43.relationTextExact||island43.sends!=='0'||!island43.middleInsertion.exact||!island43Candidate.allOtherOwnerBytesPreserved)throw Error('RANK43_REAL_RESTORATION_REQUIRED');

// Repair the missing inventory timestamp in an older merge, not the observation date.
const source25 = await read('final-acceptance/25/source-public-component-inventory.json');
const mapping25 = await read('final-acceptance/25/component-ui-mapping.json');
if (mapping25.sourceUrl !== source25.url) throw Error('SOURCE25_IDENTITY_MISMATCH');
if (!mapping25.sourceObservedAt) {
  mapping25.sourceObservedAt = source25.observedAt;
  await write('final-acceptance/25/component-ui-mapping.json', mapping25);
}

const coverageRows = [];
for (const row of qa.rows as {rank:number;name:string;publicComponentFollowup?:Record<string,unknown>}[]) {
  const source = await read(`final-acceptance/${row.rank}/source-public-component-inventory.json`);
  const mappingFile = Bun.file(`${root}/final-acceptance/${row.rank}/component-ui-mapping.json`);
  const mapping = await mappingFile.exists() ? await mappingFile.json() : null;
  if (mapping && (mapping.sourceObservedAt !== source.observedAt || mapping.sourceUrl !== source.url)) throw Error(`STALE_SOURCE_MAPPING_${row.rank}`);
  if (mapping) for (const entry of mapping.rows as PublicComponentDisposition[]) {
    if (!entry.evidence || !await Bun.file(`${root}/${entry.evidence}`).exists()) throw Error(`MISSING_COMPONENT_PROOF_${row.rank}_${entry.sourceIndex}`);
  }
  const coverage = publicComponentCoverage(source.roots[0].frames.length, mapping?.rows ?? []);
  row.publicComponentFollowup ??= {};
  row.publicComponentFollowup.explicitUiCoverage = coverage;
  coverageRows.push({rank:row.rank,name:row.name,...coverage,scopeHold:row.rank===37});
}
const observedAt = new Date().toISOString();
qa.observedAt = observedAt;
qa.currentPublicUiFollowup = {
  observedAt,
  ranks:[23,24,26,27,28,29,30,32,34,35,36,38,41,43,44,45,46,47,48],
  evidence: 'public-component-mapping-reconciled-20261031.json',
  scope:'Actual browser correspondence, qualified external resources and explicit gaps; not release approval',
};
const accepted = qa.rows.filter((r: {fullFidelityAccepted?:boolean}) => r.fullFidelityAccepted === true).length;
if (accepted !== qa.fullFidelityAccepted) throw Error('ACCEPTANCE_COUNT_DRIFT');
qa.rows.find((r:{rank:number})=>r.rank===44).publicPlateFontRepair={evidence:'final-acceptance/44/public-font-local-20261031.json',candidate:'rule-repairs/44/public-plate-font/candidate-opening.txt',candidateSha256:fontCandidate44.candidateSha256,sourceFontDeclarationMatchedLocally:true,allOtherOwnerBytesPreserved:true,globalFontChanged:false,ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};
qa.rows.find((r:{rank:number})=>r.rank===45).publicDocumentFontRepair={evidence:'final-acceptance/45/public-font-runtime-local-20261031.json',sourceFontDeclarationMatchedLocally:true,sourceMotionObserved:true,localMotionObserved:true,authorContentChanged:false,TESTDeployed:false,fullFidelityAccepted:false};
qa.rows.find((r:{rank:number})=>r.rank===48).standaloneMusicAndControls={evidence:'final-acceptance/48/inline-audio-current-20261031.json',standaloneTrackDuration:236.437,pairedPlaybackObserved:true,finalPaused:true,coverRestored:false,qaCards:4,relationshipCards:4,businessEntries:3,pointerQualification:'Second and third business entries verified with native summary Enter, not successful pointer clicks',separateSidebarTrackAccepted:false,fullFidelityAccepted:false};
await write('qa-progress.json',qa);
const summary = {
  observedAt, imported:28, scopeHoldRank:37, fullFidelityAccepted:accepted,
  sourceBlocks:coverageRows.reduce((sum,r)=>sum+r.expectedSourceBlocks,0),
  explicitMapped:coverageRows.reduce((sum,r)=>sum+r.mapped,0),
  missingMappings:coverageRows.reduce((sum,r)=>sum+r.missing.length,0),
  pendingCorrespondences:coverageRows.reduce((sum,r)=>sum+r.unresolved.length,0),
  rows:coverageRows,
  caution:'Unchanged external URLs and matching text are not restored media or full visual acceptance. Mapping completion is not permission to build.',
  buildStarted:false,deployed:false,agentNetMs:null,
};
await write('public-component-mapping-reconciled-20261031.json',summary);
cursor.observedAt=observedAt;
cursor.currentPublicUiFollowup=qa.currentPublicUiFollowup;
cursor.completedThisPass=[...new Set([...cursor.completedThisPass,
  '28 seven opening blocks explicitly mapped: static collage, intro and gradient decoration checked; audio remains unconfirmed',
  '29 guide normal UI open/close and intro typography checked; music remains unconfirmed',
  '27 four source/TEST profile folds exact; expired original portrait and undecoded original audio explicitly qualified',
  '44 three news tabs, four selected profile pages, nine decoded image pairs, two instruction folds checked; scoped inherited font repaired locally without global font changes',
  '45 static collage and typography checked; seven image pairs decode and two fail on both sides; shared standalone font repair and actual rain motion verified locally',
  '48 four QA cards and avatar toggle, four relationship cards, three business entries checked; standalone 236.437s track actually progressed on both sites then paused; separate sidebar track remains unconfirmed',
])];
const candidateAudit=await read('candidate-baseline-audit-20261031.json');
if(candidateAudit.candidates!==19||candidateAudit.invalid!==0||candidateAudit.rows.find((r:{rank:number})=>r.rank===44).finalSha256!==fontCandidate44.candidateSha256)throw Error('CURRENT_FONT_CANDIDATE_CHAIN_REQUIRED');
qa.candidateBaselineAudit.observedAt=candidateAudit.observedAt;
cursor.candidateBaselineAudit.observedAt=candidateAudit.observedAt;
for(const record of[qa.candidateBaselineAudit,cursor.candidateBaselineAudit]){record.candidates=candidateAudit.candidates;record.valid=candidateAudit.valid;record.invalid=candidateAudit.invalid;}
const validation=await read('latest-validation.json');
const runtime=JSON.parse(await readFile('outputs/mufy-consolidated-20261029/runtime-manifest.json','utf8'));
if(validation.failed!==0||validation.typecheck.exitCode!==0)throw Error('LATEST_LOCAL_VALIDATION_REQUIRED');
cursor.localRegression={passed:validation.passed,failed:validation.failed,assertions:validation.assertions};
cursor.patchSha256=runtime.patchSha256;
cursor.nextChecks[0]={status:'All 27 eligible opening inventories explicitly mapped; finish pending component fidelity/integration, not another mapping pass',ranks:coverageRows.filter(r=>r.rank!==37&&r.unresolved.length>0).map(r=>r.rank),missingByRank:Object.fromEntries(coverageRows.filter(r=>r.missing.length>0).map(r=>[r.rank,r.missing.length])),note:'Only rank37 scope hold remains unmapped. A complete mapping is NOT full-card acceptance or permission to build.'};
cursor.completedThisPass=[...new Set([...cursor.completedThisPass,'24/32/34/46/47 remaining opening inventories explicitly mapped with reasons; rank34 seven actual focus cards match','46 actual clipped profile/broken close reproduced; full-viewport exact-program candidate repaired font/box model/scrollbar locally with close/reopen/redraw/Escape and 390 scrolling','47 three profile tabs/four folds/translation/seven OC sections/two network groups checked; real original audio plays on both sites; clipboard copy repaired locally and real paste exact without sends'])];
qa.rows.find((r:{rank:number})=>r.rank===46).fullscreenProfileRepair={evidence:'final-acceptance/46/fullscreen-profile-inheritance-fixed-source-target-20261031.json',candidate:'rule-repairs/46/fullscreen-profile/candidate-opening.txt',candidateSha256:profile46.candidateSha256,ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};
qa.rows.find((r:{rank:number})=>r.rank===47).ocProfileCopyRepair={evidence:'final-acceptance/47/oc-form-copy-local-final-20261031.json',realClipboardAndPasteExact:true,sandboxUnchanged:true,TESTDeployed:false,fullFidelityAccepted:false};
qa.rows.find((r:{rank:number})=>r.rank===41).publicTimelineRepair={evidence:'final-acceptance/41/timeline-local-final-20261031.json',candidate:'rule-repairs/41/public-timeline/candidate-opening.txt',candidateSha256:timeline41Candidate.candidateSha256,entries:4,ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};
qa.rows.find((r:{rank:number})=>r.rank===35).publicImageIslandRepair={evidence:'final-acceptance/35/image-island-local-final-20261031.json',candidate:'rule-repairs/35/native-image-island/candidate-opening.txt',candidateSha256:image35Candidate.candidateSha256,avatars:9,emojis:16,all25ClipboardCopiesExact:true,audioPlaybackAccepted:false,mobileVerified:image35.mobileVerified===true,ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};
qa.rows.find((r:{rank:number})=>r.rank===38).publicPhoneAndOpeningCopy={evidence:'final-acceptance/38/opening-extract-local-final-20261031.json',realMockChats:7,otherMockApps:5,publicOpeningCharacters:opening38.publicTextCharacters,localClipboardAndRealPasteExact:true,mobileClipboardExact:true,sandboxUnchanged:true,TESTDeployed:false,fullFidelityAccepted:false};
cursor.completedThisPass=[...new Set([...cursor.completedThisPass,'390 viewport binding recovered by closing only agent-created media error tab and selecting a fresh local preview;35 image island,43 narrow navigation and41 four full-viewport timeline modals actually checked. Timeline scrollbar gutter fixed with100vw/100dvh; no physical touch claim','38 six profile folds,four friend folds,seven correctly titled mock chats and five other mock apps source/TEST exact. Static intro font inheritance gap qualified.1799-char public opening extraction actually failed separately on source/TEST Chrome; narrow existing host clipboard bridge reused locally,real copy andCtrlVexact,390copy successful,no draft writes/sends. Not TEST deployed'])];
cursor.completedThisPass=[...new Set([...cursor.completedThisPass,'35 real source/TEST five profile pages,eight native scene folds,fourteen QA texts,eight static mock phone panels compared; source last diary pointer and whole-card horizontal containment remain qualified','35 missing three-tab parent island locally restored from fresh normal owner-UI baseline; all25 originals decode and actual clipboard copies exact,320x480/sample paint match,parent repaint retains tab. Original loop preserved but audio deliberately not started under browser site-safety restriction. Not TEST deployed'])];
cursor.completedThisPass=[...new Set([...cursor.completedThisPass,'41 actual stable four profile tabs match; fast-loop transition misdiagnosis retained and corrected without unnecessary profile code edits','41 missing timeline restored in source order as finite public four-entry candidate; exact actual modal texts,220px trigger paint,real close/reopen/keyboard and parent repaint checked. Not TEST deployed; mobile pending','43 extra parent four-arrow navigation locally restored; actual0.8 viewport scroll steps,drag and stable repaint checked. Mobile override failed to apply and is not accepted'])];
qa.rows.find((r:{rank:number})=>r.rank===43).missingPublicComponentsRepair={evidence:'final-acceptance/43/multimodule-island-local-final-20261031.json',candidate:'rule-repairs/43/native-narrow-navigation/candidate-opening.txt',candidateSha256:island43Candidate.candidateSha256,restoredSourceIndices:[3,7,8],additionalParentUi:'censy-narrow-nav-v14',publicCommands:26,exactMiddleInsertion:true,ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};
cursor.completedThisPass=[...new Set([...cursor.completedThisPass,'43 actual missing divider/passive ornament reproduced and locally restored with exact text/13 sampled child styles/decoded original art/100px fixed-scene canvas; source placement preserved','43 complete three-module finite island locally restored: five original tracks, six source relation cards, all26 commands; real pointer copies/caret/middle insertion and390 containment checked. Generic hidden CSS, wrong append contract and deferred caret issues fixed without weakening security. Still not TEST deployed'])];
cursor.runtimeFontRepair={scope:'Only opt-in standalone Mufy opening document defaults, before author CSS; ordinary/parent/reply skins unchanged',evidence:'final-acceptance/45/public-font-runtime-local-20261031.json',deployed:false};
await write('qa-progress.json',qa);
await write('continuation-next-20261031.json',cursor);
// Do not repeatedly restamp old detailed narratives as fresh browser work.
const priorRunbook=await readFile(`${root}/RUNBOOK.txt`,'utf8');
await appendFile(`${root}/RUNBOOK.txt`,`${observedAt} Evidence reconciliation only: imported28, full-card accepted${accepted}, source blocks${summary.sourceBlocks}, mapped${summary.explicitMapped}, pending correspondences${summary.pendingCorrespondences}; current regression${validation.passed}/${validation.failed}, assertions${validation.assertions}; candidate chains${candidateAudit.candidates}/${candidateAudit.valid}; patch${runtime.patchSha256}. No new browser operations, TEST build/deploy or model/DB actions in this merge.\n`);
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'offline-public-browser-evidence-reconciliation-current',elapsedMs:performance.now()-started,agentNetMs:null,scope:'Process wall only; browser timings remain in individual proofs'})+'\n');
if(!priorRunbook.includes('Rank48 seven source blocks now explicitly mapped.')){
await appendFile(`${root}/RUNBOOK.txt`,`\n${observedAt} Public browser follow-up: 27 four real profile folds text exact and restored closed. Source portrait fails to decode; TEST returns original-URL 64px 已过期 placeholder, not restored artwork. Original audio remains undecoded. 28 static chat collage text/sample styles exact; no controls (two bridge/helper scripts are present, not zero scripts); visible gradient ribbon matched, not nonvisual helper. 29 guide stable open/close and static intro text/typography exact; original music unconfirmed. 44 three news tabs, four selected profile pages (visibility/opacity checked after transitional samples), nine decoded original image pairs and two instruction folds checked; {{char}} role binding explicitly qualified. Source inherited Noto Sans SC versus TEST system font repaired only on the plate root in a reversible candidate; actual local OpeningSlot text/font/paint matched, not owner-saved or deployed. All 18 candidate chains re-audited valid including added rank44 font stage. Mapping metadata and actual evidence reconciled; no acceptance upgrade/build/deployment/model sends.\n`);
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'offline-public-browser-evidence-reconciliation',elapsedMs:performance.now()-started,agentNetMs:null,scope:'Process wall only; browser operations recorded in individual proof files'})+'\n');
await appendFile(`${root}/RUNBOOK.txt`,`\n${observedAt} Follow-up ranks24/32/34/46/47 explicitly mapped with source inventory identity checks. Seven actual rank34 focus cards settled visible and exact. Rank46 source full-screen profile versus clipped/broken-close TEST reproduced; reversible exact-program full viewport candidate has equal text/style samples and real close/reopen/redraw/Escape/mobile bottom scroll, not TEST deployed. Rank47 seven OC form sections/generation checked, original copy proven silent against synthetic clipboard sentinel. Repaired finite own-frame/active-gesture host copy writes the actual 522-character clipboard and real paste exactly; no draft/send changes, clear and 390 containment checked. First iframe execCommand attempt falsely returned true and was rejected, not shipped. Original 229.253333s music actually decoded/played both sites then paused. Nine source blocks mapped; three sidebar blocks absent on TEST remain pending. Full card acceptance stays zero; no build/deploy/model/DB. Current regression ${validation.passed}/${validation.failed}, ${validation.assertions} assertions; current runtime ${runtime.patchSha256}.\n`);
await appendFile(`${root}/RUNBOOK.txt`,`\n${observedAt} Shared runtime font default restricted to opt-in standalone Mufy opening documents. Original component source-skin markers checked before split; early excluded-canvas regression failed and was repaired before final 273/0 (1353 assertions). Rank45 actual OpeningSlot text/font/paint and eleven rain animation configurations matched; two observed transforms advanced on source and local. Nine original profile/chat/timeline image URLs exact, seven decode both sides and two fail both sides. Current 24-file local patch ${runtime.patchSha256}; actual application hashes and exact overlay typecheck passed separately. No TEST build/deploy.\n`);
await appendFile(`${root}/RUNBOOK.txt`,`\n${observedAt} Rank48 seven source blocks now explicitly mapped. Four QA pages and four social pages checked only when selected visibility/opacity reached visible/1; avatar toggle matched/restored. First enterprise entry pointer-opened; second/third pointer cycle did not open on either site, so native keyboard Enter was separately exercised and exact opened text saved; all closed at end. Original standalone audio (NOT FeelingGood sidebar) decoded duration236.437s, cover clicks actually progressed source25.996139/TEST25.162199s and then paused. Cover and eleven other original pictures fail on both sites, not restored; URLs unchanged. Source0 default font remains a pending TEST runtime fix. Source6 native sidebar/music remains local-only and track unconfirmed. No sends/build/deploy or database access.\n`);
}
console.log(JSON.stringify({imported:28,fullFidelityAccepted:accepted,sourceBlocks:summary.sourceBlocks,explicitMapped:summary.explicitMapped,missingMappings:summary.missingMappings,pendingCorrespondences:summary.pendingCorrespondences,buildStarted:false}));
