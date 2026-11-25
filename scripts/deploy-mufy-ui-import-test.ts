/** Authorized TEST:8091 normal UI importer only. No direct data access. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
if(!process.argv.includes('--commit-test'))throw Error('--commit-test required');
const files=['src/lib/import/external-card.ts','src/lib/characters/import-actions.ts'];
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const source=await Promise.all(files.map(f=>readFile(f,'utf8')));
const before=[source[0].replace('  /** Plaintext source theater, rendered through the existing sandbox slot. */\n  openingComponent: string | null;\n','').replace('  const openingComponent = plainText(asString(root.小剧场), false);\n','').replace('customStyles, openingComponent, lockedFields','customStyles, lockedFields'),source[1].replace('  openingComponents,\n','').replace('customStyles, openingComponent, lockedFields','customStyles, lockedFields').replace('  if (openingComponent) {\n    await db.insert(openingComponents).values({\n      packId: pack.id,\n      name: "导入的开场组件",\n      content: openingComponent,\n      enabled: true,\n      orderIndex: 0,\n    });\n  }\n\n','')];
const expected=before.map(hash),candidate=source.map(hash),ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
const startedAt=new Date().toISOString(),t=performance.now(),stamp=startedAt.replace(/\D/g,'');
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019',backup=`/root/mufy-transfer-archive-20261015/ui-import-${stamp}`;
async function run(args:string[],capture=false){const p=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const output=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('TEST_COMMAND_FAILED');return output;}
let ok=false;
try{
 await requireTestDiskCapacity(run,ssh);
 if((await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true)).trim()!=='0.0.0.0:8091')throw Error('EXACT_TEST_PORT_REQUIRED');
 const old=(await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true)).trim().split(/\r?\n/).map(s=>s.split(/\s/)[0]);
 if(old.length!==2||old.some((v,i)=>v!==expected[i]))throw Error('REMOTE_BASELINE_CHANGED');
 const archive=`${root}/ui-import-${stamp}.tar`;await run(['tar','-cf',archive,...files]);
 await run([...ssh,`umask 077; mkdir -p ${backup}`]);await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files.join(' ')}; docker tag yearn-chat-app yearn-chat-app:ui-import-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 30 ${backup}/build.log; exit 1; fi`]);
 const actual=(await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${files.join(' ')}`],true)).trim().split(/\r?\n/).map(s=>s.split(/\s/)[0]);
 if(actual.length!==2||actual.some((v,i)=>v!==candidate[i]))throw Error('DEPLOYED_BYTES_MISMATCH');ok=true;
}finally{
 const timing={runId:startedAt,stepId:'test-ui-import-deployment',kind:'deployment',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:ok?'ok':'failed'};
 await writeFile(`${root}/ui-import-${stamp}.json`,JSON.stringify({...timing,files,candidate,expected,backup,ok,databaseCommands:0,productionWrites:0},null,2));
 console.log(JSON.stringify({...timing,ok,backup}));
}
