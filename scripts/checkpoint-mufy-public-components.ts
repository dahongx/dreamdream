/** Merge new source inventory and owner-UI repair evidence without promoting it. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',startedAt=new Date().toISOString(),tick=performance.now();
const read=async(path:string)=>JSON.parse(await readFile(`${root}/${path}`,'utf8'));
const qa=await read('qa-progress.json'),audit=await read('public-component-coverage-audit.json'),receipts=await read('normal-ui-import-receipts.json');
const nativeAudit=await Bun.file(`${root}/native-fragment-style-audit.json`).exists()?await read('native-fragment-style-audit.json'):null;
const nativeEvidence:Record<number,string>={23:'local-native-instructions-ui-check.json',24:'local-native-ornament-ui-check.json',28:'native-host-style-owner-ui-repair.json',30:'local-native-meme-ui-check.json',34:'local-native-pixel-music-ui-check.json',42:'music-layout-owner-ui-repair.json',44:'local-native-black-sidebar-ui-check.json',46:'native-host-style-owner-ui-repair.json',48:'local-native-music-ui-check.json'};
if(receipts.rows.length!==28||new Set(receipts.rows.map((r:{rank:number})=>r.rank)).size!==28||audit.rows.length!==28)throw Error('PUBLIC_COMPONENT_BASE_COUNT_MISMATCH');
const rows=[];
for(const receipt of receipts.rows as {rank:number}[]){
 const source=audit.rows.find((r:{rank:number})=>r.rank===receipt.rank);
 const repairPath=`final-acceptance/${receipt.rank}/missing-components-owner-ui-repair.json`;
 const repair=await Bun.file(`${root}/${repairPath}`).exists()?await read(repairPath):null;
 const nativePath=nativeEvidence[receipt.rank]?`final-acceptance/${receipt.rank}/${nativeEvidence[receipt.rank]}`:null;
 const native=nativePath&&await Bun.file(`${root}/${nativePath}`).exists()?await read(nativePath):null;
 const row={rank:receipt.rank,sourceInventoryObserved:source.inventoryObserved===true,sourceObservedAt:source.sourceObservedAt??null,sourceComponents:source.frames?.length??null,possibleSnapshotGaps:source.possibleGaps??[],explicitUiCoverage:source.coverage??null,ownerUiRepair:repair?{evidence:repairPath,observedAt:repair.observedAt,saved:repair.ownerUiSaved===true,reloaded:repair.observedAfterFreshNavigation===true,newInlineComponentsRendered:repair.allExpectedRendered??null}:null,nativeHostStyle:{diagnosticCandidates:nativeAudit?.rows.find((r:{rank:number})=>r.rank===receipt.rank)?.fragments??[],uiEvidence:native?{path:nativePath,observedAt:native.observedAt,ownerUiSaved:native.ownerUiSaved===true,deployed:native.deployed===true,localOnly:native.ownerUiSaved===false}:null},fullFidelityAccepted:false};
 const target=qa.rows.find((r:{rank:number})=>r.rank===receipt.rank);if(!target)throw Error('QA_ROW_MISSING');target.publicComponentFollowup=row;rows.push(row);
}
const result={observedAt:new Date().toISOString(),imported:28,held:2,sourceInventories:rows.filter(r=>r.sourceInventoryObserved).length,ownerUiRepairsRecorded:rows.filter(r=>r.ownerUiRepair?.saved&&r.ownerUiRepair?.reloaded).map(r=>r.rank),fullyAccepted:0,rows,productionTouched:false,databaseTouched:false,testBuildStarted:false,coordination:'Human requested no further cross-window messages; continue independently',agentNetMs:null};
if(qa.rows.some((r:{fullFidelityAccepted?:boolean})=>r.fullFidelityAccepted===true))throw Error('UNRECONCILED_FULL_ACCEPTANCE');
qa.observedAt=result.observedAt;
await writeFile(`${root}/public-components-followup.json`,JSON.stringify(result,null,2));
await writeFile(`${root}/qa-progress.json`,JSON.stringify(qa,null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({phase:'public-component-evidence-reconciliation',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,timingKind:'local-process-wall-not-agent-net',agentNetMs:null})+'\n');
console.log(JSON.stringify({inventories:result.sourceInventories,ownerUiRepairs:result.ownerUiRepairsRecorded,fullyAccepted:0}));
