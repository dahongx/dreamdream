/** Remove two proven failed TEST install containers and the oldest unused TEST rollback. */
import {writeFile} from 'node:fs/promises';
const current='sha256:a480456affb834cc40543bd8a46f0793255362e9ec4bff2b1f3d1b074055e7ec';
const nextOld=process.argv.includes('--retire-next-old');
const failed=nextOld?[]:[{id:'bb7ca1eb37986caae890bf5268fc3ecf0951f34ca100c5dfadb62e31edece460',backup:'reply-pet-ready-20261028123856044'},{id:'4a5796bd7cd0cd997a9319df453703706178f3fd08018faebc8c3c7278d4dfa5',backup:'reply-pet-ready-20261028125059280'}];
const old=nextOld?'sha256:4382a4063e186224da354215374879cd8fa9126cf0296d4dad15eed87a50f848':'sha256:1cd27daa828b8ef7e4187caff5099b62adc19465bef8faa6870370b69857780d',tag=nextOld?'yearn-chat-app:before-artifact-resize-20261028120159100':'yearn-chat-app:before-artifact-resize-20261028114636972';
const startedAt=new Date().toISOString(),tick=performance.now();
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
${failed.map(f=>`test "$(docker inspect '${f.id}' --format '{{.State.Status}} {{.Image}} {{.Config.WorkingDir}} {{len .Mounts}}')" = 'exited sha256:87adf795a44ce698c83866ef621a6db869c11b46f8fc8161e1360fc7fc72cacf /app 0'
grep -q '${f.id.slice(0,12)}' /root/mufy-transfer-archive-20261015/${f.backup}/build.log
test "$(cat /root/mufy-transfer-archive-20261015/${f.backup}/status)" = BUILD_FAILED_SOURCE_RESTORED`).join('\n')}
test "$(docker image inspect '${tag}' --format '{{.Id}}')" = '${old}'
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
if printf '%s\\n' "$used" | grep -Fqx '${old}'; then echo ROLLBACK_IN_USE; exit 1; fi
test -s /root/mufy-transfer-archive-20261015/${nextOld?'reply-pet-owner-20261028120159100':'reply-pet-20261028114636972'}/source-before.tar
df -Pk /
${failed.length?'docker rm '+failed.map(f=>f.id).join(' '):'true'}
docker image rm '${tag}'
df -Pk /
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile(`outputs/mufy-reply-pet-drag-20261028/capacity-${nextOld?'next-old-rollback':'failed-installs'}.json`,JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',failed,old,tag,stdout,stderr,exitCode,runningAppChanged:false,atLeastTwoNewerRollbacksRetained:true,volumesChanged:0,databaseTouched:false,productionTouched:false,recovery:'Disposable install containers and retired image require rebuild; source and build logs retained'},null,2));
console.log(JSON.stringify({exitCode,stdout,stderr}));if(exitCode)process.exitCode=1;
