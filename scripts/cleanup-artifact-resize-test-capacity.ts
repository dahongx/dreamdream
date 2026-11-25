/** Exact obsolete TEST rollback tags and unreferenced stages from a verified TEST build log. */
import { writeFile } from 'node:fs/promises';
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = 'sha256:feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8'
test "$(docker image inspect yearn-chat-app:before-tips-20261027163308183 --format '{{.Id}}')" = 'sha256:1c66d22c020167903ba558cbabd0297fbf1ff7a10fe54d0590a59d3ecad114d7'
test -f /root/mufy-transfer-archive-20261015/chat-skin-20261027142854583/source-before.tar
test -f /root/mufy-transfer-archive-20261015/chat-skin-20261027150557095/source-before.tar
test -f /root/mufy-transfer-archive-20261015/tips-20261027154208381/source-before.tar
test "$(docker image inspect yearn-chat-app:before-chat-skin-20261027142854583 --format '{{.Id}}')" = 'sha256:4bac71d19dd72abb911a2040d981773c762832deee96cf30fc1383197baf1ac5'
test "$(docker image inspect yearn-chat-app:before-chat-skin-20261027150557095 --format '{{.Id}}')" = 'sha256:478e86399ec0ef5faf205a2b4341c55b72dfc45d7bde64dba57500d6a9fe7407'
test "$(docker image inspect yearn-chat-app:before-tips-20261027154208381 --format '{{.Id}}')" = 'sha256:c371a6a19246680159af0602589c1853c52477c8ff2ed1c6415656e3f490601d'
used_images=$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')
for id in sha256:4bac71d19dd72abb911a2040d981773c762832deee96cf30fc1383197baf1ac5 sha256:478e86399ec0ef5faf205a2b4341c55b72dfc45d7bde64dba57500d6a9fe7407 sha256:c371a6a19246680159af0602589c1853c52477c8ff2ed1c6415656e3f490601d; do
  ! printf '%s\n' "$used_images" | grep -Fxq "$id"
done
df -Pk /
docker image rm --no-prune yearn-chat-app:before-chat-skin-20261027142854583 yearn-chat-app:before-chat-skin-20261027150557095 yearn-chat-app:before-tips-20261027153344501 yearn-chat-app:before-tips-20261027154208381
# Every candidate must occur in this completed 8091 build, be untagged,
# have no digest, and be unused by every container (including stopped ones).
# No ancestor traversal, force deletion, container removal or volume pruning.
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
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = 'sha256:feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8'
test "$(docker image inspect yearn-chat-app:before-tips-20261027163308183 --format '{{.Id}}')" = 'sha256:1c66d22c020167903ba558cbabd0297fbf1ff7a10fe54d0590a59d3ecad114d7'
df -Pk /`;
const startedAt=new Date().toISOString();
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [output,diagnostics,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-artifact-resize-20261028/cleanup.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),exitCode,output,diagnostics,productionTouched:false,databaseTouched:false,volumesTouched:false,recovery:'Old test images require rebuilding; source patch backups retained; current and latest rollback images preserved.'},null,2));
console.log(output);if(exitCode)throw Error('SCOPED_CLEANUP_FAILED');
