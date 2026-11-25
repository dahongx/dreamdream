/** Single SSH connection avoids repeated authentication pressure. TEST 8091 only. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const files=['src/components/chat/MessageRenderer.tsx','src/components/chat/MessageBubble.tsx','src/components/chat/mufy-native-table.module.css','src/components/chat/MufyReplySidebar.tsx','src/lib/import/mufy-shared-component-style.ts'];
if(!process.argv.includes('--commit-test'))throw Error('EXPLICIT_TEST_SWITCH_REQUIRED');
const startedAt=new Date().toISOString(),t=performance.now(),stamp=startedAt.replace(/\D/g,''),backup=`/root/mufy-transfer-archive-20261015/source-presentation-${stamp}`;
const archive=root+'/source-presentation-patch.tar.gz';
const tar=Bun.spawn(['tar','-czf',archive,...files],{stdout:'inherit',stderr:'inherit'});if(await tar.exited)throw Error('ARCHIVE_FAILED');
const bytes=Buffer.from(await readFile(archive)).toString('base64');
const expected=(await readFile(root+'/source-presentation-remote-baseline.txt','utf8')).trim();
if(expected.split(/\r?\n/).length!==files.length)throw Error('PINNED_BASELINE_REQUIRED');
const hashes=await Promise.all(files.map(async f=>createHash('sha256').update(await readFile(f)).digest('hex')+'  '+f));
const command=`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
expected=$(cat <<'MUFY_EXPECTED'
${expected}
MUFY_EXPECTED
)
test "$(sha256sum ${files.join(' ')})" = "$expected"
df -Pk / /root/projects/yearn-chat /var/lib/docker | awk 'NR>1 { gsub(/%/,"",$5); if ($4 < 20971520 || $5 > 80) exit 1 }'
umask 077
mkdir -p ${backup}
base64 -d > ${backup}/patch.tar.gz <<'MUFY_PATCH'
${bytes}
MUFY_PATCH
tar -cf ${backup}/source-before.tar ${files.join(' ')}
docker tag yearn-chat-app yearn-chat-app:source-presentation-before-${stamp}
tar -xzf ${backup}/patch.tar.gz
if docker compose build app >${backup}/build.log 2>&1; then
 docker compose up -d --no-deps app
else
 tar -xf ${backup}/source-before.tar
 tail -n 20 ${backup}/build.log
 exit 1
fi
sha256sum ${files.join(' ')}
docker compose ps app
df -Pk /
`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73','sh -s'],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});
p.stdin.write(command);p.stdin.end();
const [stdout,stderr,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
const ok=exit===0&&hashes.every(h=>stdout.includes(h));
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok,exit,backup,files,hashes,stdout,stderr,databaseCommands:0,volumeChanges:0,productionWrites:0};
await writeFile(root+'/source-presentation-deploy.json',JSON.stringify(report,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'source-presentation-session-deploy',kind:'compute',...report})+'\n');
console.log(JSON.stringify(report));if(!ok)process.exitCode=1;
