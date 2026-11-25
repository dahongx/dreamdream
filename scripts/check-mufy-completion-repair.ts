/** Normal-UI raw reply captures only. No network or database access. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {reviewMufyCompletion} from '../src/lib/import/mufy-completion-contract';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const startedAt=new Date().toISOString(),t=performance.now();
const files=process.argv.slice(2);if(!files.length||files.some(s=>!/^[\w-]+-raw\.txt$/.test(s)))throw Error('EXACT_LOCAL_RAW_CAPTURE_FILES_REQUIRED');
const rows=[];
for(const file of files){const raw=await readFile(root+'/'+file,'utf8');rows.push({file,sha256:createHash('sha256').update(raw).digest('hex'),...reviewMufyCompletion(raw)});}
let consecutivePasses=0;const seen=new Set<string>();
for(const r of rows){if(r.ok&&!seen.has(r.sha256))consecutivePasses++;else consecutivePasses=0;seen.add(r.sha256);}
const result={observedAt:new Date().toISOString(),stage:consecutivePasses>=2?'completion-repair-verified':'repair-and-retest-required',consecutivePasses,requiredConsecutivePasses:2,rows,manualMarkerInsertion:false,sourceArchiveMutations:0};
await writeFile(root+'/completion-repair-review.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'completion-repair-raw-review',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:result.stage})+'\n');
console.log(JSON.stringify(result));
