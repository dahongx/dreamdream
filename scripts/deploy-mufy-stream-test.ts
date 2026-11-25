/** Authorized TEST:8091 renderer patch. No DB/card/history/production access. */
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
if(!process.argv.includes('--commit-test'))throw Error('--commit-test required');
const files=['src/components/chat/MessageBubble.tsx','src/components/regex/RegexIframe.tsx','src/lib/regex/iframe-bridge.ts','src/lib/regex/iframe-incremental.ts'];
const baselines=['306de87f9603d62d69be821c38f9c9c54d3ccc2ee9f6fe94b31b854c85b2782d','b9b66e28f0dc5bd7183aa199bdd5d4a3cf710084c950cff43c85c96136cf8b3a','2f7773faa3675ea5b6eaff2d3fdd0af211c51510cb1769af6975687b5a229620'];
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5');
const startedAt=new Date().toISOString(),t=performance.now(),stamp=startedAt.replace(/\D/g,'');
const backup=`/root/mufy-transfer-archive-20261015/stream-${stamp}`;
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false){const p=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('TEST command failed:'+args[0]);return out;}
const candidateHashes=await Promise.all(files.map(async f=>createHash('sha256').update(await readFile(f)).digest('hex')));
let ok=false;
try{
 await requireTestDiskCapacity(run,ssh);
 const port=await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true);
 if(!/^0\.0\.0\.0:8091\s*$/m.test(port))throw Error('EXACT_TEST_PORT_REQUIRED');
 const remote=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.slice(0,3).join(' ')} && test ! -e ${files[3]}`],true);
 if(remote.trim().split(/\r?\n/).length!==3||remote.trim().split(/\r?\n/).some((line,i)=>line.split(/\s/)[0]!==baselines[i]))throw Error('REMOTE_BASELINE_CHANGED');
 const archive=resolve(root,`stream-${stamp}.tar`);await run(['tar','-cf',archive,...files]);
 await run([...ssh,`umask 077; mkdir -p ${backup}`]);await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files.slice(0,3).join(' ')}; docker tag yearn-chat-app yearn-chat-app:stream-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 45 ${backup}/build.log; exit 1; fi; docker compose ps app --format '{{.State}} {{.Ports}}'`]);
 const actual=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true);
 if(actual.trim().split(/\r?\n/).length!==4||actual.trim().split(/\r?\n/).some((line,i)=>line.split(/\s/)[0]!==candidateHashes[i]))throw Error('PUBLISHED_BYTES_MISMATCH');ok=true;
}finally{const report={scope:'TEST',port:8091,startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok,files,baselines,candidateHashes,backup,databaseCommands:0,productionWrites:0,visualAccepted:false};await writeFile(resolve(root,`stream-${stamp}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
