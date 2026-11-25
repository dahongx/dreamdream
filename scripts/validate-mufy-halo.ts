/** WIP toolkit-only checks. Does not update whole-batch acceptance or runtime bundle. */
import {writeFile,appendFile} from 'node:fs/promises';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const records=[];
for(const [kind,args] of [
 ['halo-unit',['bun','test','src/components/chat/__tests__/mufy-halo-toolkit.test.tsx']],
 ['halo-typecheck',['bun','x','tsc','--noEmit','-p','tsconfig.mufy-halo.json']],
] as const){
 const startedAt=new Date().toISOString(),start=performance.now(),child=Bun.spawn([...args],{stdout:'pipe',stderr:'pipe'});
 const [out,err,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 const record={id:kind+'-'+startedAt,kind,startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-start,exitCode,agentNetMs:null,scope:'isolated halo WIP; process wall, not agent work; no TEST build',buildStarted:false,deployed:false,fullFidelityAccepted:false};records.push(record);
 await writeFile(dir+'/final-acceptance/49/'+kind+'.log',out+err);await appendFile(dir+'/timing-runs.jsonl',JSON.stringify(record)+'\n');console.log(JSON.stringify(record));
}
await writeFile(dir+'/final-acceptance/49/halo-validation.json',JSON.stringify(records,null,2));if(records.some(r=>r.exitCode))process.exitCode=1;
