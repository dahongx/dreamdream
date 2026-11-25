import {readFile,writeFile,mkdir,appendFile,copyFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHECKS,digest,verifyPackage,json,validateRoster,partition,assertAssigned,reviewReport,sourceRole,testBase,inside,type Card,type Roster,type Assignment,type CardReport} from './workflow';
type Core=typeof import('./core');

const args=process.argv.slice(2),command=args.shift(),flag=(name:string)=>{const i=args.indexOf('--'+name);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error('MISSING_OPTION:'+name);return args[i+1];};
const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const exists=async(p:string)=>Bun.file(p).exists();
const save=async(p:string,value:unknown)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});};
async function run(){
 if(!command||command==='help'){console.log('Mufy migration agent\n  doctor\n  init --roster <json> --out <new-job-dir> --runtime <sha256>\n  assign --job <dir> --workers alice,bob\n  claim --job <dir> --worker alice --rank 51\n  scaffold --job <dir> --worker alice --rank 51\n  prepare --job <dir> --worker alice --rank 51 --input <relative-job-input.json>\n  receipt --job <dir> --worker alice --rank 51 --url <8091-chat-url>\n  repair --job <dir> --worker alice --rank 51 --input <relative-public-component.html>\n  review --job <dir> --worker alice --rank 51 --report <relative-job-report.json>\n  merge --job <dir> --runtime <fresh-current-runtime-sha256>\nNo command logs in, accesses a database, calls a model, imports to a website or deploys.');return;}
 const release=await verifyPackage(packageRoot);
 if(command==='doctor'){console.log(JSON.stringify({ok:true,version:release.version,packageId:release.packageId,baselineCommit:release.baselineCommit,codeFilesVerified:release.files.length,distributedReady:false,scope:'single-card-canary-only',databaseAccess:false,networkAccess:false}));return;}
 if(command==='init'){
  const rosterPath=resolve(flag('roster')),raw=await readFile(rosterPath,'utf8'),roster=validateRoster(JSON.parse(raw) as Roster),out=resolve(flag('out')),runtimeFingerprint=flag('runtime');
  if(roster.cards.filter(c=>c.status==='pending'||c.status==='imported').length!==1)throw Error('RELEASE_NOT_CERTIFIED_SINGLE_CARD_CANARY_ONLY');
  if(!/^[a-f0-9]{64}$/.test(runtimeFingerprint))throw Error('RUNTIME_FINGERPRINT_REQUIRED');
  if(await exists(join(out,'job.json')))throw Error('JOB_ALREADY_EXISTS');
  const job={version:1,packageId:release.packageId,rosterSha256:digest(raw),runtimeFingerprint,createdAt:new Date().toISOString()};
  await mkdir(out,{recursive:true});await writeFile(join(out,'roster.json'),raw,{flag:'wx'});await save(join(out,'job.json'),job);
  console.log(JSON.stringify({created:out,packageId:release.packageId,cards:roster.cards.length,held:roster.cards.filter(c=>c.status==='held').length,imported:roster.cards.filter(c=>c.status==='imported').length}));return;
 }
 const root=resolve(flag('job')),job=await json<{packageId:string;rosterSha256:string;runtimeFingerprint:string}>(join(root,'job.json')),rosterRaw=await readFile(join(root,'roster.json'),'utf8'),roster=validateRoster(JSON.parse(rosterRaw) as Roster);
 if(job.packageId!==release.packageId||job.rosterSha256!==digest(rosterRaw))throw Error('JOB_VERSION_OR_ROSTER_CHANGED');
 if(command==='assign'){
  if(await exists(join(root,'assignments')))throw Error('ASSIGNMENTS_ALREADY_EXIST');
  const assignments=partition(roster,flag('workers').split(','),release.packageId,job.rosterSha256);
  await mkdir(join(root,'assignments'));for(const a of assignments)await save(join(root,'assignments',a.worker+'.json'),a);
  console.log(JSON.stringify(assignments));return;
 }
 if(command==='merge'){
  if(flag('runtime')!==job.runtimeFingerprint)throw Error('CURRENT_TARGET_RUNTIME_CHANGED');
  const rows=[];for(const original of roster.cards){if(original.status==='held'){rows.push({rank:original.rank,status:'held',reason:original.holdReason});continue;}if(original.status==='accepted'){rows.push({rank:original.rank,status:'previously-accepted-not-recertified',reason:'Coordinator must attach prior evidence or include this card in a fresh assignment.'});continue;}
   const path=join(root,'reports',original.rank+'.json');if(!await exists(path)){rows.push({rank:original.rank,status:'pending',errors:['REPORT_MISSING']});continue;}
   const report=await json<CardReport>(path);const card=await withReceipt(original,root);const result=await reviewReport(root,report,card,release.packageId);if(report.runtimeFingerprint!==job.runtimeFingerprint)result.errors.push('RUNTIME_CHANGED');rows.push({rank:card.rank,status:result.errors.length?'pending':'passed',errors:result.errors});
  }
  const summary={observedAt:new Date().toISOString(),packageId:release.packageId,rows,eligible:rows.filter(r=>r.status==='passed'||r.status==='pending').length,previouslyAccepted:rows.filter(r=>r.status==='previously-accepted-not-recertified').length,passed:rows.filter(r=>r.status==='passed').length,held:rows.filter(r=>r.status==='held').length,readyForHumanReview:rows.every(r=>r.status==='passed'||r.status==='held'||r.status==='previously-accepted-not-recertified'),published:false};
  await mkdir(join(root,'summaries'),{recursive:true});const out=join(root,'summaries',Date.now()+'.json');await save(out,summary);console.log(JSON.stringify({...summary,report:out}));if(!summary.readyForHumanReview)process.exitCode=2;return;
 }
 const worker=flag('worker'),rank=Number(flag('rank'));if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/.test(worker))throw Error('INVALID_WORKER');
 const assignment=await json<Assignment>(join(root,'assignments',worker+'.json'));assertAssigned(assignment,rank,worker,release.packageId,job.rosterSha256);
 const original=roster.cards.find(c=>c.rank===rank);if(!original||original.status==='held'||original.status==='accepted')throw Error('CARD_NOT_IN_ACTIVE_SCOPE');
 const claimPath=join(root,'claims',rank+'.json');
 if(command==='claim'){await save(claimPath,{worker,rank,packageId:release.packageId,claimedAt:new Date().toISOString()});console.log(JSON.stringify({claimed:rank,worker}));return;}
 const claim=await json<{worker:string;packageId:string}>(claimPath);if(claim.worker!==worker||claim.packageId!==release.packageId)throw Error('CLAIM_OWNER_MISMATCH');
 const work=join(root,'workers',worker,String(rank));await mkdir(work,{recursive:true});const startedAt=new Date().toISOString(),tick=performance.now();
 try{
  if(command==='scaffold'){
   const card=await withReceipt(original,root),path=join(work,'templates','card-report.json');
   await save(path,{version:1,packageId:release.packageId,rank,sourceKey:card.sourceKey,sourceUrl:card.sourceUrl,targetUrl:card.targetUrl??'',runtimeFingerprint:job.runtimeFingerprint,inventory:{observedAt:null,componentIds:[],features:{}},components:[],checks:CHECKS.map(id=>({id,status:'blocked',reason:'尚未实际检查；完成观察后填写事实、真实时间及证据',observedAt:null,elapsedMs:0,artifacts:[],visualReviewed:false})),replies:[],unresolved:['尚未完成来源清单与逐项实际验收；此模板不能提交通过']});
   console.log(JSON.stringify({rank,template:path,accepted:false,note:'Copy the template to your working report; populate only actual observations. No check has been performed.'}));return;
  }
  if(command==='receipt'){
   if(original.targetUrl||await exists(join(root,'receipts',rank+'.json')))throw Error('ALREADY_IMPORTED_DO_NOT_DUPLICATE');
   const targetUrl=flag('url'),u=new URL(targetUrl);if(u.origin!==testBase(roster.targetBaseUrl)||!/^\/chat\/[a-f0-9-]{36}$/i.test(u.pathname)||u.search||u.hash)throw Error('INVALID_IMPORT_RECEIPT');
   await save(join(root,'receipts',rank+'.json'),{rank,worker,sourceKey:original.sourceKey,sourceUrl:original.sourceUrl,targetUrl,observedAt:new Date().toISOString(),note:'Receipt is a locator, not acceptance.'});console.log(JSON.stringify({rank,targetUrl,accepted:false}));return;
  }
  if(command==='prepare'){
   if(original.targetUrl||await exists(join(root,'receipts',rank+'.json')))throw Error('ALREADY_IMPORTED_USE_OWNER_REPAIR');
   const inputPath=await inside(root,flag('input')),input=await json<{detail:string;prompt:string;promptSha256:string;rules:string;sourceProof:string;appearance:string}>(inputPath);
   const prompt=await readFile(await inside(root,input.prompt),'utf8');if(digest(prompt)!==input.promptSha256)throw Error('LOCAL_SOURCE_HASH_MISMATCH');
   const detail=await json<Record<string,unknown>>(await inside(root,input.detail)),rules=await json<unknown>(await inside(root,input.rules)),proof=await json<Record<string,unknown>>(await inside(root,input.sourceProof));
   if(detail.characterId!==sourceRole(original.sourceUrl)||detail.name!==original.name||detail.sourceUrl!==original.sourceUrl||detail.publicDomDerived!==true)throw Error('PUBLIC_DETAIL_BINDING_MISMATCH');
   if(proof.sourceUrl!==original.sourceUrl||proof.roleName!==original.name||proof.bodyLoaded!==true||proof.lengthVerified!==true||!Number.isFinite(Date.parse(String(proof.observedAt))))throw Error('LOADED_COMPLETE_SOURCE_PROOF_REQUIRED');
   const lengths=proof.detailLengths as Record<string,unknown>|undefined;
   if(!lengths||['greeting','codeRenderContent','optimizationCode'].some(k=>lengths[k]!==String(detail[k]??'').length))throw Error('PUBLIC_CAPTURE_LENGTH_MISMATCH');
   const core=await import(new URL('./core.mjs',import.meta.url).href) as Core;
   const publicDetail=detail as unknown as Parameters<Core['prepareMufyMigration']>[0]['detail'];
   if(!input.appearance)throw Error('PUBLIC_APPEARANCE_FILE_REQUIRED');
   const appearance=await json<Parameters<Core['preparePublicMigration']>[0]['appearance']>(await inside(root,input.appearance));
   const pipeline=core.preparePublicMigration({detail:publicDetail,prompt,promptSha256:input.promptSha256,rules,appearance}),prepared=pipeline.prepared;
   if(prepared.issues.some((r:{level:string})=>r.level==='error'))throw Error('PREPARATION_FAILED:'+prepared.issues.filter((r:{level:string})=>r.level==='error').map((r:{code:string})=>r.code).join(','));
   const c={...pipeline.character};const normalized:string[]=[];for(const k of Object.keys(c) as (keyof typeof c)[]){const value=c[k];if(typeof value==='string'&&value.includes('\r')){Object.assign(c,{[k]:value.replace(/\r\n?/g,'\n')});normalized.push(k);}}
   const field=(n:string,v:unknown)=>`<${n}><![CDATA[${String(v??'').replaceAll(']]>',']]]]><![CDATA[>')}]]></${n}>`;
   const rulesOut=pipeline.rules;
   const xml=`<?xml version="1.0" encoding="UTF-8"?><mufy-character><元信息>${field('名称',c.name)}${field('性别文本',({male:'男',female:'女',other:'其他',unset:''} as Record<string,string>)[c.gender])}${field('年龄',c.age)}${field('NSFW',c.nsfw)}${field('AI',c.isAi)}${field('内容类型',c.contentType)}${field('头像',c.avatarUrl)}${field('封面图',c.coverImageUrl)}</元信息><标签>${c.tags.map((s:string)=>field('tag',s)).join('')}</标签>${field('角色介绍',c.bio)}${field('作者的话',c.creatorNote)}${field('人设',c.persona)}${field('逆境处理',c.adversity)}${field('默认认知',c.defaultCognition)}${field('招呼语',c.opening)}${field('情节设定',c.plotSetting)}${field('输出设定',c.outputSetting)}${field('样例对话与文风',c.sampleDialogue)}<美化>${field('样式代码',prepared.beautification.globalCss)}</美化>${field('小剧场',prepared.beautification.openingComponent)}${field('正则规则',JSON.stringify(rulesOut))}</mufy-character>`;
   const parsed=core.parseExternalCharacterXml(xml);if(!parsed.ok)throw Error('XML_ROUNDTRIP_PARSE_FAILED');
   if(parsed.value.rules.length!==rulesOut.length)throw Error('XML_RULE_ROUNDTRIP_COUNT_MISMATCH');
   for(const k of Object.keys(c) as (keyof typeof c)[])if(JSON.stringify(parsed.value.character[k])!==JSON.stringify(c[k]))throw Error('XML_ROUNDTRIP_FIELD_MISMATCH:'+k);
   if(parsed.value.openingComponent!==prepared.beautification.openingComponent)throw Error('XML_COMPONENT_ROUNDTRIP_MISMATCH');
   const dir=join(work,'prepared');if(await exists(dir))throw Error('PREPARED_ALREADY_EXISTS');await mkdir(dir);await writeFile(join(dir,'ui-import.xml'),xml,{flag:'wx',mode:0o600});await save(join(dir,'audit.json'),{rank,packageId:release.packageId,promptSha256:input.promptSha256,xmlSha256:digest(xml),normalizedTransferFields:normalized,issues:prepared.issues,accepted:false,sourceArchiveChanged:false});
   console.log(JSON.stringify({rank,prepared:join(dir,'ui-import.xml'),accepted:false,networkAccess:false}));return;
  }
  if(command==='repair'){
   const path=await inside(root,flag('input')),before=await readFile(path,'utf8'),binding=await json<{rank:number;sourceKey:string;sourceUrl:string;sha256:string}>(await inside(root,flag('input')+'.binding.json'));
   if(binding.rank!==rank||binding.sourceKey!==original.sourceKey||binding.sourceUrl!==original.sourceUrl||binding.sha256!==digest(before))throw Error('REPAIR_SOURCE_BINDING_MISMATCH');
   const core=await import(new URL('./core.mjs',import.meta.url).href) as Core,after=core.nativePlayerDocumentPresentation(before);
   if(before===after)throw Error('NO_PROVEN_RECIPE_APPLIES_USE_CODEX_BROWSER_DIAGNOSIS');
   const out=join(work,'proposals',Date.now()+'-player-box-model.html');await mkdir(dirname(out),{recursive:true});await writeFile(out,after,{flag:'wx'});await save(out+'.json',{rank,recipe:'migration-owned-player-box-model',beforeSha256:digest(before),afterSha256:digest(after),originalUnchanged:true,retestRequired:true,deployed:false});console.log(JSON.stringify({proposal:out,retestRequired:true}));return;
  }
  if(command==='review'){
   const report=await json<CardReport>(await inside(root,flag('report'))),card=await withReceipt(original,root),result=await reviewReport(root,report,card,release.packageId);if(report.runtimeFingerprint!==job.runtimeFingerprint)result.errors.push('RUNTIME_CHANGED');
   await save(join(work,'reviews',Date.now()+'.json'),{observedAt:new Date().toISOString(),...result,ok:result.errors.length===0});
   if(result.errors.length){console.log(JSON.stringify({rank,ok:false,repairQueue:result.errors}));process.exitCode=2;return;}
   await save(join(root,'reports',rank+'.json'),report);console.log(JSON.stringify({rank,ok:true,published:false}));return;
  }
  throw Error('UNKNOWN_COMMAND');
 }finally{await appendFile(join(root,'timing.jsonl'),JSON.stringify({rank,worker,command,startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,agentNetMs:null,kind:'local-process-wall'})+'\n');}
}
async function withReceipt(card:Card,root:string):Promise<Card>{if(card.targetUrl)return card;const p=join(root,'receipts',card.rank+'.json');if(!await exists(p))return card;const r=await json<{sourceKey:string;sourceUrl:string;targetUrl:string;observedAt:string}>(p);if(r.sourceKey!==card.sourceKey||r.sourceUrl!==card.sourceUrl)throw Error('RECEIPT_CARD_MISMATCH');return {...card,targetUrl:r.targetUrl,importedAt:r.observedAt,status:'imported'};}
run().catch(e=>{console.error(JSON.stringify({ok:false,error:(e as Error).message}));process.exitCode=1;});
