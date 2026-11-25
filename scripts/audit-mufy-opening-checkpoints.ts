#!/usr/bin/env bun
/** Offline integrity/coverage audit only; never grants semantic acceptance. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyMufyScreenshotGeometry} from '../src/lib/import/mufy-fidelity-review';
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020/opening-settled');
const startedAt=new Date().toISOString(),start=performance.now();
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const rows=[];
for(const key of ['qyn','zys','shy','xsj','fml'])for(const surface of ['chat','preview'])for(const width of [390,1280])for(const state of ['initial','expanded','collapsed','reopened']){
  const stem=`${key}-${surface}-${width}-${state}`;
  const r=JSON.parse(await readFile(join(root,stem+'.json'),'utf8'));
  const png=await readFile(join(root,r.screenshot.path));
  if(sha(png)!==r.screenshot.sha256)throw Error('SCREENSHOT_HASH_MISMATCH:'+stem);
  await verifyMufyScreenshotGeometry(png,r.viewport,r.capture,join(root,'coverage-audit.json'));
  if(r.expected.surface!==surface||r.expected.width!==width||r.expected.state!==state||r.coverage.kind!=='opening-and-intro')throw Error('SCOPE_MISMATCH:'+stem);
  rows.push({stem,key,surface,width,state,observedAt:r.observedAt,sha256:r.screenshot.sha256,geometryBound:true,settled:r.openingMeasurement.settle.ok,frames:r.openingMeasurement.frames.length,overflowFrames:r.openingMeasurement.frames.filter((f:{overflowPx:number})=>f.overflowPx>2).length});
}
const timing=(await readFile(join(root,'timing-runs.jsonl'),'utf8')).trim().split('\n').map(x=>JSON.parse(x));
const result={generatedAt:new Date().toISOString(),scope:'opening-checkpoint-integrity-not-semantic-acceptance',finalAccepted:false,nextBatchStarted:false,uniqueStates:rows.length,allCurrentStatesSettled:rows.every(r=>r.settled),geometryBound:rows.filter(r=>r.geometryBound).length,recordedBrowserStepCount:timing.length,recordedBrowserElapsedMs:timing.reduce((n,r)=>n+r.elapsedMs,0),timingScope:'Sum of recorded browser steps only, including preserved non-accepting first attempt; excludes unrecorded work, user waits and scheduling gaps. Not total Agent work time.',rows};
await writeFile(join(root,'coverage-audit.json'),JSON.stringify(result,null,2));
await appendFile(join(root,'compute-timing.jsonl'),JSON.stringify({phase:'opening-coverage-integrity',startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-start})+'\n');
console.log(JSON.stringify({...result,rows:undefined}));
