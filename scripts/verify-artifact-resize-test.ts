/** Read-only verification of this exact TEST release; never restarts or rolls back. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const isolated=process.argv.includes('--source-component-isolation');
const petOwner=process.argv.includes('--reply-pet-owner');
const petBootstrap=process.argv.includes('--reply-pet-bootstrap');
const petReady=process.argv.includes('--reply-pet-ready');
const petDrag=process.argv.includes('--reply-pet-drag');
const petFit=process.argv.includes('--reply-pet-fit');
const openingHeight=process.argv.includes('--opening-height');
const openingIsland=process.argv.includes('--opening-island');
const bilibili=process.argv.includes('--with-bilibili-player');
if(bilibili&&!openingHeight)throw Error('PLAYER_REQUIRES_OPENING_MODE');
const pet=process.argv.includes('--reply-pet')||petOwner||petBootstrap||petReady||petDrag||petFit||openingHeight;
const dir=openingIsland?'outputs/mufy-opening-island-20261028':bilibili?'outputs/mufy-opening-bilibili-20261028':openingHeight?'outputs/mufy-opening-height-20261028':petFit?'outputs/mufy-reply-pet-fit-20261028':petDrag?'outputs/mufy-reply-pet-drag-20261028':petReady?'outputs/mufy-reply-pet-ready-20261028':petBootstrap?'outputs/mufy-reply-pet-bootstrap-20261028':petOwner?'outputs/mufy-reply-pet-owner-20261028':pet?'outputs/mufy-reply-pet-20261028':process.argv.includes('--source-envelope-form-newlines')?'outputs/mufy-source-envelope-form-newlines-20261028':isolated?'outputs/mufy-source-component-isolation-20261028':'outputs/mufy-artifact-resize-20261028';
const verificationStartedAt=new Date().toISOString(),verificationTick=performance.now();
const op=JSON.parse(await readFile(`${dir}/operation.json`,'utf8'));
const manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));
if(!(pet?/^\/root\/mufy-transfer-archive-20261015\/reply-pet(?:-owner|-bootstrap|-ready|-drag|-fit|-opening-height)?-\d+$/:isolated?/^\/root\/mufy-transfer-archive-20261015\/source-component-isolation-\d+$/:/^\/root\/mufy-transfer-archive-20261015\/artifact-resize-\d+$/).test(op.backup))throw Error('INVALID_OPERATION');
const preservedRenderer=pet?manifest.preservedRenderer:isolated?JSON.parse(await readFile('outputs/mufy-artifact-resize-20261028/manifest.json','utf8')).entries:[];
const guards=[...manifest.entries,...manifest.preservedTips,...preservedRenderer].map((e:{path:string;after:string})=>{
 if(!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||! /^[a-f0-9]{64}$/.test(e.after))throw Error('INVALID_GUARD');
 return `test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.after}'`;
}).join('\n');
const dependencyGuards=manifest.cachedDeps?(['Dockerfile','package.json','bun.lock'] as const).map((path,i)=>{
 const hash=[manifest.cachedDeps.dockerfileHash,manifest.cachedDeps.packageHash,manifest.cachedDeps.lockHash][i];
 if(!/^[a-f0-9]{64}$/.test(hash))throw Error('INVALID_DEPENDENCY_GUARD');
 return `test "$(sha256sum ${path} | cut -d' ' -f1)" = '${hash}'`;
}).join('\n'):'';
const command=`set -eu
cd /root/projects/yearn-chat
release_status=$(cat ${op.backup}/status)
printf 'STATUS=%s\\n' "$release_status"
test "$release_status" = DEPLOYED || exit 0
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
${guards}
${dependencyGuards}
candidate=$(cat ${op.backup}/candidate-image.txt)
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = "$candidate"
printf 'IMAGE=%s\\n' "$candidate"
printf 'COMPLETED_EPOCH=%s\\n' "$(cat ${op.backup}/completed-epoch.txt)"`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'inherit'});
const output=await new Response(p.stdout).text();if(await p.exited)throw Error('RELEASE_VERIFY_FAILED');
if(!output.includes('STATUS=DEPLOYED')){console.log(output.trim());process.exit(0);}
const epoch=Number(output.match(/COMPLETED_EPOCH=(\d+)/)?.[1]);
if(!Number.isSafeInteger(epoch))throw Error('MISSING_COMPLETION_TIME');
const report={startedAt:op.startedAt,observedAt:new Date().toISOString(),serverCompletedAt:new Date(epoch*1000).toISOString(),elapsedMs:epoch*1000-Date.parse(op.startedAt),timingKind:'server-deployment-wall-time-not-agent-net',timingResolutionMs:1000,backup:op.backup,image:output.match(/IMAGE=(sha256:[a-f0-9]+)/)?.[1],sourceHashesVerified:true,tipsSourceHashesPreserved:true,deployed:true,visualAccepted:false,productionTouched:false,databaseTouched:false};
await writeFile(`${dir}/deployment.json`,JSON.stringify(report,null,2));
// Repeated read-only verification is not another six-minute deployment.
await appendFile('logs/mufy-profiles/full-20261013/next-batch-30-20261028/timing-runs.jsonl',JSON.stringify({step:pet?'verify-reply-pet-release':isolated?'verify-source-component-isolation-release':'verify-artifact-resize-test-release',kind:'remote-readonly-check',startedAt:verificationStartedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-verificationTick,deploymentBackup:op.backup,serverDeploymentElapsedMs:report.elapsedMs,agentNetMs:null})+'\n');
console.log(JSON.stringify(report));
