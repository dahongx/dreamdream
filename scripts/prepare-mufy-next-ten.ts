/** Offline UI packages from verified local originals and public DOM assets. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {prepareMufyMigration,parseMufyPrompt,sha256,type MufyRoleDetail} from '../src/lib/import/mufy-migration';
import {parseExternalCharacterXml} from '../src/lib/import/external-card';
import {mufyQuoteCompatibilityRules} from '../src/lib/import/mufy-quote-compatibility';
import {mufyStatusIndentRules} from '../src/lib/import/mufy-status-indent';
import {repairMufySidebarBoundary} from '../src/lib/import/mufy-sidebar-boundary';
import {restoreMufyPublicContentCss} from '../src/lib/import/mufy-public-content-css';
import {adaptMufyCompletionContract} from '../src/lib/import/mufy-completion-contract';
import {JSDOM} from 'jsdom';
import {restoreMufyPublicFrameTokens} from '../src/lib/import/mufy-public-frame-tokens';
import {assertMufyXmlRenderCoverage} from '../src/lib/import/mufy-source-rule-requirements';
import {sourceRuleTransfer} from '../src/lib/import/mufy-source-rule-transfer';
import {buildMufyPublicSemanticSkin} from '../src/lib/import/mufy-public-semantic-skin';
import {adaptMufySpeechDecorationCss} from '../src/lib/import/mufy-speech-decoration';
import {adaptMufyAvatarDraftCopy} from '../src/lib/import/mufy-avatar-draft-copy';
import {singleMufyPublicOpeningRoot} from '../src/lib/import/mufy-public-component-coverage';
const batchArg=process.argv.find(a=>a.startsWith('--batch='))?.slice(8);
if(batchArg&&!/^next-batch-30-20261028$/.test(batchArg))throw Error('INVALID_BATCH');
const onlyRank=Number(process.argv.find(a=>a.startsWith('--rank='))?.slice(7)??0);
const rankRange=process.argv.find(a=>a.startsWith('--ranks='))?.slice(8);
if(rankRange&&!/^\d+-\d+$/.test(rankRange))throw Error('INVALID_RANK_RANGE');
const [rankStart,rankEnd]=rankRange?rankRange.split('-').map(Number):[onlyRank,onlyRank];
if(batchArg&&(!Number.isInteger(rankStart)||!Number.isInteger(rankEnd)||rankStart<21||rankEnd>50||rankEnd<rankStart))throw Error('EXPLICIT_REVIEWED_RANK_REQUIRED');
const root=resolve('logs/mufy-profiles/full-20261013/'+(batchArg??'next-batch-10-20261023'));
const startedAt=new Date().toISOString(),tick=performance.now();
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const inventory=JSON.parse(await readFile(join(root,'local-input-inventory.json'),'utf8'));
// Do not prepare these cards for live deployment while content-scope questions remain.
const held=new Set([12,14,16,19,31,37,50]);
const field=(n:string,v:unknown)=>`<${n}><![CDATA[${String(v??'').replaceAll(']]>',']]]]><![CDATA[>')}]]></${n}>`;
const result=[];
for(const row of manifest.rows.filter((r:{rank:number})=>!batchArg||(r.rank>=rankStart&&r.rank<=rankEnd))){
 if(held.has(row.rank)){result.push({...row,status:'held-not-packaged',reason:row.rank===16?'Source explicitly describes age 17; requires non-sexual scope review.':'Family sexual/romantic scenario; no live migration.'});continue;}
 const assetPath=join(root,row.sourceKey+'-public-render-assets.json');
 if(!await Bun.file(assetPath).exists()){result.push({...row,status:'awaiting-public-source'});continue;}
 const assets=JSON.parse(await readFile(assetPath,'utf8'));
 const contentPath=join(root,row.sourceKey+'-public-content.json');
 if(!await Bun.file(contentPath).exists()){result.push({...row,status:'awaiting-full-public-content'});continue;}
 const content=JSON.parse(await readFile(contentPath,'utf8'));
 if(content.lengthVerified!==true||content.sourceUrl!==row.sourceUrl||!content.lengths?.length||content.markdownBlocks.length!==content.lengths.length||content.markdownBlocks.some((b:{html:string},i:number)=>b.html.length!==content.lengths[i])){
  result.push({...row,status:'awaiting-verified-full-public-content'});continue;
 }
 if(row.imported||await Bun.file(join(root,'prepared',row.sourceKey,'import-receipt.json')).exists())throw Error('ALREADY_IMPORTED_DO_NOT_OVERWRITE');
 const snapshot=await readFile(join(root,row.sourceKey+'-public-snapshot.txt'),'utf8');
 const lines=snapshot.split(/\r?\n/),nameIndex=lines.lastIndexOf('- generic: '+row.name);
 const bio=nameIndex>=0?lines[nameIndex+2]?.replace(/^- generic: /,''):null;
 const tags:string[]=[];
 for(let n=nameIndex+3;nameIndex>=0&&n<lines.length&&lines[n].startsWith('- generic: ')&&!lines[n].includes('更新于：');n++)tags.push(lines[n].slice(11));
 // Additional roots may contain zero-area programs with visible parent UI.
 // Do not silently drop them or transplant their arbitrary parent scripts.
 let openingRoot:string;
 try{openingRoot=singleMufyPublicOpeningRoot(content.markdownBlocks);}
 catch(error){result.push({...row,status:'preparation-failed',error:(error as Error).message});continue;}
 const theater=new JSDOM(openingRoot).window.document;
 const frameTokens:string[]=[];
 let publicAvatarCopyHandlers=0;
 for(const frame of theater.querySelectorAll('iframe')){
  const html=frame.getAttribute('srcdoc');
  if(!html){frame.remove();continue;}
  const marker='MUFY_PUBLIC_FRAME_'+frameTokens.length;
  const avatarCopy=adaptMufyAvatarDraftCopy(html);publicAvatarCopyHandlers+=avatarCopy.adapted;
  frameTokens.push('```html\n'+avatarCopy.html+'\n```');
  frame.replaceWith(theater.createTextNode(marker));
 }
 const completeTheater=restoreMufyPublicFrameTokens(theater.body.innerHTML,frameTokens);
 const original=await readFile(join(root,'local-inputs',row.sourceKey,'prompt.txt'),'utf8');
 const local=inventory.rows.find((r:{sourceKey:string})=>r.sourceKey===row.sourceKey);
 if(!local||sha256(original)!==local.promptSha256||assets.sourceUrl!==row.sourceUrl)throw Error('SOURCE_BINDING_MISMATCH');
 const styles=(assets.styles as string[]).filter(s=>!s.startsWith(':where(html[dir=')&&!s.startsWith('[data-vaul-drawer]')&&!s.startsWith('.qJTHM'));
 const detail:MufyRoleDetail={characterId:new URL(row.sourceUrl).searchParams.get('roleId')!,name:row.name,
  avatarUrl:assets.images.find((i:{alt:string})=>i.alt==='')?.src,
  backgroundUrl:assets.images.find((i:{alt:string})=>i.alt==='background')?.src,
  description:bio,tags,creatorDescription:content.authorNote,
  greeting:parseMufyPrompt(original).opening,codeRenderContent:completeTheater,
  optimizationCode:styles.map(s=>'<style>'+s+'</style>').join('\n'),publicDomDerived:true,sourceUrl:row.sourceUrl,observedAt:assets.observedAt};
 try{
 const roleId=new URL(row.sourceUrl).searchParams.get('roleId')!;
 const sourceRulesPath=join(root,'source-rules',`${row.rank}-${roleId}.json`);
 const semanticPath=join(root,'public-semantic-appearance',`${row.rank}-${roleId}.json`);
 const semantic=await Bun.file(semanticPath).exists()?buildMufyPublicSemanticSkin(JSON.parse(await readFile(semanticPath,'utf8')),roleId):undefined;
 // New batches require an actual observed response, even when it is empty.
 // Never turn a missing capture or an invisible settings list into rules=[].
 const transferred=batchArg?sourceRuleTransfer(JSON.parse(await readFile(sourceRulesPath,'utf8')),roleId,detail.optimizationCode??'',assets.images.some((i:{alt:string})=>i.alt==='avatar')?detail.avatarUrl:undefined,semantic?.nativeTextColor):undefined;
 if(transferred)detail.sourceRules=transferred.capture;
 // Plain public opening HTML does not prove that future custom XML replies render.
 // Missing source rules must be explicit, not silently replaced with a native box.
 const sourceFields=parseMufyPrompt(original);
 assertMufyXmlRenderCoverage([sourceFields.opening??'',sourceFields.outputSetting??''],!!transferred?.ruleCount);
 const prepared=prepareMufyMigration({detail,promptRecord:{characterName:local.characterName,prompt:original,source:{origin:'user-provided-local-archive',sha256:local.promptSha256}},adaptRuntime:true,preferLocalAge:true});
 if(transferred)prepared.beautification.replyRender=transferred.envelope;
 if(prepared.issues.some(i=>i.level==='error'))throw Error('PREPARATION_ERRORS:'+prepared.issues.filter(i=>i.level==='error').map(i=>i.code).join(','));
 if(prepared.beautification.openingComponent)prepared.beautification.openingComponent=repairMufySidebarBoundary(prepared.beautification.openingComponent);
 const publicContent=new JSDOM(content.markdownBlocks.map((b:{html:string})=>b.html).join('\n')).window.document;
 const contentClasses=[...publicContent.querySelectorAll('[class]')].flatMap(e=>[...e.classList]);
 const restoredContentCss=restoreMufyPublicContentCss(styles,contentClasses);
 if(restoredContentCss)prepared.beautification.globalCss=restoredContentCss+'\n'+prepared.beautification.globalCss;
 if(semantic)prepared.beautification.globalCss=(prepared.beautification.globalCss??'')+semantic.hostCss;
 // Source avatars consume inline width; author pseudo decorations may extend
 // beyond the bubble. Reserve only an explicit source right inset, never clip
 // the ornament or impose guessed spacing on ordinary cards.
 if(assets.images.some((i:{alt:string})=>i.alt==='avatar'))prepared.beautification.globalCss=adaptMufySpeechDecorationCss(prepared.beautification.globalCss??'').css;
 const dir=join(root,'prepared',row.sourceKey);await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'prepared.json'),JSON.stringify(prepared,null,2),{mode:0o600});
 const c={...prepared.character,outputSetting:adaptMufyCompletionContract(prepared.character.outputSetting??'')||null};
 // XML's standard line-ending normalization is not lost character content.
 // Normalize only the UI transfer copy, explicitly report affected fields,
 // and retain the byte-exact original + prepared-local baseline above.
 const lineEndingFields=Object.entries(c).filter(([,v])=>typeof v==='string'&&v.includes('\r')).map(([k])=>k);
 for(const key of Object.keys(c) as (keyof typeof c)[]){const value=c[key];if(typeof value==='string')Object.assign(c,{[key]:value.replace(/\r\n?/g,'\n')});}
 const rules=[...(transferred?.rules??[]),...mufyQuoteCompatibilityRules([c.opening??''])];
 // Public DOM opt-in only: preserve cards whose actual speech has an avatar.
 if(assets.images.some((i:{alt:string})=>i.alt==='avatar')&&c.avatarUrl){
  rules.push({ruleName:'迁移兼容：公开来源台词头像',regexPattern:'/<(?:message|mes)>([\\s\\S]*?)<\\/(?:message|mes)>/g',replaceString:`<div class="mufy-import-speech-row" style="display:flex;align-items:flex-start;gap:16px;margin:8px 0"><img src="${c.avatarUrl}" alt="角色台词头像" style="width:36px;height:36px;min-width:36px;border-radius:50%;object-fit:cover"/><div class="nj_ai_message_bubble" style="max-width:calc(100% - 52px)">$1</div></div>`,enabled:true,visibility:false});
 }
 rules.push(...mufyStatusIndentRules([c.opening??'',c.outputSetting??'',c.sampleDialogue??'']));
 const gender=({male:'男',female:'女',other:'其他',unset:''} as Record<string,string>)[c.gender];
 const xml=`<?xml version="1.0" encoding="UTF-8"?><mufy-character><元信息>${field('名称',c.name)}${field('性别文本',gender)}${field('年龄',c.age)}${field('NSFW',c.nsfw)}${field('AI',c.isAi)}${field('内容类型',c.contentType)}${field('头像',c.avatarUrl)}${field('封面图',c.coverImageUrl)}</元信息><标签>${c.tags.map(s=>field('tag',s)).join('')}</标签>${field('角色介绍',c.bio)}${field('作者的话',c.creatorNote)}${field('人设',c.persona)}${field('逆境处理',c.adversity)}${field('默认认知',c.defaultCognition)}${field('招呼语',c.opening)}${field('情节设定',c.plotSetting)}${field('输出设定',c.outputSetting)}${field('样例对话与文风',c.sampleDialogue)}<美化>${field('样式代码',prepared.beautification.globalCss)}</美化>${field('小剧场',prepared.beautification.openingComponent)}${field('正则规则',JSON.stringify(rules))}</mufy-character>`;
 const parsed=parseExternalCharacterXml(xml);
 if(!parsed.ok)throw Error('ROUNDTRIP_PARSE_FAILED');
 const changedFields=Object.entries(c).filter(([k,v])=>JSON.stringify(parsed.value.character[k as keyof typeof c])!==JSON.stringify(v)).map(([k])=>k);
 if(parsed.value.openingComponent!==prepared.beautification.openingComponent)changedFields.push('openingComponent');
 if(changedFields.length)throw Error('ROUNDTRIP_MISMATCH:'+changedFields.join(','));
 await writeFile(join(dir,'ui-import.xml'),xml,{mode:0o600});
 result.push({name:row.name,sourceKey:row.sourceKey,status:'draft-needs-source-review',cssChars:prepared.beautification.globalCss?.length,componentChars:prepared.beautification.openingComponent?.length,errors:prepared.issues.filter(i=>i.level==='error'),sourceSpeechAvatar:assets.images.some((i:{alt:string})=>i.alt==='avatar'),publicAvatarCopyHandlers,lineEndingNormalization:{fields:lineEndingFields,transferCopyOnly:true,originalFingerprintUnchanged:true},accepted:false});
 }catch(e){result.push({name:row.name,sourceKey:row.sourceKey,status:'preparation-failed',error:(e as Error).message});}
}
const preparationPath=join(root,'preparation.json');
const previousPreparation=batchArg&&await Bun.file(preparationPath).exists()?JSON.parse(await readFile(preparationPath,'utf8')).rows:[];
const mergedPreparation=batchArg?[...new Map([...previousPreparation,...result].map(r=>[r.sourceKey,r])).values()]:result;
await writeFile(preparationPath,JSON.stringify({startedAt,finishedAt:new Date().toISOString(),rows:mergedPreparation,serverWrites:0},null,2));
await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({stepId:'prepare-local-drafts',kind:'local-processing',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,netWorkMs:null,containsWait:true,waitType:'local-file-io'})+'\n');
console.log(JSON.stringify(result.map(r=>({name:r.name,status:r.status,errors:r.errors,error:r.error,sourceSpeechAvatar:r.sourceSpeechAvatar})),null,2));
