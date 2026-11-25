/** UI-regression rollback of this exact TEST-only release, preserving all other changes. */
import {readFile,writeFile} from 'node:fs/promises';
const dir='outputs/mufy-reply-pet-fit-20261028';
const op=JSON.parse(await readFile(`${dir}/operation.json`,'utf8')),m=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8')),d=JSON.parse(await readFile(`${dir}/deployment.json`,'utf8'));
if(op.backup!=='/root/mufy-transfer-archive-20261015/reply-pet-fit-20261028141258154'||m.entries.length!==1||m.entries[0].path!=='src/lib/import/mufy-reply-pet.ts')throw Error('WRONG_ROLLBACK');
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${d.image}'
test "$(sha256sum src/lib/import/mufy-reply-pet.ts | cut -d' ' -f1)" = '${m.entries[0].after}'
${[...m.preservedTips,...m.preservedRenderer].map((e:{path:string;after:string})=>`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n')}
tar -xf '${op.backup}/source-before.tar'
test "$(sha256sum src/lib/import/mufy-reply-pet.ts | cut -d' ' -f1)" = '${m.entries[0].before}'
docker tag '${m.runningImage}' yearn-chat-app:latest
docker compose up -d --no-deps app
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${m.runningImage}'
printf 'UI_REGRESSION_ROLLED_BACK\\n'`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile(`${dir}/ui-regression-rollback.json`,JSON.stringify({observedAt:new Date().toISOString(),exitCode,stdout,stderr,reason:'Zero-width bootstrap incorrectly fixed anchor to zero; actual UI rejected',databaseTouched:false,productionTouched:false},null,2));console.log(JSON.stringify({exitCode,stdout,stderr}));if(exitCode)process.exitCode=1;
