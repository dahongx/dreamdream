/** Retire one unused superseded TEST rollback, retaining current and nearest. */
import {writeFile} from 'node:fs/promises';
const id='sha256:a480456affb834cc40543bd8a46f0793255362e9ec4bff2b1f3d1b074055e7ec';
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = 'sha256:affd28a7271d50ded189b441eba2c59e5444e2e1cefa19f30fa7e0b9143bb7f1'
test "$(docker image inspect '${id}' --format '{{join .RepoTags ","}}')" = 'yearn-chat-app:before-artifact-resize-20261028132738952'
test -s /root/mufy-transfer-archive-20261015/reply-pet-drag-20261028132738952/source-before.tar
docker image inspect sha256:a3e8d0f00530141d2f9e7f881bbe28fc0512d96c0b09511118e7a6ecdb7dad2e >/dev/null
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
if printf '%s\\n' "$used" | grep -Fqx '${id}'; then exit 1; fi
df -Pk /
docker image rm yearn-chat-app:before-artifact-resize-20261028132738952
df -Pk /`;
const tick=performance.now(),p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-opening-height-20261028/old-ready-image-cleanup.json',JSON.stringify({observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',id,stdout,stderr,exitCode,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Rebuild superseded rollback using retained source archives; current and nearest runtime preserved'},null,2));console.log(JSON.stringify({stdout,stderr,exitCode}));if(exitCode)process.exitCode=1;
