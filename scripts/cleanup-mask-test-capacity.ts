import { mkdir, writeFile } from 'node:fs/promises';
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect yearn-chat-app-1 --format '{{.Image}}')" = 'sha256:9c161092cc7497f43a131be453c69e12ba2bea7164cf7fac7dc739c8ab491853'
used_images=$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')
df -Pk /
for log in /root/mufy-transfer-archive-20261015/tips-20261027154208381/build.log /root/mufy-transfer-archive-20261015/artifact-resize-20261028040844517/build.log /root/mufy-transfer-archive-20261015/source-component-isolation-20261028092049467/build.log; do
  for short in $(sed -nE 's/^ ---> ([0-9a-f]+)$/\1/p' "$log" | tac | awk '!seen[$0]++'); do
    meta=$(docker image inspect "$short" --format '{{.Id}}|{{json .RepoTags}}|{{json .RepoDigests}}' 2>/dev/null) || continue
    id=$(printf '%s' "$meta" | cut -d'|' -f1)
    tags=$(printf '%s' "$meta" | cut -d'|' -f2)
    digests=$(printf '%s' "$meta" | cut -d'|' -f3)
    [ "$tags" = '[]' ] && [ "$digests" = '[]' ] || continue
    ! printf '%s\n' "$used_images" | grep -Fxq "$id" || continue
    [ -z "$(docker ps -aq --filter ancestor="$id")" ] || continue
    docker image rm --no-prune "$id" || true
  done
done
docker image inspect yearn-chat-app:latest yearn-chat-app:before-artifact-resize-20261028092049467 yearn-chat-app:before-artifact-resize-20261028084942851 --format '{{.Id}}'
df -Pk /`;
await mkdir('outputs/mask-release-20261028',{recursive:true});
const p=Bun.spawn(['ssh','-o','BatchMode=yes','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [output,errors,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mask-release-20261028/cleanup.json',JSON.stringify({at:new Date().toISOString(),output,errors,code,databaseTouched:false,productionTouched:false},null,2));
console.log(output);if(code)throw Error(errors);
