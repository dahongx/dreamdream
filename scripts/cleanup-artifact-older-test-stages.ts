/** Only untagged stages explicitly listed in the previous completed TEST build. */
import {writeFile} from 'node:fs/promises';
const earlyOnly=process.argv.includes('--early-only');
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = 'sha256:feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8'
test "$(docker image inspect yearn-chat-app:before-tips-20261027163308183 --format '{{.Id}}')" = 'sha256:1c66d22c020167903ba558cbabd0297fbf1ff7a10fe54d0590a59d3ecad114d7'
used_images=$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')
df -Pk /
${earlyOnly?'':String.raw`test "$(cat /root/mufy-transfer-archive-20261015/artifact-resize-20261028040844517/status)" = BUILD_FAILED_SOURCE_RESTORED
test "$(docker inspect 9ea1a292ebb6d0a8c25085e84ad8799b8cf37df70d1ca3063e3a063ed8be5943 --format '{{.State.Status}}')" = exited
test "$(docker inspect 9ea1a292ebb6d0a8c25085e84ad8799b8cf37df70d1ca3063e3a063ed8be5943 --format '{{json .Config.Cmd}}')" = '["/bin/sh","-c","bun run build"]'
docker rm 9ea1a292ebb6d0a8c25085e84ad8799b8cf37df70d1ca3063e3a063ed8be5943`}
for short in $(sed -nE 's/^ ---> ([0-9a-f]+)$/\1/p' /root/mufy-transfer-archive-20261015/${earlyOnly?'chat-skin-20261027134855473':'chat-skin-20261027142854583'}/build.log | tac | awk '!seen[$0]++'); do
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
df -Pk /`;
const startedAt=new Date().toISOString();
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [output,diagnostics,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile(`outputs/mufy-artifact-resize-20261028/${earlyOnly?'cleanup-earlier-stages':'cleanup-cancelled-and-older-stages'}.json`,JSON.stringify({startedAt,finishedAt:new Date().toISOString(),output,diagnostics,exitCode,productionTouched:false,databaseTouched:false,volumesTouched:false},null,2));
console.log(output);if(exitCode)throw Error('SCOPED_CLEANUP_FAILED');
