/** Two now-obsolete TEST-only rollback images; preserve current and nearest rollback. */
import {mkdir,writeFile} from 'node:fs/promises';
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect yearn-chat-app-1 --format '{{.Image}}')" = 'sha256:ce8b71d5c55a55966ed255c388bf9519183bf78358e3fcba5b8d050f3b61278b'
test -f /root/mufy-transfer-archive-20261015/tips-20261027163308183/source-before.tar
test -f /root/mufy-transfer-archive-20261015/artifact-resize-20261028041714131/source-before.tar
${process.argv.includes('--remaining-old-build-stages')?'':String.raw`for id in sha256:feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8 sha256:1c66d22c020167903ba558cbabd0297fbf1ff7a10fe54d0590a59d3ecad114d7; do
 [ -z "$(docker ps -aq --filter ancestor="$id")" ]
done
test "$(docker image inspect yearn-chat-app:before-artifact-resize-20261028040844517 --format '{{.Id}}')" = 'sha256:feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8'
test "$(docker image inspect yearn-chat-app:before-artifact-resize-20261028041714131 --format '{{.Id}}')" = 'sha256:feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8'
for tag in before-tips-20261027161154269 before-tips-20261027161843869 before-tips-20261027163308183; do
 test "$(docker image inspect yearn-chat-app:$tag --format '{{.Id}}')" = 'sha256:1c66d22c020167903ba558cbabd0297fbf1ff7a10fe54d0590a59d3ecad114d7'
done
df -Pk /
docker image rm --no-prune yearn-chat-app:before-artifact-resize-20261028040844517 yearn-chat-app:before-artifact-resize-20261028041714131 yearn-chat-app:before-tips-20261027161154269 yearn-chat-app:before-tips-20261027161843869 yearn-chat-app:before-tips-20261027163308183`}
test "$(grep 'Successfully built' /root/mufy-transfer-archive-20261015/tips-20261027163308183/build.log | tail -n 1)" = 'Successfully built feeb804dddfe'
used_images=$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')
for short in $(sed -nE 's/^ ---> ([0-9a-f]+)$/\1/p' /root/mufy-transfer-archive-20261015/tips-20261027163308183/build.log | tac | awk '!seen[$0]++'); do
 meta=$(docker image inspect "$short" --format '{{.Id}}|{{json .RepoTags}}|{{json .RepoDigests}}' 2>/dev/null) || continue
 id=$(printf '%s' "$meta" | cut -d'|' -f1)
 tags=$(printf '%s' "$meta" | cut -d'|' -f2)
 digests=$(printf '%s' "$meta" | cut -d'|' -f3)
 [ "$tags" = '[]' ] && [ "$digests" = '[]' ] || continue
 ! printf '%s\n' "$used_images" | grep -Fxq "$id" || continue
 [ -z "$(docker ps -aq --filter ancestor="$id")" ] || continue
 docker image rm --no-prune "$id" || true
done
test "$(docker image inspect yearn-chat-app:before-artifact-resize-20261028090057747 --format '{{.Id}}')" = 'sha256:1603732cc2492ebeae2e2050991081299e21fb340c8a6004c95ab023218d3eaa'
test "$(docker inspect yearn-chat-app-1 --format '{{.Image}}')" = 'sha256:ce8b71d5c55a55966ed255c388bf9519183bf78358e3fcba5b8d050f3b61278b'
df -Pk /`;
const startedAt=new Date().toISOString(),p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [output,diagnostics,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await mkdir('outputs/mufy-source-envelope-form-newlines-20261028',{recursive:true});
await writeFile(`outputs/mufy-source-envelope-form-newlines-20261028/cleanup-${process.argv.includes('--remaining-old-build-stages')?'old-build-stages':'old-test-rollbacks'}.json`,JSON.stringify({startedAt,observedAt:new Date().toISOString(),output,diagnostics,exitCode,productionTouched:false,databaseTouched:false,volumesTouched:false,recovery:'Removed obsolete TEST artifacts; source archives retained for rebuild. Current and nearest rollback image preserved.'},null,2));
console.log(output);if(exitCode)throw Error('SCOPED_CLEANUP_FAILED');
