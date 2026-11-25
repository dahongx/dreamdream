/** Exact obsolete TEST rollback only. No prune, force, containers or volumes. */
import {writeFile,mkdir} from 'node:fs/promises';
const startedAt=new Date().toISOString(),tick=performance.now();
const owner=process.argv.includes('--reply-pet-owner');
const maskStage=process.argv.includes('--mask-build-stage');
const buildStage=process.argv.includes('--build-stage')||maskStage;
if(buildStage&&!owner)throw Error('BUILD_STAGE_REQUIRES_CURRENT_OWNER_BASELINE');
const old=maskStage?'sha256:32c575fe9fc68095fa2203c244433d44fc56c015fc8e52b063e81dd4df01cd37':buildStage?'sha256:a374aab32e9851275f58bcc83d7a9087fe5248cb806fc5ea48f02f5b4561f779':owner?'sha256:ce8b71d5c55a55966ed255c388bf9519183bf78358e3fcba5b8d050f3b61278b':'sha256:1603732cc2492ebeae2e2050991081299e21fb340c8a6004c95ab023218d3eaa';
const current=owner?'sha256:4382a4063e186224da354215374879cd8fa9126cf0296d4dad15eed87a50f848':'sha256:1cd27daa828b8ef7e4187caff5099b62adc19465bef8faa6870370b69857780d';
const tags=owner?['yearn-chat-app:before-artifact-resize-20261028092049467']:['yearn-chat-app:before-artifact-resize-20261028084942851','yearn-chat-app:before-artifact-resize-20261028090057747'];
const targets=buildStage?[old]:tags;
const execute=process.argv.includes('--execute');
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
test -s /root/mufy-transfer-archive-20261015/source-component-isolation-20261028092049467/source-before.tar
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
if printf '%s\\n' "$used" | grep -Fqx '${old}'; then echo OBSOLETE_IMAGE_STILL_USED; exit 1; fi
${buildStage?`test "$(docker image inspect '${old}' --format '{{len .RepoTags}}')" = 0
test "$(docker image inspect '${old}' --format '{{.Config.WorkingDir}}')" = /app
grep -q ${maskStage?'32c575fe9fc6 /root/mufy-transfer-archive-20261015/mask-20261028111920957/build.log':'a374aab32e98 /root/mufy-transfer-archive-20261015/reply-pet-20261028114636972/build.log'}`:''}
for tag in ${buildStage?'':tags.join(' ')}; do
 test "$(docker image inspect "$tag" --format '{{.Id}}')" = '${old}'
done
df -Pk /
${execute?'docker image rm '+targets.join(' '):'echo READ_ONLY_PLAN'}
df -Pk /
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
const dir=owner?'outputs/mufy-reply-pet-owner-20261028':'outputs/mufy-reply-pet-20261028';
await mkdir(dir,{recursive:true});
await writeFile(`${dir}/capacity-${execute?'cleanup':'plan'}${maskStage?'-mask-stage':buildStage?'-build-stage':''}.json`,JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-operation-wall-time-not-agent-net',old,current,execute,stdout,stderr,exitCode,productionTouched:false,databaseTouched:false,volumeChanges:0,recovery:'Rebuild older image from retained source archives; current and two newer rollbacks retained'},null,2));
console.log(JSON.stringify({execute,exitCode,stdout,stderr}));if(exitCode)process.exitCode=1;
