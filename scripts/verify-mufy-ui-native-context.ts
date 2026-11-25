/** Local regression and measured compute time, no network/data access. */
import {writeFile,appendFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),t=performance.now();
const tests=['src/lib/__tests__/mufy-native-table.test.ts','src/components/chat/__tests__/mufy-native-layout.test.tsx','src/lib/__tests__/mufy-shared-component-style.test.ts','src/lib/__tests__/mufy-sidebar-owner.test.ts','src/lib/__tests__/mufy-runtime-adaptation.test.ts','src/lib/__tests__/mufy-migration.test.ts','src/lib/import/__tests__/external-card.test.ts'];
const commands=[];
for(const args of [['bun','test',...tests],['bun','x','tsc','--noEmit','-p','tsconfig.mufy-statusbar.json']]){
 const c0=performance.now(),cAt=new Date().toISOString();
 const p=Bun.spawn(args,{stdout:'pipe',stderr:'pipe'});
 const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 commands.push({args,startedAt:cAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-c0,exit,output:out+err});
}
const result={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok:commands.every(c=>c.exit===0),commands};
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
await writeFile(root+'/ui-native-local-regression.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'ui-native-local-regression',kind:'compute',startedAt,finishedAt:result.finishedAt,elapsedMs:result.elapsedMs,status:result.ok?'ok':'failed'})+'\n');
console.log(JSON.stringify({...result,commands:commands.map(({output,...c})=>({...c,tail:output.slice(-300)}))}));
if(!result.ok)process.exitCode=1;
