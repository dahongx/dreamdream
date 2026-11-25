/** User-authorized TEST-only renderer patch. No card/message/database commands. */
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
if (!process.argv.includes('--commit-test')) throw new Error('--commit-test required');
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5');
const file='src/lib/import/mufy-source-rule-envelope.ts';
const at=new Date().toISOString(),stamp=at.replace(/\D/g,''),start=performance.now();
const backup=`/root/mufy-transfer-archive-20261015/message-surface-${stamp}`;
const archive=resolve(root,`message-surface-${stamp}.tar`);
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false){const child=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const text=capture?await new Response(child.stdout).text():'';if(await child.exited)throw new Error(`TEST command failed: ${args[0]}`);return text;}
let ok=false;
try{
 await requireTestDiskCapacity(run,ssh);
 const port=await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true);
 if(!/^0\.0\.0\.0:8091\s*$/m.test(port))throw new Error('Not TEST app on 8091');
 const original=await run(['tar','-xOf',resolve(root,'source-rules-deploy-20261015075009696.tar'),file],true);
 const expected=createHash('sha256').update(original).digest('hex');
 const actual=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${file}`],true);
 if(actual.split(/\s/)[0]!==expected)throw new Error('Remote renderer changed since reviewed baseline; refusing overwrite');
 const staged=resolve(root,'message-surface-tested');
 const local=await readFile(file,'utf8'),candidate=await readFile(resolve(staged,file),'utf8');
 const startAt='export function splitMufySourceFrames(',endAt='/** Raw model HTML fences';
 const section=(s:string)=>s.slice(s.indexOf(startAt),s.indexOf(endAt));
 if(section(local)!==section(candidate))throw new Error('Staged message surface differs from tested local implementation');
 const withoutSection=(s:string)=>s.slice(0,s.indexOf(startAt))+s.slice(s.indexOf(endAt));
 if(withoutSection(original)!==withoutSection(candidate))throw new Error('Staged patch contains unrelated changes');
 await run(['tar','-C',staged,'-cf',archive,file]);
 await run([...ssh,`umask 077; mkdir -p ${backup}`]);
 await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${file}; docker tag yearn-chat-app yearn-chat-app:message-surface-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 45 ${backup}/build.log; exit 1; fi; docker compose ps app --format '{{.State}} {{.Ports}}'`]);
 ok=true;
}finally{
 const report={scope:'TEST',port:8091,startedAt:at,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,ok,files:[file],backup,databaseCommands:0,productionWrites:0};
 await writeFile(resolve(root,`message-surface-${stamp}.json`),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
