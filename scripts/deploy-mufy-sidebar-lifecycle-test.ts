/** Authorized TEST:8091 only. No database or production operations. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
if(!process.argv.includes('--commit-test'))throw Error('--commit-test required');
const files=['src/components/chat/MessageBubble.tsx','src/components/chat/ChatMessagesList.tsx','src/components/chat/MufyReplySidebar.tsx','src/lib/chat/mufy-sidebar-owner.ts'];
const baseline=['ce55e460626f773a5b4af5e1926248697002a7659023517c4243ec9b55783479','97da30fafed0c30a257efc50447a663d892e668134a0e3d7be07de59321f96e7','1c38095280a008a7dacbedc9600b8901ffd365714d9b1ad4283552fd6f55fc1e'];
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
const startedAt=new Date().toISOString(),start=performance.now(),stamp=startedAt.replace(/\D/g,'');
const root='logs/mufy-profiles/full-20261013/pilot-5',backup=`/root/mufy-transfer-archive-20261015/sidebar-lifecycle-${stamp}`;
async function run(args:string[],capture=false){const p=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('TEST_COMMAND_FAILED');return out;}
const hashes=await Promise.all(files.map(async f=>createHash('sha256').update(await readFile(f)).digest('hex')));
let ok=false;
try{
 await requireTestDiskCapacity(run,ssh);
 if((await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true)).trim()!=='0.0.0.0:8091')throw Error('EXACT_TEST_PORT_REQUIRED');
 const old=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.slice(0,3).join(' ')} && test ! -e ${files[3]}`],true);
 if(old.trim().split(/\r?\n/).length!==3||old.trim().split(/\r?\n/).some((s,i)=>s.split(/\s/)[0]!==baseline[i]))throw Error('REMOTE_BASELINE_CHANGED');
 const archive=`${root}/sidebar-lifecycle-${stamp}.tar`;
 await run(['tar','-cf',archive,...files]);
 await run([...ssh,`umask 077; mkdir -p ${backup}`]);
 await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files.slice(0,3).join(' ')}; docker tag yearn-chat-app yearn-chat-app:sidebar-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 40 ${backup}/build.log; exit 1; fi; sha256sum ${files.join(' ')}; docker compose ps app --format '{{.State}} {{.Ports}}'`]);
 const actual=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true);
 if(actual.trim().split(/\r?\n/).some((s,i)=>s.split(/\s/)[0]!==hashes[i]))throw Error('DEPLOYED_BYTES_MISMATCH');
 ok=true;
}finally{const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,scope:'TEST:8091',files,hashes,baseline,backup,ok,visualAccepted:false,databaseCommands:0,productionWrites:0};await writeFile(`${root}/sidebar-lifecycle-${stamp}.json`,JSON.stringify(report,null,2));console.log(report);}
