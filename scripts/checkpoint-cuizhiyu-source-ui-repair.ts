import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019',t=performance.now(),startedAt=new Date().toISOString();
const priorReview=Bun.file(root+'/cuizhiyu-source-ui-review.json');
if(await priorReview.exists()&&(await priorReview.json()).ok&&!process.argv.includes('--reopen'))throw Error('ALREADY_VERIFIED_USE_EXPLICIT_REOPEN');
const review={observedAt:startedAt,ok:false,sceneStyled:true,eyeAnimationObserved:true,speechAvatarsVerified:true,memorySidebarVerified:false,visibleCompletionMarker:false,scope:'Cui source presentation regression, not a five-card full closeout',stage:'partial-ui-repair-deployment-blocked',liveChanges:['public scene skin','source eye animation','render-only completion suffix hiding','speech avatar compatibility'],remaining:['latest-reply memory viewport portal must be deployed and tested','post-deploy mobile/desktop and new-reply regression'],blockingEvidence:'source-presentation-deploy.json',blocker:'SSH server closes connection; no successful deployment',databaseCommands:0,productionWrites:0};
await writeFile(root+'/cuizhiyu-source-ui-review.json',JSON.stringify(review,null,2));
const receipts=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8'));
for(const row of receipts.rows)if(row.name==='崔稚玉'){row.accepted=false;row.trialAccepted=false;row.stage=review.stage;row.sourceUiReview='cuizhiyu-source-ui-review.json';}
await writeFile(root+'/normal-ui-import-receipts.json',JSON.stringify(receipts,null,2));
const path='logs/mufy-profiles/full-20261013/next-batch-5-20261019.json',plan=JSON.parse(await readFile(path,'utf8'));
plan.stage='five-private-card-trial-reopened';plan.holdReason=review.blocker;plan.sourceUiReview='next-batch-5-20261019/cuizhiyu-source-ui-review.json';
await writeFile(path,JSON.stringify(plan,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'checkpoint-source-presentation-repair',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'deployment-blocked'})+'\n');
console.log(JSON.stringify(review));
