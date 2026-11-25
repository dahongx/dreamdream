/** Offline public DOM audit only. Parent handler references are candidates, not automatic failures. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',startedAt=new Date().toISOString(),tick=performance.now();
const receipts=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8'));
const rows=[];
for(const receipt of receipts.rows as {rank:number;name:string}[]){
 const source=JSON.parse(await readFile(`${root}/final-acceptance/${receipt.rank}/source-public-component-inventory.json`,'utf8'));
 const frames=[];
 for(const frame of source.roots[0].frames as {html:string;index:number}[]){
  const dom=new JSDOM(frame.html),doc=dom.window.document;
  const handlers=[...doc.querySelectorAll('*')].flatMap(e=>[...e.attributes].filter(a=>/^on/i.test(a.name)&&/window\.parent\.[A-Za-z_$][\w$]*\s*\(/.test(a.value)).map(a=>({tag:e.tagName,id:e.id||null,event:a.name,handler:a.value,text:e.textContent?.trim().slice(0,60)})));
  if(handlers.length)frames.push({sourceIndex:frame.index,handlers,requiresActualTargetInteraction:true});
  dom.window.close();
 }
 if(frames.length)rows.push({rank:receipt.rank,name:receipt.name,frames});
}
const result={observedAt:new Date().toISOString(),startedAt,elapsedMs:performance.now()-tick,timingKind:'offline-public-DOM-audit-process-wall-not-agent-net',agentNetMs:null,sourceCards:receipts.rows.length,rows,claim:'Source parent-handler candidates only; existing targeted fixes and actual UI behavior must be checked before declaring a defect.',testBuildStarted:false,fullFidelityAccepted:false};
await writeFile(root+'/public-parent-handler-audit.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({phase:'public-parent-handler-audit',startedAt,observedAt:result.observedAt,elapsedMs:result.elapsedMs,timingKind:result.timingKind,agentNetMs:null})+'\n');
console.log(JSON.stringify({cardsAudited:result.sourceCards,cardsWithCandidates:rows.map(r=>({rank:r.rank,frames:r.frames.map(f=>f.sourceIndex),handlers:r.frames.reduce((n,f)=>n+f.handlers.length,0)}))}));
