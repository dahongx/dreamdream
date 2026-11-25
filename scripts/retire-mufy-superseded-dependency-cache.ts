/** Exact old TEST cache only, after verified replacement cache has been pinned. */
import {readFile,writeFile} from 'node:fs/promises';
const dir='outputs/mufy-opening-height-20261028',m=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));
const runtime='sha256:affd28a7271d50ded189b441eba2c59e5444e2e1cefa19f30fa7e0b9143bb7f1',old='sha256:ef8463766f30484280f7b075ef8cd1e54d18dd229a43352d1e7084f050e62d2e',stage='sha256:2e785c9349badb922662627d22bdb61f45cdf21f7d07dc247643fec95af44847';
if(m.cachedDeps.image!==runtime||m.cachedDeps.tag!=='yearn-chat-app:locked-deps-cache-20261028-affd2')throw Error('NEW_CACHE_NOT_PREPARED');
const tags=['before-artifact-resize-20261028123856044','before-artifact-resize-20261028125059280','before-artifact-resize-20261028130538933','locked-deps-cache-20261028-ef846'].map(t=>'yearn-chat-app:'+t);
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${runtime}'
test "$(docker image inspect '${m.cachedDeps.tag}' --format '{{.Id}}')" = '${runtime}'
docker image inspect sha256:a3e8d0f00530141d2f9e7f881bbe28fc0512d96c0b09511118e7a6ecdb7dad2e >/dev/null
test "$(docker image inspect '${old}' --format '{{len .RepoTags}} {{.Config.WorkingDir}}')" = '4 /app'
${tags.map(t=>`test "$(docker image inspect '${t}' --format '{{.Id}}')" = '${old}'`).join('\n')}
test "$(docker image inspect '${stage}' --format '{{len .RepoTags}} {{.Config.WorkingDir}}')" = '0 /app'
grep -q 2e785c9349ba /root/mufy-transfer-archive-20261015/reply-pet-ready-20261028130538933/build.log
test -s /root/mufy-transfer-archive-20261015/reply-pet-ready-20261028130538933/source-before.tar
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
if printf '%s\\n' "$used" | grep -Fqx '${old}'; then exit 1; fi
if printf '%s\\n' "$used" | grep -Fqx '${stage}'; then exit 1; fi
df -Pk /
docker image rm ${tags.join(' ')} '${stage}'
df -Pk /`;
const tick=performance.now(),p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile(`${dir}/superseded-cache-cleanup.json`,JSON.stringify({observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',old,stage,tags,replacementCache:runtime,stdout,stderr,exitCode,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Rebuild retired cache from retained source/lock; current runtime, nearest rollback and verified replacement cache preserved'},null,2));console.log(JSON.stringify({stdout,stderr,exitCode}));if(exitCode)process.exitCode=1;
