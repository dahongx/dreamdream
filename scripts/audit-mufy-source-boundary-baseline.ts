/** Offline recognition coverage only, not new UI or whole-card acceptance. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {mufyFixedCanvasBoundary,needsMufyInlineParentShim} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const receipts=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8'));
const rows=[];
for(const receipt of receipts.rows as {rank:number}[]){
 if(receipt.rank===37)continue;
 const source=JSON.parse(await readFile(root+`/final-acceptance/${receipt.rank}/source-public-component-inventory.json`,'utf8'));
 rows.push({rank:receipt.rank,sourceObservedAt:source.observedAt,frames:source.roots[0].frames.map((f:{index:number;html:string})=>({index:f.index,baselineRecognized:mufyFixedCanvasBoundary(f.html,true).includes('data-nj-mufy-source-canvas-boundary'),parentProgramExcluded:needsMufyInlineParentShim(f.html,true)}))});
}
const all=rows.flatMap(r=>r.frames),report={observedAt:new Date().toISOString(),eligibleCards:rows.length,sourceFrames:all.length,baselineRecognized:all.filter(f=>f.baselineRecognized).length,parentProgramsExcluded:all.filter(f=>f.parentProgramExcluded).length,rows,qualification:'Recognition of saved public source baseline only. Parent/reply/skin exclusions and actual import opt-in still govern application. Not proof of175 visible bugs, new browser observations or full-fidelity acceptance.',agentNetMs:null,buildStarted:false,deployed:false,fullFidelityAccepted:false};
if(rows.length!==27||all.length!==175)throw Error('ELIGIBLE_SOURCE_BASE_CHANGED');
await writeFile(root+'/source-boundary-baseline-audit-20261031.json',JSON.stringify(report,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt:report.observedAt,kind:'offline-source-boundary-baseline-recognition-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null})+'\n');
console.log(JSON.stringify({eligibleCards:rows.length,sourceFrames:all.length,recognized:report.baselineRecognized,parentProgramsExcluded:report.parentProgramsExcluded,fullFidelityAccepted:false}));
