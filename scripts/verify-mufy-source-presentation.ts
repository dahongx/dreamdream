import {writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const startedAt=new Date().toISOString(),t=performance.now(),commands=[];
for(const args of [['bun','test','src/components/chat/__tests__/mufy-native-layout.test.tsx','src/lib/__tests__/mufy-shared-component-style.test.ts','src/lib/__tests__/mufy-sidebar-owner.test.ts','scripts/tests/mufy-source-presentation.test.ts'],['bun','x','tsc','--noEmit','-p','tsconfig.mufy-statusbar.json']]){
 const at=new Date().toISOString(),s=performance.now();const p=Bun.spawn(args,{stdout:'pipe',stderr:'pipe'});
 const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 commands.push({args,startedAt:at,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-s,exit,output:out+err});
}
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok:commands.every(c=>c.exit===0),commands};
await writeFile(root+'/source-presentation-regression.json',JSON.stringify(report,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'source-presentation-regression',kind:'compute',...report})+'\n');
console.log(JSON.stringify({...report,commands:commands.map(({output,...c})=>({...c,tail:output.slice(-600)}))}));if(!report.ok)process.exitCode=1;
