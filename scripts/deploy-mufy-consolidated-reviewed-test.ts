/** One human-authorized 8091 runtime update. No database, volume, card or production operation. */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { requireTestDiskCapacity } from './mufy-test-disk-preflight';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const dir='outputs/mufy-consolidated-20261029';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const startedAt=new Date().toISOString(),tick=performance.now(),stamp=startedAt.replace(/\D/g,'');
const backup=`/root/mufy-transfer-archive-20261015/consolidated-reviewed-${stamp}`;
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[]){const t=performance.now();const p=Bun.spawn(args,{stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error(`COMMAND_FAILED_${args[0]}_${code}: ${err.slice(0,160)}`);return out.trim();}
if(!process.argv.includes('--commit-test'))throw Error('EXPLICIT_COMMIT_TEST_REQUIRED');
const manifest=JSON.parse(await readFile(dir+'/runtime-manifest.json','utf8'));
const patch=await readFile(dir+'/runtime.patch');
if(manifest.target!=='115.29.213.73:8091'||manifest.patchSha256!=='fd4863133633d78f1d4fcf1949d2d66fbd04d1159693a8520c2b01a90b5a0e1d'||sha(patch)!==manifest.patchSha256||manifest.entries.length!==28)throw Error('EXACT_REVIEWED_PATCH_REQUIRED');
const entries=manifest.entries as {path:string;before:string|null;after:string}[];
for(const e of entries){if(!/^src\/[\w/.-]+$/.test(e.path)||e.path.includes('..')||sha(await readFile(dir+'/patch/'+e.path))!==e.after)throw Error('UNSAFE_OR_CHANGED_FILE');}
for(const name of ['patch-check.json','patch-typecheck.json']){const p=JSON.parse(await readFile(dir+'/'+name,'utf8'));if(p.patchSha256!==manifest.patchSha256||(name==='patch-check.json'?!p.allResultHashesMatch:p.exitCode!==0))throw Error('EXACT_PATCH_VALIDATION_REQUIRED');}
const auth={observedAt:startedAt,requested:true,answerReceived:true,userAnswer:'允许',authorizedToStartBuild:true,scope:'One controlled update of reviewed 8091 runtime and subsequent integration QA; no production, database, card visibility or player sandbox expansion.',patchSha256:manifest.patchSha256,fullFidelityAccepted:false};
await writeFile(root+'/controlled-test-update-phase-pending-20261101.json',JSON.stringify(auth,null,2));
await writeFile(root+'/controlled-test-update-authorized-20261101.json',JSON.stringify(auth,null,2));
await requireTestDiskCapacity(async(args)=>run(args),ssh);
if(await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'])!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const archive=dir+'/reviewed-runtime.tar';
await run(['tar','-C',dir+'/patch','-cf',archive,...entries.map(e=>e.path)]);
const archiveHash=sha(await readFile(archive));
const checks=entries.map(e=>e.before?`test "$(sha256sum '${e.path}' | cut -d ' ' -f1)" = '${e.before}'`:`test ! -e '${e.path}'`).join('\n');
const afterChecks=entries.map(e=>`test "$(sha256sum '${e.path}' | cut -d ' ' -f1)" = '${e.after}'`).join('\n');
const modified=entries.filter(e=>e.before).map(e=>`'${e.path}'`).join(' ');
// Only exact new paths established absent under the release lock may be removed on rollback.
const additions=entries.filter(e=>!e.before).map(e=>`'${e.path}'`).join(' ');
const script=`#!/bin/bash
set -euo pipefail
umask 077
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9 || { echo RELEASE_LOCK_BUSY; exit 73; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
container=$(docker ps --filter publish=8091 --no-trunc --format '{{.ID}}')
test "$(docker inspect "$container" --format '{{.Image}}')" = '${manifest.basedOnImage}'
test "$(docker inspect "$container" --format '{{.State.Running}}')" = true
df -Pk / /root/projects/yearn-chat /var/lib/docker | awk 'NR>1 {gsub(/%/,"",$5); if($4<20971520 || $5>80) exit 1}'
${checks}
test "$(sha256sum '${backup}/patch.tar' | cut -d ' ' -f1)" = '${archiveHash}'
git apply --check '${backup}/runtime.patch'
tar -cf '${backup}/source-before.tar' ${modified}
imageRef=$(docker inspect "$container" --format '{{.Config.Image}}')
test "$imageRef" = yearn-chat-app
docker tag '${manifest.basedOnImage}' 'yearn-chat-app:consolidated-before-${stamp}'
printf '%s\n' SOURCE_BACKED_UP > '${backup}/status.txt'
changed=0
switched=0
success=0
finish() {
 code=$?
 if [ "$success" != 1 ] && [ "$changed" = 1 ]; then
  tar -xf '${backup}/source-before.tar'
  rm -f -- ${additions}
  docker tag '${manifest.basedOnImage}' yearn-chat-app
  if [ "$switched" = 1 ]; then docker compose up -d --no-deps --no-build app >>'${backup}/switch.log' 2>&1 || true; fi
  printf '%s\n' FAILED_SOURCE_RESTORED > '${backup}/status.txt'
 fi
 exit "$code"
}
trap finish EXIT
changed=1
tar -xf '${backup}/patch.tar'
${afterChecks}
printf '%s\n' BUILDING > '${backup}/status.txt'
docker compose build app > '${backup}/build.log' 2>&1
printf '%s\n' BUILT > '${backup}/status.txt'
${afterChecks}
test "$(docker inspect "$container" --format '{{.Image}}')" = '${manifest.basedOnImage}'
switched=1
docker compose up -d --no-deps --no-build app > '${backup}/switch.log' 2>&1
current=$(docker compose ps -q app)
test -n "$current"
test "$(docker inspect "$current" --format '{{.State.Running}}')" = true
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
docker inspect "$current" --format '{{.Id}}|{{.Image}}|{{.State.Running}}' > '${backup}/runtime-after.txt'
printf '%s\n' DEPLOYED_PENDING_BROWSER_QA > '${backup}/status.txt'
success=1
cat '${backup}/status.txt' '${backup}/runtime-after.txt'
`;
await writeFile(dir+'/controlled-release.sh',script);
const report:{[key:string]:unknown}={startedAt,target:manifest.target,backup,patchSha256:manifest.patchSha256,files:entries.length,agentNetMs:null,databaseOperations:0,productionWrites:0,volumeOperations:0,fullFidelityAccepted:false};
await writeFile(root+'/controlled-runtime-release-20261101.json',JSON.stringify({...report,status:'preparing'},null,2));
try{
 await run([...ssh,`umask 077; mkdir -p '${backup}'`]);
 await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run(['scp','-q',dir+'/runtime.patch',dir+'/controlled-release.sh',`root@115.29.213.73:${backup}/`]);
 report.status='running';await writeFile(root+'/controlled-runtime-release-20261101.json',JSON.stringify(report,null,2));
 report.remoteResult=await run([...ssh,`bash '${backup}/controlled-release.sh'`]);
 report.status='deployed-pending-browser-qa';
}catch(error){report.status='failed-or-connection-interrupted-check-remote-status-before-retry';report.error=String(error);process.exitCode=1;}
report.finishedAt=new Date().toISOString();report.elapsedMs=performance.now()-tick;
await writeFile(root+'/controlled-runtime-release-20261101.json',JSON.stringify(report,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({kind:'controlled-test-release-process-wall',...report})+'\n');
console.log(JSON.stringify(report));
