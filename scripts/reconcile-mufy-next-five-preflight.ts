/** Offline reconciliation of next-five public UI observations. No imports or server writes. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const base=resolve('logs/mufy-profiles/full-20261013'),root=join(base,'next-batch-5-20261019');
const startedAt=new Date().toISOString(),t=performance.now();
type Row={name:string;sourceKey:string;sourceBrowserStatus:string;testInventoryStatus:string;localBaselineStatus?:string;files:Array<{name:string;exists:boolean}>;diagnosticCodes:string[]};
const state=JSON.parse(await readFile(join(root,'preflight-state.json'),'utf8')) as {runId:string;rows:Row[]};
const inventory=JSON.parse(await readFile(join(root,'test-inventory-observation.json'),'utf8')) as {paginationVisible:boolean;duplicateMatches:Array<{name:string;matches:unknown[]}>};
const localInventory=await Bun.file(join(root,'local-input-inventory.json')).exists()?JSON.parse(await readFile(join(root,'local-input-inventory.json'),'utf8')) as {rows:Array<{sourceKey:string}>}:null;
for(const row of state.rows){
 const source=JSON.parse(await readFile(join(root,row.sourceKey+'-public-observation.json'),'utf8')) as {loaded:boolean;denied:boolean;elapsedMs:number;startedAt:string;observedAt:string};
 row.sourceBrowserStatus=source.loaded&&!source.denied?'name-and-public-body-loaded':'needs-normal-ui-attention';
 row.localBaselineStatus=localInventory?.rows.some(r=>r.sourceKey===row.sourceKey)?'local-archive-input-fingerprint-verified':'not-staged';
 row.testInventoryStatus=!inventory.paginationVisible&&!inventory.duplicateMatches.find(r=>r.name===row.name)?.matches.length?'no-same-name-in-current-owner-library':'requires-duplicate-review';
}
const findings=state.rows.flatMap(row=>[
 ...(!row.files.find(f=>f.name==='prepared-local-preview.json'&&f.exists)?[{name:row.name,code:'PREPARED_INPUT_MISSING',detail:row.localBaselineStatus==='local-archive-input-fingerprint-verified'?'Original local archive input is now staged and fingerprint-verified; a complete prepared migration bundle with current public components/rules still needs validation.':'The public page is loaded, but a full validated migration input is not staged. Do not substitute public bio for a full card.'}]:[]),
 ...(row.diagnosticCodes.includes('PREPARATION_EXCEPTION')?[{name:row.name,code:'OLD_CONVERTER_REJECTED_MIXED_STYLE_CONTENT',detail:'Preserve and inspect the actual input before using generic adaptation; do not discard creator content or mark migrated.'}]:[]),
]);
await writeFile(join(root,'preflight-state.json'),JSON.stringify({...state,updatedAt:new Date().toISOString(),publicPagesLoaded:state.rows.filter(r=>r.sourceBrowserStatus==='name-and-public-body-loaded').length,inventoryScope:'Normal UI of the logged-in owner only, not a global database inventory.',migrationStarted:false,migratedCount:0,findings,nextAction:'Prepare complete source-bound inputs and confirm the normal website import path can retain opening components plus future-reply rules; do not execute old direct-database migration scripts.',serverWrites:0,databaseOperations:0},null,2));
// Preserve original timing lines; add an explicit correction explaining that
// public observedAt precedes file-save completion. The measured elapsedMs is
// real monotonic read-and-save time, never an estimate of entire Agent labor.
await writeFile(join(root,'timing-policy.json'),JSON.stringify({policy:'Page elapsedMs measures a fresh public read and evidence save, excluding navigation/loading before the measured read. In initial public-read lines finishedAt was recorded at observedAt before save; use startedAt + measured elapsedMs for the step completion interval. This correction does not change original observations or add unmeasured navigation/idle time.',allTimesMeasured:true,wholeAgentLaborClaimed:false},null,2));
const pilotRoot=join(base,'pilot-5/final-acceptance-20261020');
const release=JSON.parse(await readFile(join(pilotRoot,'release-closeout.json'),'utf8')) as Record<string,unknown>;
release.nextBatchStarted=true;release.nextBatchScope='public-ui-preflight-only-not-migrated';release.nextBatchCheckpoint='../../next-batch-5-20261019/preflight-state.json';
await writeFile(join(pilotRoot,'release-closeout.json'),JSON.stringify(release,null,2));
const remaining=JSON.parse(await readFile(join(pilotRoot,'remaining-acceptance.json'),'utf8')) as Record<string,unknown>;
remaining.nextBatchStarted=true;remaining.nextBatchScope='public-ui-preflight-only-not-migrated';
await writeFile(join(pilotRoot,'remaining-acceptance.json'),JSON.stringify(remaining,null,2));
await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({runId:state.runId,stepId:'reconcile-public-preflight-'+startedAt,kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok'})+'\n');
console.log(JSON.stringify({publicPagesLoaded:state.rows.filter(r=>r.sourceBrowserStatus==='name-and-public-body-loaded').length,sameNameDuplicatesInCurrentLibrary:inventory.duplicateMatches.reduce((n,r)=>n+r.matches.length,0),migrated:0,findings},null,2));
