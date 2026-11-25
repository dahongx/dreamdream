/** Offline diagnostics from normal public source DOM. No network or execution. */
import {readFile,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {publicComponentCoverage} from '../src/lib/import/mufy-public-component-coverage';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const receipts=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8'));
const normalize=(text:string)=>text.replace(/\{\{user\}\}|mufyer|test/g,'USER').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
function visibleText(html:string):string {
 const d=new JSDOM(html.replace(/<(script|style|template|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,''));
 d.window.document.querySelectorAll('script,style,template,title').forEach(n=>n.remove());
 const text=d.window.document.body.textContent??'';
 d.window.close();return text;
}
const rows=[];
for(const receipt of receipts.rows as {rank:number;sourceKey:string}[]){
 const file=`${root}/final-acceptance/${receipt.rank}/source-public-component-inventory.json`;
 if(!await Bun.file(file).exists()){rows.push({rank:receipt.rank,inventoryObserved:false,fullFidelityAccepted:false});continue;}
 const source=JSON.parse(await readFile(file,'utf8'));
 if(source.sourceKey!==receipt.sourceKey||!source.roleNamePresent)throw Error('SOURCE_IDENTITY_MISMATCH');
 const prepared=JSON.parse(await readFile(`${root}/prepared/${receipt.sourceKey}/prepared.json`,'utf8'));
 const original:string=prepared.beautification.openingComponent;
 // Latest owner baseline/candidate are explicit evidence, not a guessed merge.
 const candidatePath=`${root}/final-acceptance/${receipt.rank}/candidate-opening.txt`;
 const candidate=await Bun.file(candidatePath).exists()?await readFile(candidatePath,'utf8'):original;
 const originalText=normalize(visibleText(original)),candidateText=normalize(visibleText(candidate));
 const prelude=source.roots[0];
 const frames=prelude.frames.map((frame:{html:string;index:number;rawLength:number;collapsedDrawer:boolean;width:number;height:number})=>{
  const text=normalize(visibleText(frame.html));
  const samples=[...new Set([text.slice(0,24),text.slice(Math.floor(text.length/3),Math.floor(text.length/3)+24),text.slice(-24)].filter(s=>s.length>=16))];
  const originalMissing=samples.filter(s=>!originalText.includes(s));
  const candidateMissing=samples.filter(s=>!candidateText.includes(s));
  const renderedArea=frame.width>2&&frame.height>2;
  return {index:frame.index,characters:text.length,samples: samples.length,originalMissing:originalMissing.length,candidateMissing:candidateMissing.length,renderedArea,needsReview:renderedArea&&samples.length>=2&&candidateMissing.length===samples.length,emptyPreview:frame.rawLength===0,collapsedDrawer:frame.collapsedDrawer,note:'Text-sample gap is diagnostic only; not identity failure or full-fidelity acceptance. Hidden/zero-area scripts require separate behavior checks.'};
 });
 const mappingPath=`${root}/final-acceptance/${receipt.rank}/component-ui-mapping.json`;
 const mapping=await Bun.file(mappingPath).exists()?JSON.parse(await readFile(mappingPath,'utf8')):null;
 if(mapping&&(mapping.sourceObservedAt!==source.observedAt||mapping.sourceUrl!==source.url))throw Error('STALE_COMPONENT_UI_MAPPING');
 const coverage=publicComponentCoverage(prelude.frames.length,mapping?.rows??[]);
 rows.push({rank:receipt.rank,inventoryObserved:true,sourceObservedAt:source.observedAt,frames,possibleGaps:frames.filter((f:{needsReview:boolean})=>f.needsReview).map((f:{index:number})=>f.index),coverage,candidateIsCurrentOwnerVerified:false,fullFidelityAccepted:false});
}
await writeFile(`${root}/public-component-coverage-audit.json`,JSON.stringify({observedAt:new Date().toISOString(),rows,imported:28,fullFidelityAccepted:0,scope:'public source inventory versus saved snapshot/candidate; diagnostic only'},null,2));
console.log(JSON.stringify({observed:rows.filter(r=>r.inventoryObserved).length,possibleGaps:rows.filter(r=>r.inventoryObserved&&r.possibleGaps?.length).map(r=>({rank:r.rank,frames:r.possibleGaps}))}));
