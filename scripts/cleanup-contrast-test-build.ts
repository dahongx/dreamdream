/** Exact unused TEST stage heads identified in the coordinated build logs. */
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = 'sha256:478e86399ec0ef5faf205a2b4341c55b72dfc45d7bde64dba57500d6a9fe7407'
# Preserve reusable TEST dependency and base metadata before removing exact
# unused stage layers audited against chat-skin-20261027142854583/build.log.
docker image tag a76b7c013c54 yearn-chat-test-cache:deps-20261027
docker image tag d8d1decd435a yearn-chat-test-cache:workdir-20261027
for start in f644db6f1a35 a9ea34b0d469 2f3335b5f87c 79ea40a839ee c768c490f15c 347e691ebc6e ee95e7a7bd27 07f01ad5718b e51a3b4ba56d 4fc09ce7ba95 ff6a1e1c2fea 6918fdc76dde e69709756f1c 59799d132dd3 48137bb8a7f9 8d18a6bc753d 27deea500d3f 8faecc4911a3 eabc6bf84258 3169c4640b26; do
 id=$(docker image inspect "$start" --format '{{.Id}}')
 count=0
 # Do not walk shared parents: retaining their metadata preserves build cache.
 # Any additional parent must be inspected as a separate exact target first.
 while [ -n "$id" ] && [ "$count" -lt 1 ]; do
  meta=$(docker image inspect "$id" --format '{{json .RepoTags}}|{{json .RepoDigests}}|{{.Parent}}') || break
  tags=$(printf '%s' "$meta" | cut -d'|' -f1)
  digests=$(printf '%s' "$meta" | cut -d'|' -f2)
  [ "$tags" = '[]' ] && [ "$digests" = '[]' ] || break
  [ -z "$(docker ps -aq --filter ancestor="$id")" ] || break
  parent=$(printf '%s' "$meta" | cut -d'|' -f3)
  docker image rm --no-prune "$id" || break
  id=$parent
  count=$((count+1))
 done
done
df -Pk /`;
const proc=Bun.spawn(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'inherit',stderr:'inherit'});
if(await proc.exited)throw Error('CLEANUP_STOPPED');
