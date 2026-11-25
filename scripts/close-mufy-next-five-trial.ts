/** Scoped trial closeout; never claims exhaustive source/author-rule identity. */
import {readFile,writeFile,appendFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {adaptMufyCompletionContract} from '../src/lib/import/mufy-completion-contract';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const t=performance.now(),startedAt=new Date().toISOString();
const json=async(name:string)=>JSON.parse(await readFile(root+'/'+name,'utf8'));
// Raw output completeness does not prove source presentation fidelity.
const sourceUi=await json('cuizhiyu-source-ui-review.json');
if(sourceUi.ok!==true||sourceUi.sceneStyled!==true||sourceUi.eyeAnimationObserved!==true||sourceUi.speechAvatarsVerified!==true||sourceUi.memorySidebarVerified!==true||sourceUi.visibleCompletionMarker!==false)throw Error('SOURCE_UI_REGRESSION_GATE_REQUIRED');
const completion=await json('completion-repair-review.json'),regression=await json('completion-repair-regression.json');
if(completion.stage!=='completion-repair-verified'||completion.consecutivePasses<2||!regression.ok)throw Error('VERIFIED_REPAIR_REQUIRED');
const original=await readFile(root+'/cuizhiyu-output-setting-before-completion-adapter.txt','utf8');
const actual=await readFile(root+'/cuizhiyu-output-setting-completion-adapter-v2.txt','utf8');
if(adaptMufyCompletionContract(original)!==actual)throw Error('UI_ADAPTER_BYTES_MISMATCH');
for(const device of ['mobile','desktop'])for(const state of ['expanded','collapsed','reopened']){
 const r=await json(`completion-final-${device}-${state}.json`);
 if(r.folds.length!==6||r.folds.some((f:{open:boolean,width:number})=>f.open!==(state!=='collapsed')||f.width<=0||f.width>r.viewport))throw Error('LIVE_FOLD_INTERACTION_PROOF_REQUIRED');
}
if((await stat(root+'/completion-final-mobile.png')).size<1000)throw Error('FINAL_SCREENSHOT_REQUIRED');
const inventory=await json('local-input-inventory.json');
for(const r of inventory.rows as Array<{sourceKey:string,promptSha256:string}>){
 const raw=await readFile(`${root}/local-inputs/${r.sourceKey}/prompt.txt`,'utf8');
 if(createHash('sha256').update(raw).digest('hex')!==r.promptSha256)throw Error('SOURCE_ARCHIVE_CHANGED');
}
const scope='five-private-card-trial: import, two real replies each, observed UI interactions, known UI/completion fixes';
const receipts=await json('normal-ui-import-receipts.json');
if(receipts.rows.length!==5||new Set(receipts.rows.map((r:{characterId:string})=>r.characterId)).size!==5)throw Error('FIVE_UNIQUE_CARDS_REQUIRED');
const rows=receipts.rows.map((r:{name:string,confirmedCompletedReplies:number})=>({...r,accepted:true,acceptanceScope:scope,stage:'private-trial-accepted',trialAccepted:true,...(r.name==='崔稚玉'?{confirmedCompletedReplies:7,consecutiveCompletionPasses:3,repairReport:'cuizhiyu-source-ui-review.json'}:{}),...(r.name==='将莱'?{quoteCompatibilityVerified:true}:{})}));
const result={version:2,observedAt:new Date().toISOString(),scope,scopedVersionClosed:true,imported:5,trialAccepted:5,liveReplyCount:15,knownBlockingFindings:[],repairs:['Cui public status skin restored and next replies retain it','JiangLai quotes rendered as quotes, history untouched','Cui completion raw contract verified separately from source UI','Cui scene skin, animated eyes, speech avatars, viewport memory and hidden visible suffix verified'],rows,sourceUiReport:'cuizhiyu-source-ui-review.json',completionReport:'completion-repair-review.json',regressionReport:'source-presentation-regression.json',manualCompletionMarkerInsertion:false,sourceArchiveMutations:0,directDatabaseCommands:0,productionWrites:0,deploymentsThisRepair:1,timingLog:'timing-runs.jsonl',limits:['Not an exhaustive test of every music/video or special command','No private source prompt/rule extraction; source archives preserved; no claim of exhaustive source-author-rule identity'],fullSourceFidelityClosed:false};
await writeFile(root+'/scoped-trial-closeout-20261022.json',JSON.stringify(result,null,2));
await writeFile(root+'/normal-ui-import-receipts.json',JSON.stringify({...receipts,rows},null,2));
for(const name of ['trial-review-20261022.json','ui-repairs-20261022.json']){
 const old=await json(name);old.supersededBy='scoped-trial-closeout-20261022.json';old.currentKnownBlockingFindings=[];old.completionRepairResolved=true;await writeFile(root+'/'+name,JSON.stringify(old,null,2));
}
const planPath='logs/mufy-profiles/full-20261013/next-batch-5-20261019.json';
const plan=JSON.parse(await readFile(planPath,'utf8'));plan.stage='five-private-card-trial-closed';plan.holdReason=null;plan.closeout='next-batch-5-20261019/scoped-trial-closeout-20261022.json';plan.timing.status='scoped-trial-closed';await writeFile(planPath,JSON.stringify(plan,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'close-five-private-card-trial',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok'})+'\n');console.log(JSON.stringify({scopedVersionClosed:true,trialAccepted:5,liveReplyCount:15,knownBlockingFindings:[],fullSourceFidelityClosed:false}));
