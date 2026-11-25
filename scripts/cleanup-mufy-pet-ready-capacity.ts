/** Only untagged, unused artifacts explicitly present in archived TEST build logs. */
import {writeFile,readFile} from 'node:fs/promises';
const current='sha256:ef8463766f30484280f7b075ef8cd1e54d18dd229a43352d1e7084f050e62d2e';
const targets=[
 {id:'sha256:4ba1d870c6baa372b665120f90a2bb8125fab2f0cf7661558652262f25e022f6',log:'reply-pet-bootstrap-20261028121835645'},
 {id:'sha256:f1143b2e39138555d176fbdfdab092996810fcb9e10d9eaad3481145163d6012',log:'reply-pet-bootstrap-20261028121835645'},
 {id:'sha256:ea31dd844fd22e04335273d142246674cb91cdb1b6bcc86b8cd7407d6533f7bd',log:'mask-20261028111920957'},
 {id:'sha256:ceefe78b03ed6102b196adb6c947405b36a24591cccbc0e61853620f8c076f68',log:'mask-20261028111453760'},
 {id:'sha256:706a526a75d453b53272c79d93abbe6f08cfaed83f4085ee893e7615e7209ec9',log:'mask-20261028111453760'},
];
const startedAt=new Date().toISOString(),tick=performance.now();
const stoppedBuild='e156c6529b15cc64006eddd39073189000e77621f8ca523119a8db274ae73d09';
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
test "$(docker inspect '${stoppedBuild}' --format '{{.State.Status}} {{.State.ExitCode}} {{.Image}} {{.Config.WorkingDir}} {{len .Mounts}}')" = 'exited 1 sha256:ceefe78b03ed6102b196adb6c947405b36a24591cccbc0e61853620f8c076f68 /app 0'
grep -q e156c6529b15 /root/mufy-transfer-archive-20261015/mask-20261028111453760/build.log
used="$(docker ps -aq --no-trunc | while read cid; do if test "$cid" != '${stoppedBuild}'; then docker inspect "$cid" --format '{{.Image}}'; fi; done)"
${targets.map(t=>`test "$(docker image inspect '${t.id}' --format '{{len .RepoTags}}')" = 0
test "$(docker image inspect '${t.id}' --format '{{.Config.WorkingDir}}')" = /app
grep -q '${t.id.slice(7,19)}' /root/mufy-transfer-archive-20261015/${t.log}/build.log
if printf '%s\\n' "$used" | grep -Fqx '${t.id}'; then echo ARTIFACT_IN_USE; exit 1; fi`).join('\n')}
df -Pk /
docker rm '${stoppedBuild}'
docker image rm ${targets.map(t=>t.id).join(' ')}
df -Pk /
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
const resultPath='outputs/mufy-reply-pet-ready-20261028/capacity-cleanup.json';
const prior=await readFile(resultPath,'utf8').catch(()=>null);
if(prior)await writeFile(resultPath.replace('.json','.blocked.json'),prior);
await writeFile(resultPath,JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-operation-wall-not-agent-net',targets,stoppedBuild,stdout,stderr,exitCode,namedImagesPreserved:true,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Rebuild disposable stages/container from retained source archives'},null,2));
console.log(JSON.stringify({exitCode,stdout,stderr}));if(exitCode)process.exitCode=1;
