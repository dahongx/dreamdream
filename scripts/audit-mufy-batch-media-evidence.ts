/** Reconcile existing public-DOM observations, never infer full-card acceptance. */
import { readFile, writeFile, readdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const startedAt=new Date().toISOString(), tick=performance.now();
const read=async(path:string)=>JSON.parse(await readFile(join(root,path),'utf8'));
const receipts=await read('normal-ui-import-receipts.json');
type ImageFact={source?:string;complete?:boolean;naturalWidth?:number;naturalHeight?:number};
const countImages=(images:ImageFact[])=>({instances:images.length,loaded:images.filter(i=>i.complete&&Number(i.naturalWidth)>0).length,pending:images.filter(i=>i.complete===false).length,failed:images.filter(i=>i.complete===true&&i.naturalWidth===0).length});
const rows=[];
for(const receipt of receipts.rows as {rank:number;sourceKey:string}[]){
 const directory=`final-acceptance/${receipt.rank}`;
 const files=await readdir(join(root,directory)).catch(()=>[] as string[]);
 const targetFile=files.includes('visible-media-read.json')?'visible-media-read.json':files.includes('target-media-settled-check.json')?'target-media-settled-check.json':null;
 const sourceFile=files.includes('source-visible-media-read.json')?'source-visible-media-read.json':files.includes('source-media-comparison.json')?'source-media-comparison.json':null;
 const target=targetFile?await read(`${directory}/${targetFile}`):null;
 const source=sourceFile?await read(`${directory}/${sourceFile}`):null;
 const evidence=[targetFile,sourceFile].filter((v):v is string=>v!==null).map(v=>`${directory}/${v}`);
 const images:ImageFact[]=Array.isArray(target?.images)?target.images:[];
 const sourceImages:ImageFact[]=source?.images??source?.matchedSourceImages??[];
 rows.push({rank:receipt.rank,evidence,targetObservedAt:target?.observedAt??null,sourceObservedAt:source?.observedAt??null,targetImages:countImages(images),sourceImages:countImages(sourceImages),skippedFrames:Array.isArray(target?.skipped)?target.skipped.length:Array.isArray(target?.skippedFrames)?target.skippedFrames.length:null,hasPublicMediaPair:!!target&&!!source,fullFidelityAccepted:false,note:'Only saved observed DOM instances. Missing evidence, zero images, uninspected/hidden frames and source failure parity never imply whole-card pass.'});
}
if(rows.length!==28||new Set(rows.map(r=>r.rank)).size!==28)throw Error('MEDIA_BASE_MISMATCH');
const result={observedAt:new Date().toISOString(),imported:28,held:2,fullFidelityAccepted:0,pairedPublicObservations:rows.filter(r=>r.hasPublicMediaPair).length,rows,agentNetMs:null};
await writeFile(join(root,'media-evidence-index.json'),JSON.stringify(result,null,2)+'\n');
await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({phase:'media-evidence-reconciliation',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,timingKind:'local-process-wall-not-agent-net',agentNetMs:null})+'\n');
console.log(JSON.stringify({rows:rows.length,pairs:result.pairedPublicObservations,fullyAccepted:0}));
