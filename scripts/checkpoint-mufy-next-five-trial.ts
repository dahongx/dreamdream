/** Reconcile observed trial evidence only; never promote to full source fidelity. */
import {readFile,writeFile,appendFile,stat} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const t=performance.now(),startedAt=new Date().toISOString();
const receipts=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8'));
if(receipts.rows.length!==5||new Set(receipts.rows.map((r:{characterId:string})=>r.characterId)).size!==5)throw Error('FIVE_UNIQUE_IMPORTS_REQUIRED');
const keys=['jianglai','songyang','shengzeyan','cuizhiyu','chenwang'];
const replies=['jianglai-second-reply-observation.txt','songyang-second-complete.txt','shengzeyan-second-reply-complete.txt','cuizhiyu-second-final.txt','chenwang-second-reply-recovered.txt'];
const rows=[];
for(let i=0;i<keys.length;i++){
 const reply=await readFile(root+'/'+replies[i],'utf8');
 const main=reply.split('- region')[0];
 if(main.includes('button "停止生成"')||(main.match(/button "訊息操作"/g)||[]).length<3)throw Error('TWO_COMPLETE_REPLIES_REQUIRED:'+keys[i]);
 for(const f of [`${keys[i]}-post-fix-mobile.jpg`,`${keys[i]}-post-fix-desktop.jpg`]){
  // Chen's mobile collapsed proof is a more specific filename.
  const target=f==='chenwang-post-fix-mobile.jpg'?'chenwang-post-fix-collapsed-mobile.jpg':f;
  if((await stat(root+'/'+target)).size<1000)throw Error('SCREENSHOT_REQUIRED:'+target);
 }
 rows.push({...receipts.rows[i],accepted:false,coreTrialPassed:true,confirmedCompletedReplies:2,stage:'private-core-trial-tested',replyEvidence:replies[i],scope:['Normal UI import','Two actual completed replies','Native status/phone/memory disclosure interactions','390px mobile and desktop observations'],limits:['Not an exhaustive test of every theater/media control or every source command','Private online prompt and full source rule bodies were not accessed']});
}
const native=JSON.parse(await readFile(root+'/ui-native-20261022052535405.json','utf8'));
const tests=JSON.parse(await readFile(root+'/ui-native-local-regression.json','utf8'));
const legacy=JSON.parse(await readFile(root+'/legacy-fengmanlou-fixed-terminal-smoke.json','utf8'));
if(!native.ok||!tests.ok||!legacy.pass)throw Error('PATCH_VERIFICATION_REQUIRED');
const result={version:1,observedAt:new Date().toISOString(),stage:'five-private-cards-core-trial-tested',imported:5,coreTrialPassed:5,strictSourceFidelityAccepted:0,liveReplyCount:10,rows,patch:{report:'ui-native-20261022052535405.json',localTests:'ui-native-local-regression.json',testCount:74,assertions:238,scopedTypecheck:true,legacyTerminalSmoke:'legacy-fengmanlou-fixed-terminal-smoke.json'},avatars:{method:'Public header image URLs verified against role names, browser download, normal upload/crop/save',confirmed:['cuizhiyu-avatar-target-confirmed.json','chenwang-avatar-target-confirmed.json']},knownDifferences:[{card:'将莱',detail:'Literal leading > remains in several dialogue paragraphs; core narrative and status functions observed.'},{card:'崔稚玉',detail:'Three status sections and two completed transports verified; source-author ☆ end marker could not be confirmed. Copy UI returned empty clipboard, so no raw-output success is claimed.'}],timing:{log:'timing-runs.jsonl',importerDeploymentMs:732179.8764,nativeContextDeploymentMs:native.elapsedMs,policy:'Deployment, browser actions and model waits separate. No total net-Agent hours or token totals inferred. Earlier unflushed model spans remain unknown; browser service waits are not model latency.'},safety:{directDatabaseCommands:0,productionWrites:0,visibility:'private'},fullSourceFidelityClosed:false};
await writeFile(root+'/trial-review-20261022.json',JSON.stringify(result,null,2));
const prior=JSON.parse(await readFile(root+'/live-acceptance-20261022.json','utf8'));
prior.supersededBy='trial-review-20261022.json';prior.browserBlock.resolved=true;prior.browserBlock.resolvedNote='Re-established Chrome control; ChenWang second reply was present, not resent. Public avatars later uploaded and verified. Historical observations below retained, not current blockers.';
await writeFile(root+'/live-acceptance-20261022.json',JSON.stringify(prior,null,2));
await writeFile(root+'/normal-ui-import-receipts.json',JSON.stringify({...receipts,rows},null,2));
const planPath='logs/mufy-profiles/full-20261013/next-batch-5-20261019.json';
const plan=JSON.parse(await readFile(planPath,'utf8'));
plan.stage=result.stage;plan.holdReason=null;plan.trialReview='next-batch-5-20261019/trial-review-20261022.json';plan.timing.status='core-trial-checkpointed';
await writeFile(planPath,JSON.stringify(plan,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'checkpoint-next-five-core-trial',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok'})+'\n');
console.log(JSON.stringify({imported:5,coreTrialPassed:5,liveReplies:10,fullSourceFidelityClosed:false}));
