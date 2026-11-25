/** Restore an existing, publicly referenced static TEST asset. No card/DB edits. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir='outputs/chat-skin-upgrade/avatar-resource';
const asset='public/character-pilot/shen-yihan-v3.jpg';
const expected='60f0de143f94e25bddcfd4ce619d7435545d3b2280a7ebf05f7005a4fb488416';
if(createHash('sha256').update(await readFile(asset)).digest('hex')!==expected)throw Error('ASSET_CHANGED');
const skin=JSON.parse(await readFile('outputs/chat-skin-upgrade/platform-family/deployment.json','utf8'));
if(!skin.deployed)throw Error('SKIN_DEPLOYMENT_NOT_COMPLETE');
if(!process.argv.includes('--deploy')){console.log('Validated exact static TEST asset; --deploy required.');process.exit(0);}
const tar=Bun.spawn(['tar','-cf',`${dir}/patch.tar`,'-C',dir,'Dockerfile','-C',process.cwd(),asset]);
if(await tar.exited)throw Error('ARCHIVE_FAILED');
const stamp=new Date().toISOString().replace(/\D/g,'');
const backup=`/root/mufy-transfer-archive-20261015/avatar-resource-${stamp}`;
const tag=`yearn-chat-app:before-avatar-${stamp}`;
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
expectedRunningImage=$(docker inspect --format '{{.Image}}' yearn-chat-app-1)
test "$(sha256sum src/lib/styling/whitelist.ts | cut -d' ' -f1)" = 'aad429e389bbccf233559c0cd8e0e15f795bd3d468ae4c2888b2509cebc40675'
test ! -e ${asset}
df -Pk / | awk 'NR==2 {p=$5;sub(/%/,"",p);if($4<1048576 || p>95)exit 1}'
umask 077
mkdir ${backup}
tar -xf - -C ${backup}
test "$(sha256sum ${backup}/${asset} | cut -d' ' -f1)" = '${expected}'
docker tag "$expectedRunningImage" ${tag}
mkdir -p public/character-pilot
cp ${backup}/${asset} ${asset}
if docker build --build-arg BASE_IMAGE=${tag} -t yearn-chat-app:latest ${backup} >${backup}/build.log 2>&1 && test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = "$expectedRunningImage" && docker compose up -d --no-deps app; then
 test "$(docker compose port app 3000)" = '0.0.0.0:8091'
 test "$(docker exec yearn-chat-app-1 sha256sum /app/${asset} | cut -d' ' -f1)" = '${expected}'
 echo TEST_AVATAR_RESTORED
else
 actualImage=$(docker inspect --format '{{.Image}}' yearn-chat-app-1)
 builtImage=$(docker image inspect --format '{{.Id}}' yearn-chat-app:latest)
 test "$actualImage" = "$expectedRunningImage" || test "$actualImage" = "$builtImage" || { echo TEST_CONCURRENT_CHANGE_NO_ROLLBACK; exit 1; }
 docker tag ${tag} yearn-chat-app:latest
 docker compose up -d --no-deps app
 exit 1
fi`;
const startedAt=new Date().toISOString(),start=performance.now();
const p=Bun.spawn(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdin:new Uint8Array(await readFile(`${dir}/patch.tar`)),stdout:'pipe',stderr:'inherit'});
const output=await new Response(p.stdout).text(),exitCode=await p.exited;
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,timingKind:'deployment-wall-time',backup,asset,sha256:expected,deployed:exitCode===0&&output.includes('TEST_AVATAR_RESTORED'),exitCode,productionTouched:false,databaseTouched:false};
await writeFile(`${dir}/deployment.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
