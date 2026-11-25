import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Evidence reconciliation only. Never promotes imported/saved rules to acceptance.
const root=join(process.cwd(),'logs/mufy-profiles/full-20261013/next-batch-30-20261028');
const read=async(file:string)=>JSON.parse(await readFile(join(root,file),'utf8'));
const qa=await read('qa-progress.json');
const receipts=await read('normal-ui-import-receipts.json');
const validation=await read('latest-validation.json');
if(validation.failed!==0||validation.typecheck.exitCode!==0)throw Error('LATEST_TARGETED_VALIDATION_FAILED');
if(receipts.rows.length!==28||new Set(receipts.rows.map((r:{rank:number})=>r.rank)).size!==28)throw Error('IMPORT_RECEIPT_COUNT_MISMATCH');
const checks=[
 {rank:22,status:'Missing observed public profile restored through normal owner UI, preserving the previous opening. Source styles recovered after parser head hoisting; real mobile/desktop geometry and track switching checked. One source background image still unavailable on target; complete card unaccepted',evidence:['final-acceptance/22/public-profile-save-proof.json','final-acceptance/22/target-profile-mobile.png']},
 {rank:24,status:'Music island routing deployed; actual mobile expansion/close and 500px outer scroll with stable floater checked. Four native control surfaces now match observed source palette through normal UI theme edit. Composer companion still missing; complete card unaccepted',evidence:['final-acceptance/24/music-island-and-controls-check.json','final-acceptance/24/target-music-controls-mobile.png']},
 {rank:26,status:'summary border-box repaired; closed and expanded body width/height match; desktop screenshot reviewed',evidence:['rule-repairs/26/summary-overflow-open-after.json','26-summary-overflow-fixed-desktop.png']},
 {rank:43,status:'two top-level folds passed; source image and border-box preflight restored before author CSS; reload confirms 640px content without horizontal overflow; exact source sticker sizing and complete media fidelity remain unaccepted',evidence:['rule-repairs/43/post-repair-fold-controls.json','rule-repairs/43/image-baseline-after.json','rule-repairs/43/preflight-order-after.json','43-state-images-bounded-desktop.png']},
 {rank:46,status:'source-observed narration/title/model colors restored; four folds passed; GP rule matched but its parent-injection pet was absent; viewport-only sandbox repair under deployment/actual UI verification, not yet accepted',evidence:['rule-repairs/46/public-semantic-repair-proof.json','46-semantic-repair-mobile.png','46-semantic-repair-mobile-prose.png']},
 {rank:47,status:'three native folds passed; native HTML header works; host-only controls now share observed source model surface including original blur and palette; desktop and 390px visuals plus model menu checked; full media fidelity remains unaccepted',evidence:['rule-repairs/47/native-fold-controls.json','rule-repairs/47/public-semantic-repair-proof.json','47-semantic-controls-fixed-mobile.png']},
 {rank:49,status:'two display-only compatibility rules repair the known indented memory fold and duplicated template end tags; all four controls now remain inside their container, same width/center alignment, no escaped BBS while collapsed; memory and nested archive toggled/restored; desktop and mobile screenshots reviewed; author rules/raw history unchanged',evidence:['rule-repairs/49/indent-live-repair-proof.json','49-memory-fold-fixed-mobile.png','49-all-status-folds-repaired-desktop.png']},
];
const imageRecovery=await read('final-acceptance/22/profile-image-recovery-check.json').catch(()=>null);
const nativeSidebarAudit=await read('final-acceptance/47/native-sidebar-local-audit.json').catch(()=>null);
const nativeSidebarBrowser=await read('final-acceptance/47/local-native-sidebar-interaction-check.json').catch(()=>null);
const companionBrowser=await read('final-acceptance/24/local-composer-companion-browser-check.json').catch(()=>null);
const restored26=await read('final-acceptance/26/missing-components-owner-ui-repair.json').catch(()=>null);
if(restored26?.ownerUiSaved&&restored26?.observedAfterFreshNavigation){
 const check=checks.find(c=>c.rank===26)!;
 check.status='Earlier summary border-box fix preserved. Three omitted public components restored through owner UI and verified after fresh navigation. Exact nested fence debris removed, alternate opening fold toggled/restored and horizontal NPC gallery scrolled. Four original images have natural dimensions but not all complete. Copy test exposed a missing OpeningSlot draft callback: production wiring now repaired locally, real browser fixture fills draft with zero sends, regression passed. TEST release and source/full-media parity remain pending; not full-card accepted.';
 check.evidence.push('final-acceptance/26/source-missing-public-blocks.json','final-acceptance/26/missing-components-owner-ui-repair.json','final-acceptance/26/restored-components-current.jpg');
 if(await Bun.file(join(root,'final-acceptance/26/local-opening-copy-rpc-check.json')).exists())check.evidence.push('final-acceptance/26/local-opening-copy-rpc-check.json');
}
if(companionBrowser?.mobileAfterRerender?.frameCount===1){
 const check=checks.find(c=>c.rank===24)!;
 check.status='Live music island and four control palette checks previously passed. Isolated composer companion now actually displays in local desktop/mobile browser; question/love input, control feedback and two parent rerenders observed with one retained frame and no mobile horizontal overflow. Local fixture has no account/model/database. TEST deployment, real keyboard/streaming and source interaction parity still pending; not full-card accepted.';
 check.evidence.push('final-acceptance/24/local-composer-companion-browser-check.json','final-acceptance/24/local-composer-companion-mobile.jpg');
}
if(nativeSidebarAudit?.sourceBlockCount===5&&nativeSidebarAudit?.preparedBlockCount===2){
 const check=checks.find(c=>c.rank===47)!;
 check.status='Native folds and host control palette checked previously. New real-source drawer audit found a 48px image trigger/320x380 panel exported as a 1080x1400 inline image, with only two of five public blocks in the prepared snapshot. All five blocks now captured without source bookkeeping. Shell routing/source-size opaque viewport and lazy-capture guards pass local tests only; five-block nested isolated composition is still incomplete. Not built, not deployed, not fully accepted.';
 check.evidence.push('final-acceptance/47/native-sidebar-structure-check.json','final-acceptance/47/source-sidebar-public-blocks.json','final-acceptance/47/native-sidebar-local-audit.json');
 if(nativeSidebarAudit.nestedCompositionLocalComplete===true){check.status='All five source sidebar blocks recovered and locally composed in independently opaque iframes inside an inert sanitized source-styled shadow drawer. Lazy first-open bootstrap, stable frame identity through open/close/stream rerenders, source viewport minimum/radius, and original surrounding opening preservation tested. Current owner baseline save and real-browser candidate geometry/copy/media acceptance remain pending; not built, not deployed, not fully accepted.';check.evidence.push('rule-repairs/47/native-sidebar/candidate-proof.json');}
 if(nativeSidebarBrowser){check.status='Five source sidebar blocks now locally composed and actually exercised in desktop/mobile browser: drawer/folds, gallery overlay, draft-only copy and music play/pause, retained frames across drawer close and parent rerender. Browser-discovered height feedback, duplicated runtime gallery nodes and inherited trigger ink repaired. Source owner baseline save and TEST post-release acceptance remain pending; not built, not deployed, not fully accepted.';check.evidence.push('final-acceptance/47/local-native-sidebar-interaction-check.json','final-acceptance/47/source-trigger-color-parity.json');}
}
const sourceFailureParity=[];
for(const [rank,file] of [[24,'final-acceptance/24/source-image-failure-parity.json'],[44,'final-acceptance/44/source-image-parity.json'],[45,'final-acceptance/45/source-image-parity.json']] as const){
 const proof=await read(file).catch(()=>null);
 if(proof)sourceFailureParity.push({rank,evidence:file,urls:proof.matchedOriginalUrls??proof.targetFailedUrls,classification:'exact original image URLs failed on both observed source and target; preserve originals, not proof of migration omission or complete card acceptance'});
}
if(imageRecovery?.allSevenOriginalImagesLoaded===true){
 const check=checks.find(c=>c.rank===22)!;
 check.status='Missing public profile restored through normal owner UI; all seven original profile images now loaded on real target after normal browser origin recovery. Original background downloaded unchanged. Other opening/sidebar assets and full card remain unaccepted.';
 check.evidence.push('final-acceptance/22/profile-image-recovery-check.json');
}
for(const [rank,file,status] of [
 [35,'final-acceptance/35/saved-reply-render-check.json','Existing saved reply now renders time/location and prose instead of historical code; all three status folds clicked open/closed and restored. Source-wide media/layout fidelity remains unaccepted.'],
 [48,'final-acceptance/48/saved-mail-render-check.json','Existing saved mail XML now renders as mail UI; real body and bounded width checked. Complete source/media and responsive fidelity remains unaccepted.'],
] as const){if(await Bun.file(join(root,file)).exists())checks.push({rank,status,evidence:[file]});}
const petUi=await read('rule-repairs/46/reply-pet-actual-ui.json').catch(()=>null);
if(petUi?.uiVerified===true){
 const check=checks.find(c=>c.rank===46)!;
 check.status='Source-observed narration/title/model colors restored; four folds passed; GP parent-alias, independent owner gate and zero-area bootstrap defects repaired. Actual viewport pet proof passed only for the explicitly recorded interactions and sizes; complete card/media fidelity remains unaccepted.';
 check.evidence.push('rule-repairs/46/reply-pet-actual-ui.json');
}
const nativeFoldChecks=[];
for(const receipt of receipts.rows){
 for(const file of ['actual-latest-top-level-folds.json','actual-latest-frame-folds.json']){
  const proof=await read(`rule-repairs/${receipt.rank}/${file}`).catch(()=>null);
  if(!proof)continue;
  const prepared=await read(`prepared/${receipt.sourceKey}/prepared.json`);
  if(proof.title!==prepared.targetName)throw Error('FOLD_AUDIT_WRONG_ROLE');
  nativeFoldChecks.push({rank:receipt.rank,evidence:`rule-repairs/${receipt.rank}/${file}`,count:proof.controls.length,passed:proof.controls.filter((c:{pass?:boolean})=>c.pass===true).length,emptyIsNotAcceptance:proof.controls.length===0,fullFidelityAccepted:false});
 }
}
const nativeAudit=await read('native-path-current-audit.json').catch(()=>({rows:[]}));
const loadedNative=nativeAudit.rows.filter((r:{loaded?:boolean})=>r.loaded===true);
for(const observation of loadedNative){
 const receipt=receipts.rows.find((r:{rank:number})=>r.rank===observation.rank);
 if(!receipt)throw Error('NATIVE_AUDIT_UNKNOWN_RANK');
 const prepared=await read(`prepared/${receipt.sourceKey}/prepared.json`);
 if(prepared.targetName!==observation.facts.title)throw Error('NATIVE_AUDIT_WRONG_ROLE');
 const row=qa.rows.find((r:{rank:number})=>r.rank===observation.rank);
 row.currentPageObservation={observedAt:observation.observedAt,evidence:'native-path-current-audit.json',loaded:true,fullFidelityAccepted:false};
}
for(const check of checks){for(const file of check.evidence)await readFile(join(root,file));const row=qa.rows.find((r:{rank:number})=>r.rank===check.rank);if(!row)throw Error('QA_ROW_MISSING');row.targetedPostRepairChecks={...check,observedAt:new Date().toISOString(),fullFidelityAccepted:false};}
const petDeploymentPath=(await Promise.all(['fit','drag','ready','bootstrap','owner',''].map(async phase=>{const path=`outputs/mufy-reply-pet${phase?'-'+phase:''}-20261028/deployment.json`;return await Bun.file(path).exists()?path:null;}))).find(Boolean)!;
const petDeployment=await readFile(petDeploymentPath,'utf8').then(JSON.parse).catch(()=>null);
const openingReleasePath=(await Promise.all(['outputs/mufy-opening-island-20261028/deployment.json','outputs/mufy-opening-bilibili-20261028/deployment.json','outputs/mufy-opening-height-20261028/deployment.json'].map(async path=>await Bun.file(path).exists()?path:null))).find(Boolean);
const openingRelease=openingReleasePath?JSON.parse(await readFile(openingReleasePath,'utf8')):null;
const followup={observedAt:new Date().toISOString(),imported:28,held:2,fullFidelityAccepted:0,sourceRuleCapture:{total:28,nonempty:16,empty:12,savedAndReloadVerified:16},checks,nativeFoldChecks,currentPageObservations:{count:loadedNative.length,ranks:loadedNative.map((r:{rank:number})=>r.rank),scope:'loaded-page appearance facts only, not full source acceptance'},validation:{tests:validation.passed+validation.failed,passed:validation.passed,failed:validation.failed,assertions:validation.assertions,typecheck:'targeted typecheck passed; full workspace check blocked by pre-existing generated .next/dev/types/validator.ts parse error',evidence:'latest-validation.json',designDetectFindings:0},browser:{interruption:'repeated timeouts and session reset; transient error-page state recovered using a fresh normal tab',recovered:true,remainingWork:'continue actual source/media/interaction comparison; do not repeat imports or paid generations'},release:{image:petDeployment?.image??'sha256:1cd27daa828b8ef7e4187caff5099b62adc19465bef8faa6870370b69857780d',formNewlineFixDeployed:true,independentSourceFrameIsolationDeployed:true,subsequentRepairs:'normal owner UI data edits; GP viewport pet release tracked separately',petDeploymentEvidence:petDeployment?petDeploymentPath:null},agentNetMs:null,netTimingNote:'No inferred active-work total. Browser/service waits and server builds are not Agent net time.'};
Object.assign(followup,{sourceFailureParity,consolidatedBuildStarted:false,nativeSidebarCandidate: nativeSidebarAudit ? {rank:47,sourceBlocks:5,preparedSnapshotBlocks:2,candidateBlocks:nativeSidebarAudit.candidateDocuments??0,nestedCompositionLocalComplete:nativeSidebarAudit.nestedCompositionLocalComplete===true,built:false,deployed:false}:null});
if(openingRelease?.deployed===true){
 followup.release.image=openingRelease.image;
 Object.assign(followup.release,{openingReleaseEvidence:openingReleasePath,openingHeightVerified:true,officialPlayerScope:'User-approved exact HTTPS endpoint on TEST 8091 only; actual media acceptance separate'});
}
qa.observedAt=followup.observedAt;
qa.fullFidelityAccepted=qa.rows.filter((r:{fullFidelityAccepted?:boolean})=>r.fullFidelityAccepted===true).length;
if(qa.fullFidelityAccepted!==0)throw Error('UNEXPECTED_UNRECONCILED_ACCEPTANCE');
await writeFile(join(root,'post-repair-followup.json'),JSON.stringify(followup,null,2)+'\n');
await writeFile(join(root,'qa-progress.json'),JSON.stringify(qa,null,2)+'\n');
console.log(JSON.stringify({imported:followup.imported,held:followup.held,fullyAccepted:qa.fullFidelityAccepted,targetedChecks:checks.length}));
