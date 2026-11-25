import {writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const startedAt=new Date().toISOString(),t=performance.now(),commands=[];
for(const args of [['bun','test','src/lib/__tests__/mufy-completion-contract.test.ts','src/lib/__tests__/mufy-reply-review.test.ts','src/lib/__tests__/mufy-reply-style-coverage.test.ts','scripts/tests/mufy-quote-compatibility.test.ts'],['bun','x','tsc','--noEmit','-p','tsconfig.mufy-completion.json']]){
 const c0=performance.now(),at=new Date().toISOString();const p=Bun.spawn(args,{stdout:'pipe',stderr:'pipe'});
 const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 commands.push({args,startedAt:at,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-c0,exit,output:out+err});
}
const result={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,ok:commands.every(c=>c.exit===0),commands};
await writeFile(root+'/completion-repair-regression.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'completion-repair-regression',kind:'compute',startedAt,finishedAt:result.finishedAt,elapsedMs:result.elapsedMs,status:result.ok?'ok':'failed'})+'\n');
console.log(JSON.stringify({...result,commands:commands.map(({output,...r})=>({...r,tail:output.slice(-1000)}))}));
if(!result.ok)process.exitCode=1;
