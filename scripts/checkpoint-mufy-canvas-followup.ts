/** Evidence reconciliation only. No browser requests, DB, deployment or acceptance promotion. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const tick=performance.now(),read=async(p:string)=>JSON.parse(await readFile(root+'/'+p,'utf8'));
const validation=await read('latest-validation.json');
const canvas=await read('final-acceptance/49/fixed-canvas-local-final-20261031.json');
const manifest=JSON.parse(await readFile('outputs/mufy-consolidated-20261029/runtime-manifest.json','utf8'));
const check=JSON.parse(await readFile('outputs/mufy-consolidated-20261029/patch-check.json','utf8'));
const types=JSON.parse(await readFile('outputs/mufy-consolidated-20261029/patch-typecheck.json','utf8'));
if(validation.passed!==294||validation.failed!==0||validation.assertions!==1670||types.exitCode!==0||types.patchSha256!==manifest.patchSha256||check.patchSha256!==manifest.patchSha256||canvas.final.scrollWidth>390)throw Error('CURRENT_LOCAL_VERIFICATION_REQUIRED');
const observedAt=new Date().toISOString();
const proof={observedAt,localOnly:true,passed:294,failed:0,assertions:1670,patchSha256:manifest.patchSha256,patchFiles:28,exactPatchTypecheck:true,canvasEvidence:'final-acceptance/49/fixed-canvas-local-final-20261031.json',browserFollowup:{role21Visible:true,targetImageDimensionsPresent:5,targetImageCompleteFalse:5,imageAcceptance:false,followupSaveCompleted:false,reason:'Subsequent read/save timed out; existing saved source/TEST image qualification remains authoritative. Visible page screenshot showed correct role; no website outage inferred.'},browserRecovery:'Chrome id4 fresh same-browser tab restored normal TEST role page. Some subsequent DOM reads still time out; no cross-browser or security bypass.',agentNetMs:null,buildStarted:false,deployed:false,fullFidelityAccepted:false};
await writeFile(root+'/canvas-followup-checkpoint-20261031.json',JSON.stringify(proof,null,2));
for(const path of['qa-progress.json','continuation-next-20261031.json']){const data=await read(path);data.observedAt=observedAt;data.browserRecovery=proof.browserRecovery;data.fixedCanvasLocalFollowup={evidence:proof.canvasEvidence,runtimeDeployed:false};await writeFile(root+'/'+path,JSON.stringify(data,null,2));}
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt,kind:'canvas-followup-checkpoint-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,buildStarted:false,deployed:false})+'\n');
console.log(JSON.stringify(proof));
