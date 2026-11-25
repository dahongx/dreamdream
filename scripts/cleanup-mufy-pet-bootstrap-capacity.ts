/** Three explicitly audited TEST artifacts. No prune, force or volume changes. */
import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),tick=performance.now();
const current='sha256:df707a4562e4765815bb603872fc54424be2bcb226108fe0d344d824d6f542d2';
const stages=[{id:'sha256:932af883c42f43251ccf6799a5f6ce7091f18124cd178d6686344cc3848eab37',log:'reply-pet-owner-20261028120159100'},{id:'sha256:35f9a2666218147590ed533fdd9aad80a35301904bcc4cdc233dfbed0eddbed3',log:'mask-20261028111920957'}];
const old='sha256:9c161092cc7497f43a131be453c69e12ba2bea7164cf7fac7dc739c8ab491853';
const tags=['yearn-chat-app:before-mask-20261028111453760','yearn-chat-app:before-mask-20261028111920957'];
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
for id in ${[...stages.map(s=>s.id),old].join(' ')}; do
 if printf '%s\\n' "$used" | grep -Fqx "$id"; then echo ARTIFACT_IN_USE; exit 1; fi
done
${stages.map(s=>`test "$(docker image inspect '${s.id}' --format '{{len .RepoTags}}')" = 0
test "$(docker image inspect '${s.id}' --format '{{.Config.WorkingDir}}')" = /app
grep -q '${s.id.slice(7,19)}' /root/mufy-transfer-archive-20261015/${s.log}/build.log`).join('\n')}
for tag in ${tags.join(' ')}; do test "$(docker image inspect "$tag" --format '{{.Id}}')" = '${old}'; done
test -s /root/mufy-transfer-archive-20261015/mask-20261028111920957/source-before.tar
df -Pk /
docker image rm ${stages.map(s=>s.id).join(' ')}
docker image rm ${tags.join(' ')}
df -Pk /
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-reply-pet-bootstrap-20261028/capacity-cleanup.json',JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-operation-wall-not-agent-net',stages,old,tags,stdout,stderr,exitCode,currentAndTwoRecentRollbacksRetained:true,productionTouched:false,databaseTouched:false,volumeChanges:0,recovery:'Removed TEST image artifacts require rebuild; source archives remain'},null,2));
console.log(JSON.stringify({exitCode,stdout,stderr}));if(exitCode)process.exitCode=1;
