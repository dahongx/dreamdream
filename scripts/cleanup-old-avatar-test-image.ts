/** Retire one superseded TEST rollback; current and immediate rollback retained. */
const command=String.raw`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = 'sha256:478e86399ec0ef5faf205a2b4341c55b72dfc45d7bde64dba57500d6a9fe7407'
id=sha256:1e38ef571fb67e2f91bbfe8add300838134b9edeaf1c7f71ed9cbdf31c243a1f
test "$(docker image inspect "$id" --format '{{json .RepoTags}}')" = '["yearn-chat-app:before-avatar-20261027125312695"]'
test -z "$(docker ps -aq --filter ancestor="$id")"
docker image inspect 4bac71d19dd7 >/dev/null
docker image inspect d317133ac51a >/dev/null
docker image rm --no-prune yearn-chat-app:before-avatar-20261027125312695
df -Pk /`;
const p=Bun.spawn(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'inherit',stderr:'inherit'});
if(await p.exited)throw Error('CLEANUP_STOPPED');
