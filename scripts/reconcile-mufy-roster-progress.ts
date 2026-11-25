/** Reconcile observed UI receipts into the frozen roster companion; no network. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isMufyBatch30Rank,withImportedScopeHold} from './lib/mufy-roster-scope';
const base='logs/mufy-profiles/full-20261013',root=`${base}/next-batch-30-20261028`;
const startedAt=new Date().toISOString(),tick=performance.now();
const ledger=JSON.parse(await readFile(`${base}/migration-status-100.json`,'utf8'));
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
if(ledger.rows.length!==100||new Set(ledger.rows.map((row:{rank:number})=>row.rank)).size!==100||new Set(ledger.rows.map((row:{sourceKey:string})=>row.sourceKey)).size!==100)throw Error('FROZEN_ROSTER_KEYS_NOT_UNIQUE');
if(manifest.rows.length!==30||new Set(manifest.rows.map((row:{rank:number})=>row.rank)).size!==30||manifest.rows.some((row:{rank:number})=>!isMufyBatch30Rank(row.rank)))throw Error('EXACT_BATCH_RANKS_REQUIRED');
const outsideBatchBefore=JSON.stringify(ledger.rows.filter((row:{rank:number})=>!isMufyBatch30Rank(row.rank)));
const importedHold=JSON.parse(await readFile(`${root}/final-acceptance/37/scope-review-hold.json`,'utf8'));
if(importedHold.rank!==37||importedHold.fullFidelityAccepted!==false)throw Error('IMPORTED_SCOPE_HOLD_NOT_VERIFIED');
const reads=JSON.parse(await readFile(`${root}/source-browser-progress.json`,'utf8')).rows;
const receipts=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8')).rows;
const mobileChecks=await Bun.file(`${root}/opening-dom-checks.json`).exists()?JSON.parse(await readFile(`${root}/opening-dom-checks.json`,'utf8')):[];
const desktopChecks=await Bun.file(`${root}/desktop-dom-checks.json`).exists()?JSON.parse(await readFile(`${root}/desktop-dom-checks.json`,'utf8')):[];
const replyAudit=await Bun.file(`${root}/reply-evidence-audit.json`).exists()?JSON.parse(await readFile(`${root}/reply-evidence-audit.json`,'utf8')).rows:[];
const liveTrials=await Bun.file(`${root}/daily-trial-progress.json`).exists()?JSON.parse(await readFile(`${root}/daily-trial-progress.json`,'utf8')):[];
const sourceRepairs=await Bun.file(`${root}/source-rule-live-repairs.json`).exists()?JSON.parse(await readFile(`${root}/source-rule-live-repairs.json`,'utf8')).rows:[];
// Explicit final reviews are separate from creation receipts and partial DOM checks.
const finalReviews=await Bun.file(`${root}/acceptance-results.json`).exists()?JSON.parse(await readFile(`${root}/acceptance-results.json`,'utf8')).rows:[];
if(createHash('sha256').update(await readFile(`${base}/最终100角色名单.txt`)).digest('hex')!==ledger.sourceRosterSha256)throw Error('FROZEN_ROSTER_CHANGED');
for(const row of ledger.rows){
 if(!isMufyBatch30Rank(row.rank))continue;
 row.acceptanceStatus='未验收';
 const read=reads.find((r:{sourceKey:string})=>r.sourceKey===row.sourceKey);
 const receipt=receipts.find((r:{sourceKey:string})=>r.sourceKey===row.sourceKey);
 if(read){row.sourceBrowserStatus='公开来源已采集（不代表迁移或验收通过）';row.sourceObservedAt=read.observedAt;if(row.migrationStatus==='未迁移')row.reason='公开展示/样式已采集；待完整范围核查、导入和逐卡验收';}
 if(receipt){row.migrationStatus='已迁移待验收';row.reason='正常网页已创建私密卡；手机/桌面、真实回复及来源一致性验收尚未完成';row.targetUrl=receipt.editUrl.replace(/\/edit$/,'');row.importReceipt=`next-batch-30-20261028/normal-ui-import-receipts.json`;row.fullFidelityAccepted=false;row.acceptanceNote='未验收';}
 if(receipt){
  const mobile=mobileChecks.find((r:{rank:number})=>r.rank===row.rank);
  const desktop=desktopChecks.find((r:{rank:number})=>r.rank===row.rank);
  row.layoutEvidence={mobile:mobile?'next-batch-30-20261028/opening-dom-checks.json':null,desktop:desktop?'next-batch-30-20261028/desktop-dom-checks.json':null};
  row.acceptanceStatus=`待完整验收；${mobile?'手机开场DOM已查；':''}${desktop?'桌面布局DOM已查；':''}不等于视觉/交互或多轮回复通过`;
  const reply=replyAudit.find((r:{rank:number})=>r.rank===row.rank);
  const live=Array.isArray(liveTrials)?liveTrials.find((r:{rank:number})=>r.rank===row.rank):undefined;
  if(reply?.replies?.length){
   row.replyEvidence='next-batch-30-20261028/reply-evidence-audit.json';
   row.observedReplyRounds=reply.replies.length;
   row.reason=`已取得${reply.replies.length}轮回复原文证据；完整原站渲染规则、交互与美化一致性未关闭，不等于验收通过`;
  }
  if(live?.renderFailure)row.reason=`已创建私密测试卡；真实测试发现原站转换规则缺口：${live.renderFailure}`;
  const sourceRepair=sourceRepairs.find((r:{rank:number})=>r.rank===row.rank);
  if(sourceRepair?.saved&&sourceRepair?.persistedAfterReload){
   row.sourceRuleRepairEvidence='next-batch-30-20261028/source-rule-live-repairs.json';
   row.sourceRuleRepairStatus='原站完整有序渲染链已通过正常网页补入；重载确认保存且顺序为0';
   row.reason='原站规则缺口已补齐并确认保存；已有回复的组件、颜色、交互与来源一致性仍需逐项复验';
   if(live?.renderFailure)row.historicalRenderFailure=live.renderFailure;
  }
  if(live?.providerContentFilterObserved)row.reason=`已创建私密测试卡；曾有模型截断，失败证据保留；不绕过过滤。具体结果见daily-trial-progress.json，未作完整验收`;
  const review=finalReviews.find((r:{sourceKey:string})=>r.sourceKey===row.sourceKey);
  if(review){
   row.acceptanceNote=review.note;
   row.acceptanceEvidence='next-batch-30-20261028/acceptance-results.json';
   if(review.conclusion==='accepted'&&review.fullFidelityAccepted===true&&Array.isArray(review.evidence)&&review.evidence.length>0){
    row.migrationStatus='已迁移已验收';row.fullFidelityAccepted=true;row.accepted=true;
    row.acceptanceStatus='本批迁移验收通过（以记录的版本和证据范围为准）';row.reason=review.note;
   }
  }
 }
 if(row.rank===31||row.rank===50){row.migrationStatus='暂缓未迁移';row.reason=row.rank===31?'本地角色与玩家明确为已婚姐夫关系且含性内容；不能协助原样迁移，不自动换卡':'本地角色与玩家明确为亲生兄妹且含性内容；不能协助原样迁移，不自动换卡';row.processingStage='assistant-content-scope-hold';row.scopeEvidence='next-batch-30-20261028/local-scope-review-facts.json';}
 if(row.rank===37){if(!receipt)throw Error('HELD_IMPORTED_RECEIPT_MISSING');Object.assign(row,withImportedScopeHold(row,importedHold,'next-batch-30-20261028/final-acceptance/37/scope-review-hold.json'));}
}
if(JSON.stringify(ledger.rows.filter((row:{rank:number})=>!isMufyBatch30Rank(row.rank)))!==outsideBatchBefore)throw Error('OUTSIDE_BATCH_HISTORY_CHANGED');
for(const row of manifest.rows){const current=ledger.rows.find((r:{sourceKey:string})=>r.sourceKey===row.sourceKey);Object.assign(row,current);row.inventoryStatus='current-own-and-public-UI-no-exact-name-conflict; identity-level-check-before-import';if(receipts.some((r:{sourceKey:string})=>r.sourceKey===row.sourceKey))row.imported=true;}
ledger.updatedAt=new Date().toISOString();ledger.summary={total:100,imported:ledger.rows.filter((r:{migrationStatus:string})=>r.migrationStatus.startsWith('已迁移')).length,held:ledger.rows.filter((r:{migrationStatus:string})=>r.migrationStatus==='暂缓未迁移').length,notImported:ledger.rows.filter((r:{migrationStatus:string})=>r.migrationStatus==='未迁移').length};
if(Object.values(ledger.summary).slice(1).reduce((a,b)=>Number(a)+Number(b),0)!==100)throw Error('STATUS_RECONCILIATION_FAILED');
manifest.updatedAt=ledger.updatedAt;manifest.stage='imports-and-acceptance-in-progress';
if(await Bun.file(`${root}/browser-blocker.json`).exists()){
 const blocker=JSON.parse(await readFile(`${root}/browser-blocker.json`,'utf8'));
 if(!blocker.resolved){manifest.stage='awaiting-browser-control-recovery';manifest.blocker='browser-blocker.json';}
}
manifest.summary={requested:30,sourceCaptured:reads.length,imported:receipts.length,held:manifest.rows.filter((r:{migrationStatus:string})=>r.migrationStatus==='暂缓未迁移').length,accepted:manifest.rows.filter((r:{fullFidelityAccepted:boolean})=>r.fullFidelityAccepted===true).length};
manifest.additionalImportedScopeHoldRanks=[37];ledger.additionalImportedScopeHoldRanks=[...new Set([...(ledger.additionalImportedScopeHoldRanks??[]),37])];
await writeFile(`${base}/migration-status-100.json`,JSON.stringify(ledger,null,2));
 await writeFile(`${base}/100角色迁移状态.txt`,['原100角色名单迁移状态（原顺序与原名单保持不变）',`更新时间：${ledger.updatedAt}；测试服8091`,`已迁移${ledger.summary.imported}（含待验收）；暂缓${ledger.summary.held}；未迁移${ledger.summary.notImported}。已迁移不等于全面验收。`,'序号\t角色\t迁移状态\t验收状态\t原因/待办\t测试地址',...ledger.rows.map((r:{rank:number;name:string;migrationStatus:string;acceptanceStatus:string;reason:string;targetUrl:string|null})=>[r.rank,r.name,r.migrationStatus,r.acceptanceStatus,r.reason,r.targetUrl??''].join('\t'))].join('\n'));
await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2));
await writeFile(`${root}/roster-reconciliation-proof-20261101.json`,JSON.stringify({observedAt:ledger.updatedAt,batchRanks:[21,50],frozenRosterSha256:ledger.sourceRosterSha256,originalRosterUnchanged:true,outsideBatchRows:70,outsideBatchRowsSha256:createHash('sha256').update(outsideBatchBefore).digest('hex'),outsideBatchHistoryUnchanged:true,roster:ledger.summary,batch:manifest.summary,additionalImportedScopeHoldRanks:[37],fullFidelityAccepted:false,scope:'Local metadata only; no held character content inspected, no target mutation'},null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({step:'reconcile-roster-observed-progress',kind:'local-processing',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,containsLocalFileIo:true,agentNetMs:null})+'\n');
console.log(JSON.stringify({roster:ledger.summary,batch:manifest.summary,additionalImportedScopeHoldRanks:[37],originalRosterUnchanged:true,outsideBatchHistoryUnchanged:true}));
