/** 8091 only, no database commands, no volume operations. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const files=['src/components/chat/MessageRenderer.tsx','src/components/chat/MessageBubble.tsx','src/components/chat/mufy-native-table.module.css','src/components/chat/MufyReplySidebar.tsx','src/lib/import/mufy-shared-component-style.ts'];
const startedAt=new Date().toISOString(),t=performance.now(),stamp=startedAt.replace(/\D/g,''),backup=`/root/mufy-transfer-archive-20261015/source-presentation-${stamp}`;
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false){const p=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('TEST_COMMAND_FAILED');return out.trim();}
if(await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true)!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const baseline=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true);
await writeFile(root+'/source-presentation-remote-baseline.txt',baseline);
if(!process.argv.includes('--commit-test')){console.log(baseline);process.exit(0);}
// Only the oldest named TEST rollback, never the running or newest rollback.
const old='sha256:33922a710d095aef2c1582f22521ac71163714e2911a8a9e941bda0cca86392b';
const used=(await run([...ssh,"docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}'"],true)).split(/\r?\n/);
const keep=(await run([...ssh,"docker image inspect yearn-chat-app:latest yearn-chat-app:ui-native-before-20261022052535405 --format '{{.Id}}'"],true)).split(/\r?\n/);
if(!used.includes(old)&&!keep.includes(old)&&await run([...ssh,"docker image inspect yearn-chat-app:ui-import-before-20261022042038463 --format '{{.Id}}' 2>/dev/null || true"],true)===old){
 await run([...ssh,'docker image rm yearn-chat-app:ui-import-before-20261022042038463']);
}
await requireTestDiskCapacity(run,ssh);
const archive=root+'/source-presentation-patch.tar';await run(['tar','-cf',archive,...files]);
await run([...ssh,`umask 077; mkdir -p ${backup}`]);await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
if(await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true)!==baseline)throw Error('REMOTE_CHANGED');
await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files.join(' ')}; docker tag yearn-chat-app yearn-chat-app:source-presentation-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 20 ${backup}/build.log; exit 1; fi`]);
const after=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true);
const expected=await Promise.all(files.map(async f=>createHash('sha256').update(await readFile(f)).digest('hex')));
if(after.split(/\r?\n/).some((s,i)=>s.split(/\s/)[0]!==expected[i]))throw Error('BYTES_MISMATCH');
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok:true,backup,files,baseline,after,databaseCommands:0,volumeChanges:0,productionWrites:0,removedOldImage:old,oldImageRecovery:'source archive retained; rebuild required'};
await writeFile(root+'/source-presentation-deploy.json',JSON.stringify(report,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'source-presentation-test-deploy',kind:'compute',...report})+'\n');
console.log(JSON.stringify(report));
