/** Retire one superseded TEST rollback image; keep current and nearest rollback. */
import {writeFile} from 'node:fs/promises';
const current='sha256:a3e8d0f00530141d2f9e7f881bbe28fc0512d96c0b09511118e7a6ecdb7dad2e';
const retired='sha256:df707a4562e4765815bb603872fc54424be2bcb226108fe0d344d824d6f542d2';
const tick=performance.now(),startedAt=new Date().toISOString();
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
test "$(docker image inspect '${retired}' --format '{{.Config.WorkingDir}} {{join .RepoTags ","}}')" = '/app yearn-chat-app:before-artifact-resize-20261028121835645'
test -s /root/mufy-transfer-archive-20261015/reply-pet-bootstrap-20261028121835645/source-before.tar
docker image inspect sha256:a480456affb834cc40543bd8a46f0793255362e9ec4bff2b1f3d1b074055e7ec >/dev/null
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
if printf '%s\\n' "$used" | grep -Fqx '${retired}'; then exit 1; fi
df -Pk /
docker image rm yearn-chat-app:before-artifact-resize-20261028121835645
df -Pk /
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-reply-pet-fit-20261028/capacity-cleanup.json',JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',retired,stdout,stderr,exitCode,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Rebuild superseded rollback from retained source archive; current and nearest rollback preserved'},null,2));
console.log(JSON.stringify({stdout,stderr,exitCode}));if(exitCode)process.exitCode=1;
