/** Authorized TEST:8091 only. Exact source baselines, backup and image rollback.
 * No DB, migration, credential, card or history access. */
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
if(!process.argv.includes('--commit-test'))throw Error('--commit-test required');
const files=['src/components/chat/ChatMessagesList.tsx','src/components/chat/MessageBubble.tsx','src/components/chat/MessageRenderer.tsx','src/components/chat/mufy-native-table.module.css','src/lib/import/mufy-shared-component-style.ts','src/components/chat/MufyReplySidebar.tsx'];
const baselines=['2df374f850fa394b50616b0e36322b05317782da4bad5cda289597d9c5c7f211','23c556628042f6ae71209de87f632ac0d708432d1fedc2c64cb6579de2174aaa','0a3af1b94e3b3317d4162eed64167e8f15fef56e5a415b0e7f5c5fce9fda3232','9ffdfe2cbd84724e414376aa598ccd071e2830df34db407a0832412d8efe9077','b7b4a5ff6b8e4f4f0c452dceaf03ca9bcf16ddfcb006a0351e630acebf15d9ee'];
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5');
const startedAt=new Date().toISOString(),t=performance.now(),stamp=startedAt.replace(/\D/g,'');
const backup=`/root/mufy-transfer-archive-20261015/statusbar-${stamp}`;
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false){const p=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('TEST command failed:'+args[0]);return out;}
const candidateHashes=await Promise.all(files.map(async f=>createHash('sha256').update(await readFile(f)).digest('hex')));
let ok=false;
try{
 await requireTestDiskCapacity(run,ssh);
 const port=await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true);
 if(!/^0\.0\.0\.0:8091\s*$/m.test(port))throw Error('EXACT_TEST_PORT_REQUIRED');
 const remote=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.slice(0,5).join(' ')} && test ! -e ${files[5]}`],true);
 if(remote.trim().split(/\r?\n/).some((line,i)=>line.split(/\s/)[0]!==baselines[i])||remote.trim().split(/\r?\n/).length!==5)throw Error('REMOTE_BASELINE_CHANGED');
 const archive=resolve(root,`statusbar-${stamp}.tar`);
 await run(['tar','-cf',archive,...files]);
 await run([...ssh,`umask 077; mkdir -p ${backup}`]);
 await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files.slice(0,5).join(' ')}; docker tag yearn-chat-app yearn-chat-app:statusbar-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 45 ${backup}/build.log; exit 1; fi; docker compose ps app --format '{{.State}} {{.Ports}}'`]);
 const actual=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true);
 if(actual.trim().split(/\r?\n/).some((line,i)=>line.split(/\s/)[0]!==candidateHashes[i]))throw Error('PUBLISHED_BYTES_MISMATCH');
 ok=true;
}finally{
 const report={scope:'TEST',port:8091,startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok,files,baselines,candidateHashes,backup,databaseCommands:0,productionWrites:0,visualAccepted:false};
 await writeFile(resolve(root,`statusbar-${stamp}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
