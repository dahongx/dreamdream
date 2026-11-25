/** Offline, scoped evidence reconciliation. Never relabel historical screenshots. */
import {readFile, writeFile, appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {rendererFiles, rendererFingerprint} from './mufy-renderer-fingerprint.js';
import {verifyFidelityEvidenceFiles} from '../src/lib/import/mufy-fidelity-review';
import {verifyMufyReplyEvidence} from '../src/lib/import/mufy-reply-review';
const start=performance.now(),startedAt=new Date().toISOString();
const base=resolve('logs/mufy-profiles/full-20261013/pilot-5');
const root=join(base,'final-acceptance-20261020');
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const json=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
const assert=(ok:unknown,reason:string)=>{if(!ok)throw Error(reason);};
const current=new Map<string,string>(await Promise.all(rendererFiles.map(async(f:string)=>[f,await readFile(f,'utf8')] as [string,string])));
async function archive(map:Map<string,string>,name:string){
 const path=join(base,name+'.tar');
 const ls=Bun.spawnSync(['tar','-tf',path]);assert(ls.exitCode===0,'ARCHIVE_LIST_FAILED');
 for(const f of ls.stdout.toString().trim().split(/\r?\n/)){
  if(!rendererFiles.includes(f))continue;
  const p=Bun.spawnSync(['tar','-xOf',path,f]);assert(p.exitCode===0,'ARCHIVE_READ_FAILED');map.set(f,p.stdout.toString());
 }
}
const fingerprint=(m:Map<string,string>,count:number)=>hash(rendererFiles.slice(0,count).map((f:string)=>`${f}\n${m.get(f)}`).join('\n'));
const original=new Map(current);
for(const a of ['native-table-20261019120359000','component-fallbacks-20261020191012343','shared-style-20261020213557511'])await archive(original,a);
const prior=await json(join(root,'release-closeout.json'));
assert(fingerprint(original,13)===prior.rendererSha256,'ORIGINAL_EVIDENCE_BYTES_MISMATCH');
const layoutVersion=new Map(current);
for(const a of ['component-fallbacks-20261020191012343','statusbar-20261021041243056'])await archive(layoutVersion,a);
const layout=await json(join(base,'statusbar-regression-20261021/regression-report.json'));
assert(layout.passed&&fingerprint(layoutVersion,14)===layout.rendererSha256,'LAYOUT_EVIDENCE_BYTES_MISMATCH');
for(const a of layout.evidence)assert(hash(await readFile(join(base,'statusbar-regression-20261021',a.path)))===a.sha256,'LAYOUT_ARTIFACT_CHANGED');
const streamVersion=new Map(current);
for(const a of ['statusbar-20261021041243056','stream-20261021065136229'])await archive(streamVersion,a);
const stream=await json(join(base,'stream-regression-20261021/live-recovery.json'));
assert(fingerprint(streamVersion,16)===stream.rendererSha256&&stream.openedDuringStream&&stream.completedReplies===3,'STREAM_EVIDENCE_MISMATCH');
const deployment=await json(join(base,'sidebar-lifecycle-20261021095302705.json'));
assert(deployment.ok,'DEPLOYMENT_FAILED');
for(let i=0;i<deployment.files.length;i++)assert(hash(await readFile(deployment.files[i]))===deployment.hashes[i],'CURRENT_DEPLOYED_FILE_CHANGED');
for(let i=0;i<3;i++)assert(hash(streamVersion.get(deployment.files[i])!)===deployment.baseline[i],'LIFECYCLE_BASELINE_CHANGED');
const lifecycle=await json(join(base,'stream-regression-20261021/sidebar-lifecycle-verified.json'));
assert(lifecycle.passed&&Object.values(lifecycle.checks).every(v=>v===true),'LIFECYCLE_INCOMPLETE');
const lifecycleArtifacts=await Promise.all(lifecycle.artifacts.map(async(path:string)=>({path,sha256:hash(await readFile(join(base,'stream-regression-20261021',path)))})));
const review=await json(join(root,'manual-reply-reviews-release.json'));
const rows=[];
for(const r of review.rows){
 const binding={rendererSha256:prior.rendererSha256,sourceRuntimeSha256:hash(await readFile(join(base,r.sourceKey,'mufy-runtime-rendered-20261015.json'))),targetCharacterId:r.targetCharacterId,targetBaseUrl:'http://115.29.213.73:8091',notBefore:'2026-10-20T21:39:55.227Z'};
 const op=join(root,'opening-reports-release',r.key,'opening-report.json'),rp=join(root,'reply-reports-release',r.key,'reply-report.json');
 const raw=await json(join(root,`${r.key}-chat-390-initial.json`));
 const opening=await verifyFidelityEvidenceFiles(await json(op),binding,op);
 const replies=await verifyMufyReplyEvidence(await json(rp),{...binding,openingText:raw.frames.filter((f:{messageIndex:number})=>f.messageIndex===0).map((f:{text:string})=>f.text).join('\n')},rp);
 assert(opening.ok&&replies.ok,`HISTORICAL_EVIDENCE_INVALID:${r.key}:${JSON.stringify({opening,replies})}`);
 rows.push({key:r.key,accepted:true,originalEvidenceRenderer:prior.rendererSha256,opening,replies});
}
assert(rows.length===5&&new Set(rows.map(r=>r.key)).size===5,'FIVE_UNIQUE_CARDS_REQUIRED');
const tests=['src/lib/__tests__/mufy-sidebar-owner.test.ts','src/lib/__tests__/iframe-incremental.test.ts','src/lib/__tests__/mufy-native-table.test.ts','src/lib/__tests__/mufy-shared-component-style.test.ts','src/lib/__tests__/mufy-runtime-adaptation.test.ts','src/lib/__tests__/mufy-source-component-fallbacks.test.ts','src/lib/__tests__/mufy-rendered-opening.test.ts','src/lib/__tests__/mufy-source-rules.test.ts','src/lib/__tests__/segments-iframe.test.ts'];
const testStart=performance.now();const run=Bun.spawnSync(['bun','test',...tests]);
const testOutput=run.stdout.toString()+run.stderr.toString();
await writeFile(join(root,'scoped-final-tests.txt'),testOutput);assert(run.exitCode===0,'REGRESSION_FAILED');
const testElapsedMs=performance.now()-testStart;
const typeStart=performance.now();const typecheck=Bun.spawnSync(['bun','node_modules/typescript/bin/tsc','--noEmit','--pretty','false','-p','tsconfig.mufy-statusbar.json']);
assert(typecheck.exitCode===0,'SCOPED_TYPECHECK_FAILED');
const typeElapsedMs=performance.now()-typeStart;
const result={version:1,generatedAt:new Date().toISOString(),status:'accepted-with-explicit-scope-and-deferred-media',versionClosed:true,rendererSha256:await rendererFingerprint(process.cwd()),rows,
 evidencePolicy:'Historical observations keep their original fingerprints. Exact archive reconstruction plus reviewed change impact connects them to separately tested patches; this is not a new full 160-state visual run.',
 chain:{original:prior.rendererSha256,layout:layout.rendererSha256,stream:stream.rendererSha256,lifecycleDeployment:'../sidebar-lifecycle-20261021095302705.json'},
 impactReview:[
 'Layout patch: source state skin and collapsed geometry covered by dedicated mobile/desktop layout report; fire anchoring covered by actual-scroll proof.',
 'Stream patch: incremental iframe update replaces reload during generation; existing completed content/author rules remain. Real stream proof and current regression tests cover this path.',
 'Final lifecycle patch: only sidebar ownership and freeze behavior change. Message actions retain last-assistant indexing, source CSS/geometry and ordinary message rendering unchanged. Real normal-send open/close/reopen plus completion content update passed.',
 'Other two cards retain original component acceptance; no new source-card content, regex definition or database writes in these patches.'
 ],
 lifecycleArtifacts,deferredMedia:prior.deferredMedia,knownLegacyDifference:prior.knownLegacyDifference,
 limits:['Not every historical message is certified.','Stop/error/regenerate sidebar edge cases were not live-certified.','Unavailable external audio remains explicitly deferred; not claimed playable.'],
 tests:{files:tests,exitCode:run.exitCode,elapsedMs:testElapsedMs,output:'scoped-final-tests.txt',typecheck:'scoped-pass',typeElapsedMs},
 nextBatch:{size:5,readyForControlledPilot:true,migratedByThisRun:false},databaseOperations:0,productionWrites:0};
await writeFile(join(root,'scoped-release-closeout-20261021.json'),JSON.stringify(result,null,2));
await writeFile(join(root,'remaining-acceptance.json'),JSON.stringify({version:3,current:'scoped-release-closeout-20261021.json',versionClosed:true,rows,remainingBlockingChecks:[],limits:result.limits,deferredMediaRemain:true,nextBatchScope:'ready-for-controlled-five-card-pilot-not-migrated-by-this-closeout'},null,2));
await appendFile(join(root,'compute-timing.jsonl'),JSON.stringify({kind:'compute',runId:'scoped-release-reconciliation',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,status:'ok',browserTimeIncluded:false})+'\n');
console.log(JSON.stringify({versionClosed:true,keys:rows.map(r=>r.key),rendererSha256:result.rendererSha256,testSummary:testOutput.slice(-350)},null,2));
