/** Start the already-authorized next five. File inventory only; no prompt/DB/network access. */
import {readFile,writeFile,mkdir,appendFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const base=resolve('logs/mufy-profiles/full-20261013'),manifestPath=join(base,'next-batch-5-20261019.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as {stage:string;timing:{startedAt:string|null;status:string};rows:Array<{name:string;sourceKey:string;sourceUrl:string}>};
const release=JSON.parse(await readFile(join(base,'pilot-5/final-acceptance-20261020/release-closeout.json'),'utf8')) as {versionClosed:boolean;rows:Array<{accepted:boolean}>};
if(!release.versionClosed||release.rows.length!==5||release.rows.some(r=>!r.accepted))throw Error('PRIOR_RELEASE_GATE_REQUIRED');
if(manifest.rows.length!==5)throw Error('EXACTLY_FIVE_REQUIRED');
const startedAt=new Date().toISOString(),t=performance.now(),runId=manifest.timing.startedAt??startedAt,dir=join(base,'next-batch-5-20261019');await mkdir(dir,{recursive:true});
const rows=[];
for(const r of manifest.rows){
 const files=[];for(const name of ['public-detail.json','prompt.txt','prepared-local-preview.json','dry-run-issues.json']){
  const p=join(base,'preflight-sources',r.sourceKey,name);let info;try{const s=await stat(p);info={exists:true,bytes:s.size};}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;info={exists:false,bytes:0};}files.push({name,...info});
 }
 let diagnosticCodes:string[]=[];try{const d=JSON.parse(await readFile(join(base,'preflight-sources',r.sourceKey,'dry-run-issues.json'),'utf8')) as {issues:Array<{code:string}>};diagnosticCodes=d.issues.map(i=>i.code);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 rows.push({...r,files,diagnosticCodes,sourceBrowserStatus:'pending-normal-public-ui',testInventoryStatus:'pending-normal-ui',migrated:false});
}
manifest.stage='public-ui-preflight-in-progress';manifest.timing.startedAt??=startedAt;manifest.timing.status='running-preflight-not-migrated';
await writeFile(manifestPath,JSON.stringify(manifest,null,2));
await writeFile(join(dir,'preflight-state.json'),JSON.stringify({runId,startedAt:manifest.timing.startedAt,observedAt:new Date().toISOString(),scope:'Inventory metadata and prior diagnostic codes only. No private source extraction, database scripts, uploads or server writes.',rows,serverWrites:0,databaseOperations:0},null,2));
await appendFile(join(dir,'timing-runs.jsonl'),JSON.stringify({runId,stepId:'local-input-inventory-'+startedAt,kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok'})+'\n');
console.log(JSON.stringify({runId,stage:manifest.stage,rows:rows.map(r=>({name:r.name,available:r.files.filter(f=>f.exists).map(f=>f.name),diagnosticCodes:r.diagnosticCodes})),serverWrites:0},null,2));
