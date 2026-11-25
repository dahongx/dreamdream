/** Read-only TEST release verification; never treat submission as deployment. */
import { readFile, writeFile } from 'node:fs/promises';
const dir=process.argv.includes('--default-family') ? 'outputs/chat-skin-upgrade/default-family' : process.argv.includes('--allowed-donor') ? 'outputs/chat-skin-upgrade/allowed-donor' : 'outputs/chat-skin-upgrade/generic-replay-exclusions';
const op=JSON.parse(await readFile(`${dir}/operation.json`,'utf8'));
const manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));
const tips=JSON.parse(await readFile('outputs/reply-suggestions-20261027/release/manifest.json','utf8'));
if(!/^\/root\/mufy-transfer-archive-20261015\/chat-skin-\d+$/.test(op.backup)||manifest.target!=='115.29.213.73:8091')throw Error('INVALID_TARGET');
if(manifest.entries.length!==1||manifest.entries[0].path!=='src/lib/styling/whitelist.ts'||!/^[a-f0-9]{64}$/.test(manifest.entries[0].after))throw Error('INVALID_MANIFEST');
const expected=manifest.entries[0].after;
const tipsGuards=tips.entries.map((e:{path:string;after:string})=>{
 if(!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||!/^[a-f0-9]{64}$/.test(e.after))throw Error('INVALID_TIPS_MANIFEST');
 return `test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.after}'`;
}).join('\n');
const command=`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
grep -qx CONTROL_LAYOUT_DEPLOYED_8091 ${op.backup}/release.log
built=$(cat ${op.backup}/built-image.txt)
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = "$built"
test "$(docker image inspect --format '{{.Id}}' yearn-chat-app:latest)" = "$built"
test "$(sha256sum src/lib/styling/whitelist.ts | cut -d' ' -f1)" = '${expected}'
test "$(docker exec yearn-chat-app-1 sha256sum /app/src/lib/styling/whitelist.ts | cut -d' ' -f1)" = '${expected}'
${tipsGuards}
printf 'IMAGE=%s\n' "$built"
printf 'FINISHED_EPOCH=%s\n' "$(stat -c %Y ${op.backup}/release.log)"
echo VERIFIED_8091`;
const p=Bun.spawn(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'inherit'});
const output=await new Response(p.stdout).text();
if(await p.exited||!output.includes('VERIFIED_8091'))throw Error('NOT_VERIFIED; existing deployment report left unchanged');
const completedEpoch=Number(output.match(/FINISHED_EPOCH=(\d+)/)?.[1]);
const report={startedAt:op.startedAt,observedAt:new Date().toISOString(),serverCompletedAt:new Date(completedEpoch*1000).toISOString(),elapsedMs:completedEpoch*1000-Date.parse(op.startedAt),timingKind:'server-deployment-wall-time-not-agent-net',timingResolutionMs:1000,backup:op.backup,image:output.match(/IMAGE=(sha256:[a-f0-9]+)/)?.[1],sha256:expected,deployed:true,tipsSourceHashesPreserved:true,visualAccepted:false,productionTouched:false,databaseTouched:false};
await writeFile(`${dir}/deployment.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
