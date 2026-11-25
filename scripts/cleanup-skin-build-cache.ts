// Exact TEST intermediate chains verified from the 2026-10-27 11:45 build.
// One SSH session avoids a burst of authentication handshakes. No prune/force.
const command = String.raw`set -eu
for start in 1c403d973f6c0eeab97c6ad3b74a5b59ab44bd65f1de8ef5e3bd25ef8a36d273 f5dd5d2514e9abf6c58a5ea5dc6a63ba1959507da2ed1ec925d63adce0bfed7a; do
 id=sha256:$start
 count=0
 while [ -n "$id" ] && [ "$count" -lt 35 ]; do
  case "$id" in sha256:*) ;; *) exit 1;; esac
  meta=$(docker image inspect "$id" --format '{{json .RepoTags}}|{{json .RepoDigests}}|{{.Parent}}') || break
  tags=$(printf '%s' "$meta" | cut -d'|' -f1)
  digests=$(printf '%s' "$meta" | cut -d'|' -f2)
  [ "$tags" = '[]' ] && [ "$digests" = '[]' ] || break
  [ -z "$(docker ps -aq --filter ancestor="$id")" ] || break
  parent=$(printf '%s' "$meta" | cut -d'|' -f3)
  docker image rm "$id" || break
  id=$parent
  count=$((count+1))
  free=$(df -Pk / | awk 'NR==2 {print $4}')
  [ "$free" -lt 22020096 ] || { df -Pk /; exit 0; }
 done
done
df -Pk /`;
const process = Bun.spawn(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'inherit',stderr:'inherit'});
if(await process.exited)throw Error('CLEANUP_STOPPED');
