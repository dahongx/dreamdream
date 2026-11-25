/** Local-only preparation. UI persistence and live acceptance remain separate. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {prepareMufyMigration,parseMufyPrompt,sha256,type MufyRoleDetail} from '../src/lib/import/mufy-migration';
import {parseExternalCharacterXml} from '../src/lib/import/external-card';
import {hasMufyAdaptedComponent} from '../src/lib/import/mufy-native-table';
import {missingMufyDisclosureStyles} from '../src/lib/import/mufy-reply-style-coverage';
import {mufyQuoteCompatibilityRules} from '../src/lib/import/mufy-quote-compatibility';
import {adaptMufyCompletionContract} from '../src/lib/import/mufy-completion-contract';
const t=performance.now(),startedAt=new Date().toISOString();
const base=resolve('logs/mufy-profiles/full-20261013'),root=join(base,'next-batch-5-20261019');
const planPath=join(base,'next-batch-5-20261019.json');
const plan=JSON.parse(await readFile(planPath,'utf8'));
if(await Bun.file(join(root,'normal-ui-import-receipts.json')).exists())throw Error('ALREADY_IMPORTED_USE_LIVE_ACCEPTANCE_CHECKPOINT');
const gate=JSON.parse(await readFile(join(base,'pilot-5/final-acceptance-20261020/remaining-acceptance.json'),'utf8'));
if(!gate.versionClosed||gate.rows.length!==5||gate.rows.some((r:{accepted:boolean})=>!r.accepted))throw Error('PRIOR_PILOT_NOT_CLOSED');
const inventory=JSON.parse(await readFile(join(root,'local-input-inventory.json'),'utf8'));
const rows=[];
for(const r of plan.rows){
 const prompt=await readFile(join(root,'local-inputs',r.sourceKey,'prompt.txt'),'utf8');
 const local=inventory.rows.find((v:{sourceKey:string})=>v.sourceKey===r.sourceKey);
 if(!local||sha256(prompt)!==local.promptSha256)throw Error('LOCAL_ARCHIVE_CHANGED');
 let p=join(base,'preflight-sources',r.sourceKey,'public-detail.json');
 let detail:MufyRoleDetail;
 if(await Bun.file(p).exists())detail=JSON.parse(await readFile(p,'utf8')) as MufyRoleDetail;
 else {
  const publicPath=join(root,r.sourceKey+'-public-render-assets.json');
  if(!await Bun.file(publicPath).exists()){rows.push({...r,stage:'needs-public-visual-assets',promptVerified:true,migrated:false});continue;}
  const assets=JSON.parse(await readFile(publicPath,'utf8'));
  if(assets.sourceUrl!==r.sourceUrl||!assets.frames?.length)throw Error('PUBLIC_RENDER_ASSET_SOURCE_MISMATCH');
  const hostPath=join(root,r.sourceKey+'-public-host-styles.json');
  const styles=assets.styles??(await Bun.file(hostPath).exists()?JSON.parse(await readFile(hostPath,'utf8')).styles:[]);
  detail={characterId:new URL(r.sourceUrl).searchParams.get('roleId')!,name:r.name,greeting:parseMufyPrompt(prompt).opening,backgroundUrl:assets.images.find((i:{alt:string})=>i.alt==='background')?.src??null,codeRenderContent:assets.frames.map((f:{html:string})=>'```html\n'+f.html+'\n```').join('\n\n'),optimizationCode:styles.map((s:string)=>'<style>'+s+'</style>').join('\n'),publicDomDerived:true,greetingOrigin:'user-provided-local-archive',sourceUrl:r.sourceUrl,observedAt:assets.observedAt};
  p=join(root,'local-inputs',r.sourceKey,'public-dom-derived-detail.json');
  await writeFile(p,JSON.stringify(detail,null,2));
 }
 const pagePath=join(root,r.sourceKey+'-public-20261022.txt');
 if(await Bun.file(pagePath).exists()){
  const lines=(await readFile(pagePath,'utf8')).split(/\r?\n/);
  const authorIndex=lines.findIndex(l=>l.includes('厨子の厨艺分享'));
  if(authorIndex>=0&&lines[authorIndex+1]?.startsWith('- generic: '))detail.creatorDescription=lines[authorIndex+1].slice(11);
  if(detail.publicDomDerived){
   const nameIndex=lines.lastIndexOf('- generic: '+r.name);
   if(nameIndex>=0){
    detail.description=lines[nameIndex+2]?.replace(/^- generic: /,'')??null;
    const tags=[];for(let n=nameIndex+3;n<lines.length&&lines[n].startsWith('- generic: ')&&!lines[n].includes('更新于：');n++)tags.push(lines[n].slice(11));
    detail.tags=tags;
   }
  }
 }
 const step=performance.now(),stepStartedAt=new Date().toISOString();
 try{
  const prepared=prepareMufyMigration({detail,promptRecord:{characterName:local.characterName,prompt,source:{origin:'user-provided-local-archive',sha256:local.promptSha256}},adaptRuntime:true,preferLocalAge:true});
  if(!prepared.beautification.openingComponent||!hasMufyAdaptedComponent([{content:prepared.beautification.openingComponent}]))throw Error('UI_RUNTIME_PROVENANCE_MARKER_MISSING');
  const missingStyles=missingMufyDisclosureStyles([prepared.character.opening??'',prepared.character.outputSetting??''],prepared.beautification.globalCss??'');
  // A class name alone does not prove a missing style: generic details rules,
  // ancestor rules and inline styles may legitimately provide its skin.
  // Fail closed for verified reusable source skins; review other classes in UI.
  const missingKnownSkin=missingStyles.filter(v=>['Cmtt_fold_block','Cmtt_summary','m-state-fold','m-state-wrapper'].includes(v));
  if(missingKnownSkin.length)throw Error('PUBLIC_DISCLOSURE_STYLE_CAPTURE_INCOMPLETE:'+missingKnownSkin.join(','));
  const dir=join(root,'prepared',r.sourceKey);await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'prepared.json'),JSON.stringify(prepared,null,2),{mode:0o600});
  // Source fields remain in prepared.json for audit; only the UI compatibility
  // copy coordinates the creator suffix with host boundary ordering.
  const c={...prepared.character,outputSetting:adaptMufyCompletionContract(prepared.character.outputSetting??'')||null};
  const field=(name:string,value:unknown)=>{
   const encoded=name==='性别文本'?({male:'男',female:'女',other:'其他',unset:''} as Record<string,string>)[String(value)]:value;
   return `<${name}><![CDATA[${String(encoded??'').replaceAll(']]>',']]]]><![CDATA[>')}]]></${name}>`;
  };
  const xml=`<?xml version="1.0" encoding="UTF-8"?><mufy-character><元信息>${field('名称',c.name)}${field('性别文本',c.gender)}${field('年龄',c.age)}${field('NSFW',c.nsfw)}${field('AI',c.isAi)}${field('内容类型',c.contentType)}${field('头像',c.avatarUrl)}${field('封面图',c.coverImageUrl)}</元信息><标签>${c.tags.map(s=>field('tag',s)).join('')}</标签>${field('角色介绍',c.bio)}${field('作者的话',c.creatorNote)}${field('人设',c.persona)}${field('逆境处理',c.adversity)}${field('默认认知',c.defaultCognition)}${field('招呼语',c.opening)}${field('情节设定',c.plotSetting)}${field('输出设定',c.outputSetting)}${field('样例对话与文风',c.sampleDialogue)}<美化>${field('样式代码',prepared.beautification.globalCss)}</美化>${field('小剧场',prepared.beautification.openingComponent)}</mufy-character>`;
  const quoteRules=mufyQuoteCompatibilityRules([c.opening??'']);
  const finalXml=xml.replace('</mufy-character>',(quoteRules.length?field('正则规则',JSON.stringify(quoteRules)):'')+'</mufy-character>');
  const roundtrip=parseExternalCharacterXml(finalXml);
  if(roundtrip.ok&&roundtrip.value.rules.length!==quoteRules.length)throw Error('UI_COMPATIBILITY_RULE_ROUNDTRIP_FAILED');
  if(!roundtrip.ok||Object.entries(c).some(([key,value])=>JSON.stringify(roundtrip.value.character[key as keyof typeof c])!==JSON.stringify(value))||roundtrip.value.openingComponent!==prepared.beautification.openingComponent)throw Error('UI_XML_ROUNDTRIP_FAILED');
  await writeFile(join(dir,'ui-import.xml'),finalXml,{mode:0o600});
  rows.push({...r,stage:'prepared-awaiting-component-capable-ui-import',promptVerified:true,detailSha256:sha256(await readFile(p,'utf8')),fieldLengths:Object.fromEntries(Object.entries(prepared.character).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,(v as string).length])),componentChars:prepared.beautification.openingComponent?.length??0,cssChars:prepared.beautification.globalCss?.length??0,issues:prepared.issues.map(i=>({level:i.level,code:i.code})),sourceRuleCapturePresent:!!detail.sourceRules,migrated:false});
  await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({runId:startedAt,stepId:'prepare-'+r.sourceKey,kind:'compute',startedAt:stepStartedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-step,status:'ok'})+'\n');
 }catch(e){rows.push({...r,stage:'preparation-failed',error:(e as Error).message,migrated:false});}
}
const result={startedAt,finishedAt:new Date().toISOString(),rows,migratedCount:0,serverWrites:0,databaseOperations:0,requiredNext:['Public source component/rule verification','Normal UI import retaining complete opening components','Actual mobile/desktop and continuous-reply acceptance']};
await writeFile(join(root,'preparation-20261022.json'),JSON.stringify(result,null,2));
plan.stage='preparing-normal-ui-migration';plan.holdReason=null;plan.priorPilotAcceptance='pilot-5/final-acceptance-20261020/scoped-release-closeout-20261021.json';plan.timing.status='running-preparation-not-migrated';plan.timing.currentRunStartedAt=startedAt;
await writeFile(planPath,JSON.stringify(plan,null,2));
await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({runId:startedAt,stepId:'prepare-five-local-bundles',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok',includesChildSpans:true})+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,stage:r.stage,componentChars:r.componentChars,cssChars:r.cssChars,error:r.error})),null,2));
