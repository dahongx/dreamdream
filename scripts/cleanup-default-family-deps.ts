/** Rebuildable TEST dependency stage only; no application or data volumes. */
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = 'sha256:478e86399ec0ef5faf205a2b4341c55b72dfc45d7bde64dba57500d6a9fe7407'
test "$(docker image inspect a76b7c013c54 --format '{{json .RepoTags}}')" = '["yearn-chat-test-cache:deps-20261027"]'
test -z "$(docker ps -aq --filter ancestor=a76b7c013c54)"
docker image rm --no-prune yearn-chat-test-cache:deps-20261027
for id in b4d6924b8a6b c92161feb8ff; do
 test "$(docker image inspect "$id" --format '{{json .RepoTags}}')" = '[]'
 test -z "$(docker ps -aq --filter ancestor="$id")"
 docker image rm --no-prune "$id"
done
df -Pk /`;
const p=Bun.spawn(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'inherit',stderr:'inherit'});
if(await p.exited)throw Error('CLEANUP_STOPPED');
