/** Cancel only our stuck disposable font-install build; leave TEST app running. */
import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),tick=performance.now();
const container='bb7ca1eb37986caae890bf5268fc3ecf0951f34ca100c5dfadb62e31edece460';
const backup='/root/mufy-transfer-archive-20261015/reply-pet-ready-20261028123856044';
const command=`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(cat ${backup}/status)" = BUILDING
grep -q 'Running in bb7ca1eb3798' ${backup}/build.log
grep -q 'Fail extracting tarball' ${backup}/build.log
test "$(docker inspect '${container}' --format '{{.State.Status}} {{.Image}} {{.Config.WorkingDir}} {{len .Mounts}}')" = 'running sha256:87adf795a44ce698c83866ef621a6db869c11b46f8fc8161e1360fc7fc72cacf /app 0'
test "$(docker compose ps -q app)" != '${container}'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = 'sha256:ef8463766f30484280f7b075ef8cd1e54d18dd229a43352d1e7084f050e62d2e'
docker stop --time 10 '${container}'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = 'sha256:ef8463766f30484280f7b075ef8cd1e54d18dd229a43352d1e7084f050e62d2e'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-reply-pet-ready-20261028/failed-install-cancel.json',JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-build-cancel-wall-not-agent-net',container,backup,stdout,stderr,exitCode,reason:'Font tarball extraction error followed by >9 minutes without progress; only owned build container cancelled',runningAppStopped:false,databaseTouched:false,productionTouched:false},null,2));
console.log(JSON.stringify({exitCode,stdout,stderr}));if(exitCode)process.exitCode=1;
