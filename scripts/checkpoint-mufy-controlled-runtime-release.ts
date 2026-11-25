/** Merge actual release facts without discarding per-card evidence or old blocked history. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const release=JSON.parse(await readFile(root+'/controlled-runtime-release-20261101.json','utf8'));
const auth=JSON.parse(await readFile(root+'/controlled-test-update-authorized-20261101.json','utf8'));
if(!auth.answerReceived||auth.userAnswer!=='允许'||!auth.authorizedToStartBuild||release.patchSha256!==auth.patchSha256)throw Error('TRUSTED_RELEASE_AUTHORIZATION_RECORD_REQUIRED');
const observedAt=new Date().toISOString();
for(const name of ['qa-progress.json','continuation-next-20261031.json']){
 const data=JSON.parse(await readFile(root+'/'+name,'utf8'));
 data.observedAt=observedAt;
 data.controlledRuntimeUpdate={authorizationEvidence:'controlled-test-update-authorized-20261101.json',releaseEvidence:'controlled-runtime-release-20261101.json',status:release.status,patchSha256:release.patchSha256,backup:release.backup,fullFidelityAccepted:false,officialPlayerExpansionApproved:false};
 if(data.phaseBoundaryAudit)data.phaseBoundaryAudit.controlledTestUpdateDirectionPending=false;
 if(release.status==='running'||release.status==='deployed-pending-browser-qa')data.buildStarted=true;
 data.deployed=release.status==='deployed-pending-browser-qa';
 await writeFile(root+'/'+name,JSON.stringify(data,null,2));
}
const blocked=JSON.parse(await readFile(root+'/controlled-update-blocked-audit-20261101.json','utf8'));
if(!blocked.resolvedByUserAuthorization){blocked.resolvedByUserAuthorization={observedAt,evidence:'controlled-test-update-authorized-20261101.json',scope:'Controlled TEST runtime update only. Historical blocked audit is not reusable after this human resumption.'};await writeFile(root+'/controlled-update-blocked-audit-20261101.json',JSON.stringify(blocked,null,2));}
const runbookPath=root+'/RUNBOOK.txt',before=await readFile(runbookPath,'utf8');
if(!before.startsWith('CURRENT CONTROLLED UPDATE 20261101'))await writeFile(runbookPath,`CURRENT CONTROLLED UPDATE 20261101\nUser explicitly answered 允许 to one reviewed 8091 runtime update. See controlled-test-update-authorized-20261101.json and controlled-runtime-release-20261101.json for actual progress. Earlier pending/blocked text below is historical and superseded only for this scoped authority. Bilibili same-origin remains NOT approved. No production/DB/volume/card-visibility operations. Full-card acceptance remains pending real integration; do not count deployment as acceptance.\n\n`+before);
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt,kind:'release-checkpoint-merge-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,status:release.status})+'\n');
console.log(JSON.stringify({status:release.status,authorizationRecorded:true,fullFidelityAccepted:false}));
