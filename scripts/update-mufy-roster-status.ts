/** Frozen top-100 metadata/status only. No source prompt, network or DB access. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='logs/mufy-profiles/full-20261013';
const startedAt=new Date().toISOString(),tick=performance.now();
const original=await readFile(`${base}/最终100角色名单.txt`,'utf8');
const frozenHash=createHash('sha256').update(original).digest('hex');
const priorPlan=JSON.parse(await readFile(`${base}/next-batch-5-20261019.json`,'utf8'));
if(frozenHash!==priorPlan.sourceRosterSha256)throw Error('FROZEN_ROSTER_CHANGED');
const own=JSON.parse(await readFile(`${base}/test-own-inventory-20261028.json`,'utf8')) as {observedAt:string;rows:{name:string;href:string}[]};
const holds=JSON.parse(await readFile(`${base}/next-batch-10-20261023/deferred-four-20261028.json`,'utf8')) as {rows:{sourceKey:string;reason:string}[]};
const publicRelease=JSON.parse(await readFile(`${base}/next-batch-10-20261023/public-test-release-20261028.json`,'utf8')) as {rows:{id:string;verified:boolean}[]};
const normalize=(s:string)=>s.replace(/[（(].*?[）)]/g,'').trim();
const rows=original.split(/\r?\n/).filter(l=>/^\d+\t/.test(l)).map(l=>{
 const [rank,name,author,favorites,sourceKey,identityEvidence,sourceUrl]=l.split('\t');
 const target=own.rows.find(r=>normalize(r.name)===normalize(name));
 const hold=holds.rows.find(r=>r.sourceKey===sourceKey);
 const publicEvidence=target&&publicRelease.rows.find(r=>r.verified&&target.href.endsWith(r.id));
 return {rank:Number(rank),name,author,favoritesSnapshot:Number(favorites),sourceKey,identityEvidence,sourceUrl,
  identityStatus:'原100名单已确认对应（本地底稿+公开资料口径）',
  migrationStatus:hold?'暂缓未迁移':target?'已迁移':'未迁移',
  reason:hold?.reason??(target?'已在当前账号角色UI找到；迁移不等于全状态验收':'尚未执行；导入前仍需公开来源与全站库存防重预检'),
  targetUrl:target?`http://115.29.213.73:8091${target.href}`:null,
  publicVerified:!!publicEvidence,fullFidelityAccepted:false,
  acceptanceNote:target?'既有试测及按钮适配证据另存，不升级为全功能/像素级认证':'未验收',
  nextBatch:Number(rank)>=21&&Number(rank)<=50};
});
if(rows.length!==100||new Set(rows.map(r=>r.sourceKey)).size!==100||new Set(rows.map(r=>r.sourceUrl)).size!==100)throw Error('ROSTER_NOT_100_UNIQUE');
const statusPath=`${base}/migration-status-100.json`;
// Never overwrite future progress when refreshing inventory metadata.
if(await Bun.file(statusPath).exists())throw Error('STATUS_EXISTS_RECONCILE_REQUIRED');
const summary={total:100,imported:rows.filter(r=>r.migrationStatus==='已迁移').length,held:rows.filter(r=>r.migrationStatus==='暂缓未迁移').length,notImported:rows.filter(r=>r.migrationStatus==='未迁移').length};
await writeFile(statusPath,JSON.stringify({updatedAt:new Date().toISOString(),sourceRosterSha256:frozenHash,originalRosterUnchanged:true,inventoryObservedAt:own.observedAt,inventoryScope:'current account only; public/all-owner duplicate check pending',summary,rows},null,2));
await writeFile(`${base}/100角色迁移状态.txt`,['原100角色名单迁移状态（原顺序与原名单保持不变）',`更新时间：${new Date().toISOString()}；测试服8091`,`已迁移${summary.imported}；暂缓${summary.held}；未执行${summary.notImported}。已迁移不等于全面验收。`,'序号\t角色\t迁移状态\t原因/待办\t测试地址',...rows.map(r=>[r.rank,r.name,r.migrationStatus,r.reason,r.targetUrl??''].join('\t'))].join('\n'));
const root=`${base}/next-batch-30-20261028`;await mkdir(root,{recursive:true});
const selected=rows.filter(r=>r.nextBatch);
if(selected.length!==30||selected.some(r=>r.migrationStatus!=='未迁移'))throw Error('NEXT30_SCOPE_REQUIRES_RECONCILIATION');
const manifestPath=`${root}/manifest.json`;
if(await Bun.file(manifestPath).exists())throw Error('BATCH_EXISTS_RESUME_REQUIRED');
await writeFile(manifestPath,JSON.stringify({version:1,requested:30,startedAt,sourceRosterSha256:frozenHash,target:'8091-test-only',stage:'normal-ui-preflight',rows:selected.map(r=>({...r,imported:false,accepted:false,sourceBrowserStatus:'pending',inventoryStatus:'own-account-clear-public-inventory-pending',contentScopeStatus:'pending'})),priorHeldRanks:[12,14,16,19],policy:'Preserve original content and roster. Explicitly record blocked/unavailable rows; do not fabricate success or silently substitute.',timingPolicy:'Measured processing intervals separate from browser, generation, build and user waits; no fabricated historical net time.'},null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({step:'initialize-roster-status-and-batch',kind:'local-processing',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,containsLocalFileIo:true,agentNetMs:null})+'\n');
console.log(JSON.stringify({summary,nextBatch:selected.map(r=>({rank:r.rank,name:r.name})),originalRosterUnchanged:true},null,2));
