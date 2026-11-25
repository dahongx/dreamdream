/** Read-only provenance-limited TEST build-stage inspection. */
const command = String.raw`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
for root in f644db6f1a35 e51a3b4ba56d 8faecc4911a3; do
 id=$root
 count=0
 while [ -n "$id" ] && [ "$count" -lt 25 ]; do
  docker image inspect "$id" --format '{{.Id}}|{{json .RepoTags}}|{{.Parent}}'
  id=$(docker image inspect "$id" --format '{{.Parent}}')
  case "$id" in sha256:d8d1decd435a*|sha256:a76b7c013c54*) break;; esac
  count=$((count+1))
 done
done
df -Pk /`;
const p = Bun.spawn(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'inherit',stderr:'inherit'});
if(await p.exited)throw Error('AUDIT_FAILED');
