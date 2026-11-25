/** Local-only all-source identity audit. No network, credentials, database or top-100 cutoff. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { localIdentityFacts } from '../src/lib/import/mufy-local-identity';
import { decideIdentity } from '../src/lib/import/mufy-identity-decision';
import { openingNarrativeText } from '../src/lib/import/mufy-opening-comparison';
type Candidate={roleId:string;name:string;author:string;favorites:number;likes:number;chats:number};
type Observation={key:string;query:string;observedAt:string;candidates:Candidate[]};
type Source={key:string;name:string;promptSha256:string};
type Live={roleId:string;name:string;status:string;observedAt:string;greeting?:string;description?:string;codeRenderContent?:unknown;age?:number;publicText?:string};
const started=Date.now(), startedAt=new Date().toISOString();
const dir=resolve(process.argv[2]??'logs/mufy-profiles/full-20261013');
const out=join(dir,'all-local-screening');await mkdir(out,{recursive:true});
async function read<T>(n:string):Promise<T>{return JSON.parse(await readFile(join(dir,n),'utf8'));}
const sources=await read<Source[]>('sources.json');
const observations=(await read<Observation[]>('observations.json')).filter(o=>o.candidates.length);
const job=await read<{archive:string}>('job.json');
const wanted=new Set(observations.map(o=>o.key)),sourceMap=new Map(sources.map(s=>[s.key,s]));
const lives=new Map<string,Live>();
const failedReads=new Map<string,{observedAt:string;reason:string}>();
type Manual={sourceKey:string;roleId:string;status:string;reason:string;differences:string[];evidence:string;supplementalCandidate?:boolean};
const manual=new Map<string,Manual>();
try{for(const r of JSON.parse(await readFile(join(out,'manual-reviews.json'),'utf8')).reviews as Manual[])manual.set(r.sourceKey+'|'+r.roleId,r);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
// An index name may belong to a side character. Explicitly reviewed matches may
// reuse another archive's existing search snapshot; never invent metadata or
// mutate observations.json, and retain that candidate's original snapshot time.
const snapshotCandidates=new Map(observations.flatMap(o=>o.candidates.map(c=>[c.roleId,{candidate:c,observedAt:o.observedAt}] as const)));
const supplementalObservedAt=new Map<string,string>();
for(const review of manual.values())if(review.supplementalCandidate&&review.status==='confirmed'){
 const observation=observations.find(o=>o.key===review.sourceKey);
 if(!observation)throw new Error('Supplemental match source is outside the local base');
 if(observation.candidates.some(c=>c.roleId===review.roleId))continue;
 const snapshot=snapshotCandidates.get(review.roleId);
 if(!snapshot)throw new Error('Supplemental match has no existing search snapshot');
 observation.candidates=[...observation.candidates,{...snapshot.candidate}];
 supplementalObservedAt.set(review.sourceKey+'|'+review.roleId,snapshot.observedAt);
}
for(const name of ['selection-live-evidence.json','identity-live-evidence.json']){
 for(const row of (await read<{records:Live[]}>(name)).records){const prev=lives.get(row.roleId);if(row.status==='found'&&(!prev||row.observedAt>prev.observedAt))lives.set(row.roleId,row);}
}
try{for(const row of JSON.parse(await readFile(join(out,'browser-evidence.json'),'utf8')).records as (Live&{reason?:string})[]){if(row.status==='found')lives.set(row.roleId,row);else if(row.status==='unavailable')failedReads.set(row.roleId,{observedAt:row.observedAt,reason:row.reason??'公开页面未能正常显示，无法核对人物身份'});}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
type Local={primaryName:string|null;persona:string;opening:string;age:number|null};
const local=new Map<string,Local>();
try{const cached=JSON.parse(await readFile(join(out,'private-local-cache.json'),'utf8')) as {rows:{key:string;hash:string;local:Local}[]};for(const row of cached.rows)if(wanted.has(row.key)&&row.hash===sourceMap.get(row.key)?.promptSha256)local.set(row.key,row.local);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
if(local.size!==wanted.size){
const child=spawn('D:/program/anaconda3/Library/bin/zstd.exe',['-dc',job.archive]);child.stderr.resume();
const exited=new Promise<void>((ok,fail)=>{child.once('error',fail);child.once('close',code=>code===0?ok():fail(new Error('Archive failed '+code)));});
for await(const line of createInterface({input:child.stdout,crlfDelay:Infinity})){
 const item=JSON.parse(line) as {character_key:string;text:string};if(!wanted.has(item.character_key))continue;
 const hash=createHash('sha256').update(item.text).digest('hex');if(hash!==sourceMap.get(item.character_key)?.promptSha256)throw new Error('Archive fingerprint mismatch');
 const persona=item.text.match(/<CharaPrompt[^>]*>([\s\S]*?)<\/CharaPrompt>/i)?.[1]??'';
 const opening=item.text.match(/<Greeting[^>]*>([\s\S]*?)<\/Greeting>/i)?.[1]??'';
 const facts=localIdentityFacts(persona);local.set(item.character_key,{primaryName:facts.name,persona,opening,age:facts.age});
}
await exited;if(local.size!==wanted.size)throw new Error('Missing local archives');
await writeFile(join(out,'private-local-cache.json'),JSON.stringify({rows:[...local].map(([key,value])=>({key,hash:sourceMap.get(key)?.promptSha256,local:value}))}),{mode:0o600});
}
const pairs=observations.flatMap(o=>o.candidates.map(c=>{
 const base=local.get(o.key)!;const live=lives.get(c.roleId);
 const failedRead=failedReads.get(c.roleId);
 // Inventory exclusion is a migration decision, not a reason to deny identity.
 // A different age alone cannot fail a proven identity match.
 const identity=decideIdentity(o.query,{...base,age:null},live,[]);
 const ageDifference=base.age!==null&&typeof live?.age==='number'&&base.age!==live.age;
 let status=identity.status==='confirmed'?'confirmed':live?'needs-review':'awaiting-public-evidence';
 let reason=identity.reason;
 if(identity.status==='reject'){status='needs-review';reason='本地索引名与解析出的主角名不同，需复核是否多角色或解析错误，不能自动排除';}
 if(identity.status==='pending')reason='公开片段未满足强对应证据，需继续比较人物身份、关系和世界观；不是不对应结论';
 if(ageDifference&&status==='confirmed')reason+='；年龄元数据有差异，人物对应保留，版本差异另核对';
 const directText=live?.publicText;
 let publicPassageCount=0;
 const actor=base.primaryName??o.query;
 // Browser text confirms only exact long local narrative and the named actor together.
 if(directText){
  const plain=directText.replace(/^\s*-\s+(?:text|generic|paragraph|strong|emphasis|heading[^:]*):\s*/gm,'').replace(/\{\{\s*user\s*\}\}|mufyer|\buser\b/gi,'PLAYER');
  const norm=(v:string)=>openingNarrativeText(v.replace(/\{\{\s*user\s*\}\}|mufyer|\buser\b/gi,'PLAYER')).replace(/[^\p{L}\p{N}]/gu,'');
  const b=norm(plain),a=norm(base.opening);
  const segments=[...new Set((base.opening+'\n'+base.persona).split(/[\n。！？!?]/).map(norm).filter(t=>t.length>=45&&t.length<=400&&!/禁止|指令|回复|生成|输出|格式|代码|必须|模型|严禁/.test(t)))];
  const shared=segments.filter(t=>b.includes(t));publicPassageCount=shared.length;
  if(b.includes(norm(actor))&&((a.length>=150&&b.includes(a))||(shared.length>=2&&shared.reduce((n,t)=>n+t.length,0)>=160))){status='confirmed';reason='浏览器公开页主角对应，完整开场或多段长叙事事实一致（忽略标点、排版和user占位符）；不要求新版全文一致';}
 }
 if(live&&status==='needs-review'){
  const publicChars=directText?.length??((live.greeting?.length??0)+(live.description?.length??0)+(typeof live.codeRenderContent==='string'?live.codeRenderContent.length:0));
  const sharedCount=directText?publicPassageCount:('sharedPassageCount' in identity?identity.sharedPassageCount:0);
  reason+=`；已读取公开文本${publicChars}字符，取得长片段对应${sharedCount}处，本地解析主角为${actor}。尚缺人物身份/关系/世界观的充分交叉证据，保留不确定，不判为不可用。`;
 }
 const review=manual.get(o.key+'|'+c.roleId);if(review&&live){status=review.status;reason=review.reason;}
 if(!live&&failedRead){status='needs-review';reason='不能确定：'+failedRead.reason+'；该候选已记录读取失败，继续其他档案，不视为人物不对应。';}
 return {sourceKey:o.key,sourceName:o.query,roleId:c.roleId,name:c.name,author:c.author,favorites:c.favorites,likes:c.likes,chats:c.chats,status,reason,evidence:review?.evidence??identity.evidence??(status==='confirmed'?'browser-public-long-passages':null),differences:review?.differences??[],publicPassageCount,ageDifference,localAge:base.age,publicAge:live?.age??null,publicObservedAt:live?.observedAt??failedRead?.observedAt??null,publicReadFailed:!live&&!!failedRead,searchObservedAt:supplementalObservedAt.get(o.key+'|'+c.roleId)??o.observedAt,candidateOrigin:supplementalObservedAt.has(o.key+'|'+c.roleId)?'manual-reuse-existing-search-snapshot':'original-search-snapshot',url:'https://chat.mufy.ai/chat?roleId='+c.roleId};
}));
const pairGroups=new Map<string,typeof pairs>();
for(const p of pairs){if(!pairGroups.has(p.sourceKey))pairGroups.set(p.sourceKey,[]);pairGroups.get(p.sourceKey)!.push(p);}
const rows=observations.map(o=>{
 const ps=pairGroups.get(o.key)!,yes=ps.filter(p=>p.status==='confirmed'),reviewed=ps.filter(p=>p.publicObservedAt);
 const publicReadComplete=reviewed.length===ps.length;
 // Reading every candidate is not a completed semantic review. Generic matcher
 // uncertainty must not inflate coverage; require an explicit per-pair decision.
 const semanticComplete=ps.every(p=>p.publicReadFailed||manual.has(o.key+'|'+p.roleId));
 const processed=yes.length>0||(publicReadComplete&&semanticComplete);
 const reasons=ps.filter(p=>p.publicObservedAt).map(p=>`${p.name}：${p.reason}`);
 return {sourceKey:o.key,sourceName:o.query,status:yes.length?'confirmed':ps.every(p=>p.status==='not-corresponding')?'not-corresponding':reviewed.length?'needs-review':'awaiting-public-evidence',processed,publicReadComplete,semanticComplete,reason:yes.length?'已取得人物对应证据':reasons.length?reasons.join('；'):'全部候选尚缺公开详情，未判断是否对应',candidateCount:ps.length,publicEvidenceCount:reviewed.length,confirmedRoleIds:yes.map(p=>p.roleId),confirmedNames:yes.map(p=>p.name),multipleConfirmed:yes.length>1};
});
const counts=rows.reduce<Record<string,number>>((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{});
const unsettled=new Set(rows.filter(r=>!r.processed).map(r=>r.sourceKey));
const exactName=(s:string)=>s.normalize('NFKC').replace(/[\s()（）·]/g,'').toLowerCase();
const missing=pairs.filter(p=>unsettled.has(p.sourceKey)&&p.status==='awaiting-public-evidence').sort((a,b)=>Number(exactName(b.name)===exactName(b.sourceName))-Number(exactName(a.name)===exactName(a.sourceName)));
const queue=[...new Map(missing.map(p=>[p.roleId,{roleId:p.roleId,name:p.name,sourceKey:p.sourceKey,sourceName:p.sourceName,url:p.url}])).values()];
const semanticQueue=rows.filter(r=>r.publicReadComplete&&!r.processed).map(r=>({sourceKey:r.sourceKey,sourceName:r.sourceName,candidates:pairGroups.get(r.sourceKey)!.filter(p=>!p.publicReadFailed&&!manual.has(r.sourceKey+'|'+p.roleId)).map(p=>({roleId:p.roleId,name:p.name,url:p.url}))}));
const summary={version:3,phase:'offline-comparison-pass',startedAt,updatedAt:new Date().toISOString(),localArchives:rows.length,pairs:pairs.length,counts,processedArchives:rows.filter(r=>r.processed).length,unprocessedArchives:rows.filter(r=>!r.processed).length,publicReadCompleteArchives:rows.filter(r=>r.publicReadComplete).length,awaitingSemanticReviewArchives:semanticQueue.length,publicRoleEvidence:lives.size,remainingPublicRoles:queue.length,complete:rows.every(r=>r.processed),activeMs:Date.now()-started,serverWrites:0,policy:'one-row-per-local-archive; reading-not-semantic-completion; identity-separated-from-inventory; age-only-not-blocking; record-specific-uncertainty-and-continue; no-top100-cutoff'};
await writeFile(join(out,'decisions.json'),JSON.stringify({summary,rows,pairs},null,2));
await writeFile(join(out,'browser-read-queue.json'),JSON.stringify({createdAt:summary.updatedAt,rows:queue},null,2));
await writeFile(join(out,'semantic-review-queue.json'),JSON.stringify({createdAt:summary.updatedAt,rows:semanticQueue},null,2));
const csv=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
const labels:Record<string,string>={confirmed:'已确认对应','not-corresponding':'现有候选不对应','needs-review':'暂不能确定','awaiting-public-evidence':'尚缺公开详情'};
await writeFile(join(out,'本地全量对应筛选.csv'),'\uFEFF'+[['本地档案名','本地编号','筛选结论','本份是否已完成本轮检查','判断依据或不能确定的具体原因','候选数量','已读公开详情数量','已确认线上角色','已确认角色ID','多卡对应需复核'],...rows.map(r=>[r.sourceName,r.sourceKey,labels[r.status],r.processed?'是':'否',r.reason,r.candidateCount,r.publicEvidenceCount,r.confirmedNames.join('；'),r.confirmedRoleIds.join('；'),r.multipleConfirmed?'是':'否'])].map(r=>r.map(csv).join(',')).join('\r\n'));
await appendFile(join(out,'timing-runs.jsonl'),JSON.stringify(summary)+'\n');
console.log(JSON.stringify(summary,null,2));
