/** Stage frozen roster ranks 11–20 from the user-provided archive. No network/DB. */
import {readFile, writeFile, mkdir, appendFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {parseMufyPrompt} from '../src/lib/import/mufy-migration';

const base=resolve('logs/mufy-profiles/full-20261013');
const batchArg=process.argv.find(a=>a.startsWith('--batch='))?.slice(8);
if(batchArg&&!/^next-batch-30-20261028$/.test(batchArg))throw Error('INVALID_BATCH');
const onlyRank=Number(process.argv.find(a=>a.startsWith('--rank='))?.slice(7)??0);
const rankRange=process.argv.find(a=>a.startsWith('--ranks='))?.slice(8);
if(rankRange&&!/^\d+-\d+$/.test(rankRange))throw Error('INVALID_RANK_RANGE');
const [rankStart,rankEnd]=rankRange?rankRange.split('-').map(Number):[onlyRank,onlyRank];
if(batchArg&&(!Number.isInteger(rankStart)||!Number.isInteger(rankEnd)||rankStart<21||rankEnd>50||rankEnd<rankStart))throw Error('EXPLICIT_REVIEWED_RANK_REQUIRED');
if(batchArg&&[31,50].some(r=>r>=rankStart&&r<=rankEnd))throw Error('CONTENT_SCOPE_HOLD_DO_NOT_STAGE');
const root=join(base,batchArg??'next-batch-10-20261023');
const startedAt=new Date().toISOString(), tick=performance.now();
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const roster=await readFile(join(base,'最终100角色名单.txt'),'utf8');
const rows=roster.split(/\r?\n/).filter(l=>/^\d+\t/.test(l)).map(l=>{
 const [rank,name,author,favorites,sourceKey,identityEvidence,sourceUrl]=l.split('\t');
 return {rank:Number(rank),name,author,favoritesSnapshot:Number(favorites),sourceKey,identityEvidence,sourceUrl};
}).filter(r=>batchArg?r.rank>=rankStart&&r.rank<=rankEnd:r.rank>=11&&r.rank<=20);
const expectedCount=batchArg?rankEnd-rankStart+1:10;
if(rows.length!==expectedCount||new Set(rows.map(r=>r.sourceKey)).size!==expectedCount||new Set(rows.map(r=>r.sourceUrl)).size!==expectedCount)throw Error('EXPECTED_UNIQUE_ROSTER_ROWS_REQUIRED');
const oldPlan=JSON.parse(await readFile(join(base,'next-batch-5-20261019.json'),'utf8')) as {sourceRosterSha256:string};
if(hash(roster)!==oldPlan.sourceRosterSha256)throw Error('FROZEN_ROSTER_CHANGED');
await mkdir(root,{recursive:true});
const planPath=join(root,'manifest.json');
if(!await Bun.file(planPath).exists())await writeFile(planPath,JSON.stringify({version:1,batchSize:10,startedAt,stage:'local-staging',sourceRosterSha256:hash(roster),target:'8091-test-only',rows:rows.map(r=>({...r,imported:false,accepted:false})),acceptance:['source-specific speech avatars','opening and scene layout','disclosure styling and alignment','actual animation','fixed widgets through streaming and scroll','two real replies','mobile and desktop','no leaked completion markers'],timingPolicy:'Record execution intervals and waits separately. Do not call total elapsed or browser/network/build latency net work. Historical setup preceding this manifest is not backfilled.'},null,2));
const sources=JSON.parse(await readFile(join(base,'sources.json'),'utf8')) as Array<{key:string;promptSha256:string}>;
const wanted=new Map(rows.map(r=>{const s=sources.find(s=>s.key===r.sourceKey);if(!s)throw Error('SOURCE_MISSING');return[r.sourceKey,{...r,promptSha256:s.promptSha256}]}));
const job=JSON.parse(await readFile(join(base,'job.json'),'utf8')) as {archive:string};
const child=spawn('D:/program/anaconda3/Library/bin/zstd.exe',['-dc',job.archive]);
child.stderr.resume();
const done=new Promise<void>((ok,fail)=>{child.once('error',fail);child.once('close',c=>c===0?ok():fail(Error('ARCHIVE_READ_FAILED:'+c)))});
const inventory=[];
for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})){
 const record=JSON.parse(line) as {character_key:string;character_name:string;text:string};
 const selected=wanted.get(record.character_key);if(!selected)continue;
 if(hash(record.text)!==selected.promptSha256)throw Error('FINGERPRINT_MISMATCH:'+selected.sourceKey);
 const dir=join(root,'local-inputs',selected.sourceKey);await mkdir(dir,{recursive:true});
 const path=join(dir,'prompt.txt');
 if(await Bun.file(path).exists()){if(hash(await readFile(path,'utf8'))!==selected.promptSha256)throw Error('EXISTING_SOURCE_CHANGED');}
 else await writeFile(path,record.text,{mode:0o600});
 const fields=parseMufyPrompt(record.text);
 inventory.push({...selected,characterName:record.character_name,sectionLengths:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,typeof v==='string'?v.length:0]))});
}
await done;
if(inventory.length!==expectedCount)throw Error('ARCHIVE_RECORD_COUNT:'+inventory.length);
const finishedAt=new Date().toISOString(),elapsedMs=performance.now()-tick;
const inventoryPath=join(root,'local-input-inventory.json');
const previousInventory=batchArg&&await Bun.file(inventoryPath).exists()?JSON.parse(await readFile(inventoryPath,'utf8')).rows:[];
const mergedInventory=batchArg?[...new Map([...previousInventory,...inventory].map(r=>[r.sourceKey,r])).values()]:inventory;
await writeFile(inventoryPath,JSON.stringify({startedAt,finishedAt,rows:mergedInventory,serverWrites:0,databaseOperations:0},null,2));
await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({stepId:'stage-original-local-archive',kind:'local-processing',startedAt,finishedAt,elapsedMs,containsWait:true,waitType:'local-archive-io',netWorkMs:null,status:'ok'})+'\n');
console.log(JSON.stringify({staged:inventory.length,elapsedMs,rows:inventory.map(r=>({rank:r.rank,name:r.name,sourceKey:r.sourceKey,verified:true}))},null,2));
