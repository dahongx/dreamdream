/** Explicitly authorized TEST:8091 renderer deployment only. No DB/card/history commands. */
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
if(!process.argv.includes('--commit-test'))throw Error('--commit-test required');
const files=['src/components/chat/ChatMessagesList.tsx','src/components/chat/MessageBubble.tsx','src/components/chat/mufy-shared-component-context.ts','src/lib/import/mufy-shared-component-style.ts'];
const baselines=['0f9e646c7429c7721fb686933be31443a4f248fa619c81384c4698ba5da8675e','567d75fa14da153b724f0b0c043d14f4d896b86558ed6fc2dbfa04e355c11ada'];
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5');
const startedAt=new Date().toISOString(),start=performance.now(),stamp=startedAt.replace(/\D/g,'');
const backup=`/root/mufy-transfer-archive-20261015/shared-style-${stamp}`;
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function run(args:string[],capture=false){const c=Bun.spawn(args,{stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(c.stdout).text():'';if(await c.exited)throw Error('TEST command failed:'+args[0]);return out;}
const list=(await readFile(files[0],'utf8')).replaceAll('\r\n','\n');
const bubble=(await readFile(files[1],'utf8')).replaceAll('\r\n','\n');
const oldList=list.replace('import { memo, useCallback, useMemo } from "react";','import { memo, useCallback } from "react";')
 .replace('import { collectMufySharedComponentStyle } from "@/lib/import/mufy-shared-component-style";\n','')
 .replace('import { hasMufyRenderedOpening } from "@/lib/import/mufy-native-table";\n','')
 .replace('import { MufySharedComponentStyleContext } from "./mufy-shared-component-context";\n','')
 .replace("  const sourceComponentStyle=useMemo(()=>hasMufyRenderedOpening(rules)?collectMufySharedComponentStyle(openingComponents):'', [rules,openingComponents]);\n",'')
 .replace('<MufySharedComponentStyleContext.Provider value={sourceComponentStyle}>','<>').replace('</MufySharedComponentStyleContext.Provider>','</>');
const oldBubble=bubble.replace('useCallback, useContext,','useCallback,')
 .replace('import { withMufySharedComponentStyle } from "@/lib/import/mufy-shared-component-style";\n','')
 .replace('import { MufySharedComponentStyleContext } from "./mufy-shared-component-context";\n','')
 .replace('  const sourceComponentStyle=useContext(MufySharedComponentStyleContext);\n','')
 .replace('srcdoc={withMufySharedComponentStyle(seg.srcdoc, sourceComponentStyle)}','srcdoc={seg.srcdoc}');
if(hash(oldList)!==baselines[0]||hash(oldBubble)!==baselines[1])throw Error('Unrelated local changes refused');
let ok=false;
try{
 await requireTestDiskCapacity(run,ssh);
 const port=await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true);if(!/^0\.0\.0\.0:8091\s*$/m.test(port))throw Error('Exact TEST port required');
 for(const [i,file]of files.slice(0,2).entries()){const r=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${file}`],true);if(r.split(/\s/)[0]!==baselines[i])throw Error('Remote baseline changed');}
 await run([...ssh,`cd /root/projects/yearn-chat && test ! -e ${files[2]} && test ! -e ${files[3]}`]);
 const archive=resolve(root,`shared-style-${stamp}.tar`);await run(['tar','-cf',archive,...files]);
 await run([...ssh,`umask 077; mkdir -p ${backup}`]);await run(['scp','-q',archive,`root@115.29.213.73:${backup}/patch.tar`]);
 await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files[0]} ${files[1]}; docker tag yearn-chat-app yearn-chat-app:shared-style-before-${stamp}; tar -xf ${backup}/patch.tar; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; tail -n 45 ${backup}/build.log; exit 1; fi; docker compose ps app --format '{{.State}} {{.Ports}}'`]);ok=true;
}finally{const report={scope:'TEST',port:8091,startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,ok,files,baselines,backup,databaseCommands:0,productionWrites:0,visualAccepted:false};await writeFile(resolve(root,`shared-style-${stamp}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
