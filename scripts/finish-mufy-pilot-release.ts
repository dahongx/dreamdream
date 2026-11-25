/** Offline release closeout: public evidence only; no migration, prompt, DB or network. */
import {readFile,writeFile,appendFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyFidelityEvidenceFiles} from '../src/lib/import/mufy-fidelity-review';
import {verifyMufyReplyEvidence} from '../src/lib/import/mufy-reply-review';
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020');
const startedAt=new Date().toISOString(),t=performance.now();
const hash=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const files=['src/lib/import/mufy-rendered-opening.ts','src/lib/import/mufy-source-rules.ts','src/lib/import/mufy-source-rule-envelope.ts','src/lib/regex/segments.ts','src/components/chat/MessageBubble.tsx','src/components/chat/MessageRenderer.tsx','src/components/chat/mufy-native-table.module.css','src/lib/import/mufy-native-table.ts','src/lib/regex/iframe-bridge.ts','src/lib/import/mufy-runtime-adaptation.ts','src/components/chat/ChatMessagesList.tsx','src/components/chat/mufy-shared-component-context.ts','src/lib/import/mufy-shared-component-style.ts','src/components/chat/MufyReplySidebar.tsx','src/components/regex/RegexIframe.tsx','src/lib/regex/iframe-incremental.ts','src/lib/chat/mufy-sidebar-owner.ts'];
const rendererSha256=hash((await Promise.all(files.map(async f=>`${f}\n${await readFile(f,'utf8')}`))).join('\n'));
// A completed reply or a synthetic replay alone cannot certify live streaming.
const streamProof=JSON.parse(await readFile(join(root,'..','stream-regression-20261021','live-recovery.json'),'utf8')) as {rendererSha256?:string;streamingVerified?:boolean};
if(streamProof.rendererSha256!==rendererSha256||streamProof.streamingVerified!==true)throw Error('CURRENT_LIVE_STREAM_REVIEW_REQUIRED');
// Fold counts and readable text did not catch the October 21 regression.
// Never close the release again without the dedicated geometry/skin/scroll proof.
const layoutRepair=JSON.parse(await readFile(join(root,'..','statusbar-regression-20261021','regression-report.json'),'utf8')) as {passed?:boolean;rendererSha256?:string};
if(layoutRepair.passed!==true||layoutRepair.rendererSha256!==rendererSha256)throw Error('CURRENT_STATUSBAR_LAYOUT_REGRESSION_PROOF_REQUIRED');
const reviews=JSON.parse(await readFile(join(root,'manual-reply-reviews-release.json'),'utf8')) as {rows:Array<{key:string;sourceKey:string;targetCharacterId:string}>;knownLegacyDifference:unknown};
const rows=[];
for(const r of reviews.rows){
 const binding={rendererSha256,sourceRuntimeSha256:hash(await readFile(join(root,'..',r.sourceKey,'mufy-runtime-rendered-20261015.json'))),targetCharacterId:r.targetCharacterId,targetBaseUrl:'http://115.29.213.73:8091',notBefore:'2026-10-20T21:39:55.227Z'};
 const openingPath=join(root,'opening-reports-release',r.key,'opening-report.json'),replyPath=join(root,'reply-reports-release',r.key,'reply-report.json');
 const raw=JSON.parse(await readFile(join(root,`${r.key}-chat-390-initial.json`),'utf8')) as {frames:Array<{messageIndex:number;text:string}>};
 const opening=await verifyFidelityEvidenceFiles(JSON.parse(await readFile(openingPath,'utf8')),binding,openingPath);
 const replies=await verifyMufyReplyEvidence(JSON.parse(await readFile(replyPath,'utf8')),{...binding,openingText:raw.frames.filter(f=>f.messageIndex===0).map(f=>f.text).join('\n')},replyPath);
 rows.push({key:r.key,opening,replies,accepted:opening.ok&&replies.ok});
}
if(rows.length!==5||!rows.every(r=>r.accepted))throw Error('CURRENT_RELEASE_EVIDENCE_NOT_COMPLETE:'+JSON.stringify(rows));
const customNames=['shy-dog-visible-2.jpg','shy-cat-visible.jpg','xsj-setting-open.jpg','xsj-setting-people.jpg','xsj-setting-closed.jpg','xsj-audio-unavailable-390.jpg','xsj-audio-unavailable-1280.jpg','fml-terminal-release-390-open.png','fml-terminal-release-390-closed.png','fml-terminal-release-390-reopened.png','fml-terminal-release-1280-open.png','fml-terminal-release-1280-closed.png','fml-terminal-release-1280-reopened.png','fml-terminal-release-1280-tasks.png'];
const customArtifacts=await Promise.all(customNames.map(async name=>({path:'component-closeout/'+name,sha256:hash(await readFile(join(root,'component-closeout',name)))})));
type Span={startedAt:string;elapsedMs:number;status:string};
const browserTiming=[];
for(const name of ['opening-release','replies-release']){
 const spans=(await readFile(join(root,name,'timing-runs.jsonl'),'utf8')).trim().split(/\r?\n/).map(s=>JSON.parse(s) as Span);
 const intervals=spans.map(s=>({start:Date.parse(s.startedAt),end:Date.parse(s.startedAt)+s.elapsedMs})).sort((a,b)=>a.start-b.start);
 let total=0,end=0;for(const s of intervals){if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.end<s.start)throw Error('INVALID_TIMING');total+=Math.max(0,s.end-Math.max(s.start,end));end=Math.max(end,s.end);}
 browserTiming.push({scope:name,recordedSteps:spans.length,failedRecords:spans.filter(s=>s.status!=='ok').length,measuredStepUnionMs:total,policy:'Union of recorded step intervals only. Includes measured failed/replaced attempts; excludes all inter-step/user/scheduler gaps. Not total Agent labor.'});
}
const media=JSON.parse(await readFile(join(root,'opening-release-reviews.json'),'utf8')) as {rows:Array<{key:string;mediaExceptions:unknown[]}>};
const nextPlan=JSON.parse(await readFile(resolve('logs/mufy-profiles/full-20261013/next-batch-5-20261019.json'),'utf8')) as {timing:{startedAt:string|null}};
const result={version:1,generatedAt:new Date().toISOString(),rendererSha256,status:'current-source-protocol-accepted-with-listed-differences',versionClosed:true,scope:'Five current migrated cards: 80 opening states plus 80 states over two distinct existing source-protocol replies per card. Does not certify every historical message or restore deferred external media.',rows,
 customInteractions:{status:'reviewed',artifacts:customArtifacts,detail:'Pet bubbles visibly rendered; settings open/tab/close; empty audio explicitly unavailable, not playback. Fire terminal original source skin, readable response and task text, open/close/reopen at both widths. Bag text is present in public DOM; not every long section is visible in a single viewport. Older source-component probes are unchanged-code evidence, not relabeled as new screenshots.'},
 deferredMedia:media.rows.filter(r=>r.mediaExceptions.length).map(r=>({key:r.key,items:r.mediaExceptions})),historicalRecords:{preserved:true,renderTimeSkinRepair:true,notFullHistoryCertified:true},
 correction:'The previous October 20 acceptance was revoked. Source state skin, collapsed fold geometry and actual-scroll viewport anchoring now require separate current-renderer evidence. Stored messages are unchanged; native/source-frame skins are repaired at render time. Do not claim complete historical-message coverage.',
 regressions:{passed:118,failed:0,files:10,reportedTestElapsedMs:21000,scope:'Current related regression run, not full-repository typecheck. Full repository typecheck has unrelated existing failures.'},
  browserTiming,nextBatchSize:5,nextBatchStarted:!!nextPlan.timing.startedAt,nextBatchScope:nextPlan.timing.startedAt?'public-ui-preflight-only-not-migrated':'not-started',databaseOperations:0,productionWrites:0,paidSendsDuringCloseout:0};
await writeFile(join(root,'release-closeout.json'),JSON.stringify(result,null,2));
const remainingPath=join(root,'remaining-acceptance.json');
if(!await Bun.file(join(root,'remaining-acceptance-before-release.json')).exists())await copyFile(remainingPath,join(root,'remaining-acceptance-before-release.json'));
await writeFile(remainingPath,JSON.stringify({version:2,current:'release-closeout.json',versionClosed:true,currentSourceProtocolAccepted:true,allHistoricalRepliesRetrofitted:false,deferredMediaRemain:true,nextBatchStarted:!!nextPlan.timing.startedAt,rows},null,2));
const finishedAt=new Date().toISOString(),elapsedMs=performance.now()-t;
await appendFile(join(root,'compute-timing.jsonl'),JSON.stringify({runId:'current-release-closeout',stepId:startedAt,kind:'compute',startedAt,finishedAt,elapsedMs,status:'ok'})+'\n');
console.log(JSON.stringify({versionClosed:true,rendererSha256,cards:rows.map(r=>({key:r.key,accepted:r.accepted})),browserTiming,computeElapsedMs:elapsedMs,knownDifference:'Stored history unchanged; deferred external media not restored; complete historical coverage not certified.'},null,2));
