/** Exact superseded owner build stage, traced to archived TEST build log. */
import {writeFile} from 'node:fs/promises';
const targets=[{id:'sha256:a693fa0879309e7511b4a8b3435d262bdc302cfc31717bb2cd129cb30d39685c',archive:'reply-pet-owner-20261028120159100'},{id:'sha256:15f2a85b49fc4c8bfbd5fee9e3d96fa2daba8b014787daea8b0b450a330bdcec',archive:'mask-20261028111920957'},{id:'sha256:0d1eafeb0e5045c150bf18b1df564efb665cd89f787a0ae4193fff54985d3cd5',archive:'source-component-isolation-20261028092049467'},{id:'sha256:e957406c2050b290cb0ac0382f01d62ef735dd61922d4186b9f6faeca569747e',archive:'source-component-isolation-20261028090057747'}];
const startedAt=new Date().toISOString(),tick=performance.now();
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = 'sha256:affd28a7271d50ded189b441eba2c59e5444e2e1cefa19f30fa7e0b9143bb7f1'
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
${targets.map(({id,archive})=>`test "$(docker image inspect '${id}' --format '{{len .RepoTags}} {{.Config.WorkingDir}}')" = '0 /app'
grep -q '${id.slice(7,19)}' /root/mufy-transfer-archive-20261015/${archive}/build.log
test -s /root/mufy-transfer-archive-20261015/${archive}/source-before.tar
if printf '%s\\n' "$used" | grep -Fqx '${id}'; then exit 1; fi`).join('\n')}
df -Pk /
docker image rm ${targets.map(e=>e.id).join(' ')}
df -Pk /`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-opening-height-20261028/old-runtime-stage-cleanup.json',JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',targets,stdout,stderr,exitCode,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Rebuild disposable stage from retained source archive'},null,2));
console.log(JSON.stringify({stdout,stderr,exitCode}));if(exitCode)process.exitCode=1;
