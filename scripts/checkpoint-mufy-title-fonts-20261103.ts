import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now(),observedAt=new Date().toISOString(),rows=[];
for(const [rank,index] of [[41,3],[43,0],[46,2],[48,0]]){
 const evidence=`final-acceptance/${rank}/title-font-live-20261103.json`,p=JSON.parse(await readFile(`${root}/${evidence}`,'utf8'));
 if(!p.exact||!p.source.text||!p.source.leaves.length||p.source.font!=='"Noto Sans SC"'||JSON.stringify(p.source)!==JSON.stringify(p.target))throw Error(`FONT_TEXT_NOT_EXACT:${rank}`);
 const path=`${root}/final-acceptance/${rank}/component-ui-mapping.json`,d=JSON.parse(await readFile(path,'utf8')),r=d.rows.find((r:{sourceIndex:number})=>r.sourceIndex===index);
 r.reconciliationHistory=[...(r.reconciliationHistory??[]),{reconciledAt:observedAt,previous:{...r,reconciliationHistory:undefined}}];
 Object.assign(r,{status:'matched',evidence,targetUiVerified:true,fidelityVerified:false,reason:`Actual current source/TEST visible title text and ${p.source.leaves.length} leaf font/color/style samples exact, including inherited Noto Sans SC. Earlier default-font mismatch resolved. This establishes declarations and rendered text, not every external font glyph or whole-card fidelity.`});d.observedAt=observedAt;await writeFile(path,JSON.stringify(d,null,2));rows.push({rank,index,evidence,leafPairs:p.source.leaves.length,browserElapsedMs:p.elapsedMs});
}
for(const file of ['qa-progress.json','continuation-next-20261031.json']){const d=JSON.parse(await readFile(`${root}/${file}`,'utf8'));d.observedAt=observedAt;d.titleFontActualFollowup={observedAt,rows,allFourDeclaredStylesExact:true,fullCardAccepted:0};await writeFile(`${root}/${file}`,JSON.stringify(d,null,2));}
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'title-font-checkpoint-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,browserPageSamples:rows.map(r=>({rank:r.rank,elapsedMs:r.browserElapsedMs}))})+'\n');console.log(JSON.stringify({matchedTitleGates:rows.length,leafPairs:rows.reduce((s,r)=>s+r.leafPairs,0),fullCardAccepted:0}));
