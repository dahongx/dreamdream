/** Exact completed TEST build stages only; never prune containers or volumes. */
import {writeFile,mkdir} from 'node:fs/promises';
const failed=process.argv.includes('--failed-isolation-attempt');
const completed=process.argv.includes('--completed-isolation-attempt');
if(failed&&completed)throw Error('ONE_EXACT_CLEANUP_SCOPE_REQUIRED');
const archive=failed?'source-component-isolation-20261028084942851':completed?'source-component-isolation-20261028090057747':'artifact-resize-20261028041714131';
const expectedCurrent=completed?'sha256:ce8b71d5c55a55966ed255c388bf9519183bf78358e3fcba5b8d050f3b61278b':'sha256:1603732cc2492ebeae2e2050991081299e21fb340c8a6004c95ab023218d3eaa';
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = '${expectedCurrent}'
test "$(cat /root/mufy-transfer-archive-20261015/${archive}/status)" = ${failed?'BUILD_FAILED_SOURCE_RESTORED':'DEPLOYED'}
${failed?String.raw`test "$(docker inspect f6933e2c28897a7bc21a2aee8267da080b68d67e027fa4ea75d80d4552e25cf0 --format '{{.State.Status}}')" = exited
test "$(docker inspect f6933e2c28897a7bc21a2aee8267da080b68d67e027fa4ea75d80d4552e25cf0 --format '{{json .Config.Cmd}}')" = '["/bin/sh","-c","bun run build"]'
docker rm f6933e2c28897a7bc21a2aee8267da080b68d67e027fa4ea75d80d4552e25cf0`:''}
used_images=$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')
df -Pk /
for short in $(sed -nE 's/^ ---> ([0-9a-f]+)$/\1/p' /root/mufy-transfer-archive-20261015/${archive}/build.log | tac | awk '!seen[$0]++'); do
 meta=$(docker image inspect "$short" --format '{{.Id}}|{{json .RepoTags}}|{{json .RepoDigests}}' 2>/dev/null) || continue
 id=$(printf '%s' "$meta" | cut -d'|' -f1)
 tags=$(printf '%s' "$meta" | cut -d'|' -f2)
 digests=$(printf '%s' "$meta" | cut -d'|' -f3)
 [ "$tags" = '[]' ] && [ "$digests" = '[]' ] || continue
 ! printf '%s\n' "$used_images" | grep -Fxq "$id" || continue
 [ -z "$(docker ps -aq --filter ancestor="$id")" ] || continue
 docker image rm --no-prune "$id" || true
done
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = '${expectedCurrent}'
df -Pk /`;
const startedAt=new Date().toISOString();
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [output,diagnostics,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await mkdir('outputs/mufy-source-component-isolation-20261028',{recursive:true});
await writeFile(`outputs/mufy-source-component-isolation-20261028/cleanup${failed?'-failed-attempt':completed?'-completed-attempt':''}.json`,JSON.stringify({startedAt,finishedAt:new Date().toISOString(),exitCode,output,diagnostics,volumesTouched:false,containersRemoved:failed?1:0,productionTouched:false,databaseTouched:false,recovery:'Deleted unreferenced intermediate build stages can only be rebuilt; tagged rollback images retained.'},null,2));
console.log(output);if(exitCode)throw Error('SCOPED_CLEANUP_FAILED');
