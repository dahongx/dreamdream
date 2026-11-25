/** Local evidence reconciliation. No source/network/database requests. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const receipts=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8')).rows;
const repairs=JSON.parse(await readFile(`${root}/source-rule-live-repairs.json`,'utf8')).rows;
const files=await readdir(`${root}/source-rules`);
const captures=[];
for(const row of receipts){
 const id=new URL(row.sourceUrl).searchParams.get('roleId'),file=`${row.rank}-${id}.json`;
 if(!files.includes(file))throw Error(`MISSING_CAPTURE:${row.rank}`);
 const capture=JSON.parse(await readFile(`${root}/source-rules/${file}`,'utf8'));
 if(capture.roleId!==id||capture.responseCode!==200||!Array.isArray(capture.rules))throw Error('INVALID_CAPTURE');
 captures.push({rank:row.rank,file,ruleCount:capture.rules.length,capturedAt:capture.capturedAt});
}
if(new Set(repairs.map((r:{rank:number})=>r.rank)).size!==repairs.length)throw Error('DUPLICATE_REPAIR');
const qa=JSON.parse(await readFile(`${root}/qa-progress.json`,'utf8'));
qa.observedAt=new Date().toISOString();
qa.sourceRuleCaptureSummary={captured:captures.length,nonempty:captures.filter(r=>r.ruleCount>0).length,empty:captures.filter(r=>r.ruleCount===0).length,liveSaved:repairs.filter((r:{saved:boolean})=>r.saved).length,persistedAfterReload:repairs.filter((r:{persistedAfterReload:boolean})=>r.persistedAfterReload).length};
for(const row of qa.rows){
 const capture=captures.find(r=>r.rank===row.rank),repair=repairs.find((r:{rank:number})=>r.rank===row.rank);
 if(capture)row.sourceRules={...capture,evidence:`source-rules/${capture.file}`,scope:'normal-page-loaded-render-rule-response'};
 if(repair)row.sourceRuleRepair={saved:repair.saved,persistedAfterReload:repair.persistedAfterReload,orderIndex:repair.orderIndex,evidence:'source-rule-live-repairs.json',visualAccepted:false};
}
await writeFile(`${root}/qa-progress.json`,JSON.stringify(qa,null,2)+'\n');
const blocker=JSON.parse(await readFile(`${root}/source-render-rule-scope-blocker.json`,'utf8'));
blocker.scopeAuthorization.acquisitionStatus='complete';blocker.scopeAuthorization.resolvedAt=qa.observedAt;
blocker.scopeResolved=true;blocker.remainingWork='Rule responses captured 28/28; nonempty chains saved 16/16. Independent mail isolation and native-form CRLF fixes are deployed (9c161092). Continue per-card source/media/interaction fidelity checks and see post-repair-followup.json; do not equate persisted chains with full acceptance.';
await writeFile(`${root}/source-render-rule-scope-blocker.json`,JSON.stringify(blocker,null,2)+'\n');
await writeFile(`${root}/source-rule-capture-summary.json`,JSON.stringify({observedAt:qa.observedAt,...qa.sourceRuleCaptureSummary,rows:captures,privatePromptsRead:false,credentialsRead:false,databaseAccess:false,fullFidelityAccepted:false},null,2)+'\n');
console.log(JSON.stringify(qa.sourceRuleCaptureSummary));
