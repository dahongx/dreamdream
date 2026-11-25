#!/usr/bin/env bun
/** Offline compilation of measured public-browser evidence. Never sends,
 * reads credentials/private prompts, migrates cards, or accesses a database.
 * Explicit per-case human source comparison is required, not inferred here. */
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {verifyMufyReplyEvidence} from '../src/lib/import/mufy-reply-review';
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020');
const captureName=process.argv.includes('--capture-dir')?process.argv[process.argv.indexOf('--capture-dir')+1]:'measured-replies';
const reportName=process.argv.includes('--report-dir')?process.argv[process.argv.indexOf('--report-dir')+1]:'reply-reports';
const reviewName=process.argv.includes('--review-file')?process.argv[process.argv.indexOf('--review-file')+1]:'manual-reply-reviews.json';
if(!/^[a-z0-9-]+\.json$/.test(reviewName))throw Error('LOCAL_REVIEW_FILE_NAME_REQUIRED');
if(!/^[a-z0-9-]+$/.test(captureName)||!/^[a-z0-9-]+$/.test(reportName))throw Error('LOCAL_EVIDENCE_DIRECTORY_NAME_REQUIRED');
const measured=join(root,captureName);
const hash=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const rendererFiles=['src/lib/import/mufy-rendered-opening.ts','src/lib/import/mufy-source-rules.ts','src/lib/import/mufy-source-rule-envelope.ts','src/lib/regex/segments.ts','src/components/chat/MessageBubble.tsx','src/components/chat/MessageRenderer.tsx','src/components/chat/mufy-native-table.module.css','src/lib/import/mufy-native-table.ts','src/lib/regex/iframe-bridge.ts','src/lib/import/mufy-runtime-adaptation.ts','src/components/chat/ChatMessagesList.tsx','src/components/chat/mufy-shared-component-context.ts','src/lib/import/mufy-shared-component-style.ts','src/components/chat/MufyReplySidebar.tsx','src/components/regex/RegexIframe.tsx','src/lib/regex/iframe-incremental.ts','src/lib/chat/mufy-sidebar-owner.ts'];
const rendererSha256=hash((await Promise.all(rendererFiles.map(async f=>`${f}\n${await readFile(f,'utf8')}`))).join('\n'));
type Review={key:string;sourceKey:string;sourceImage:string;targetCharacterId:string;captureOverrides?:Record<string,string>;cases:Array<{index:number;status:string;controlCount:number;systemBoxCount:number;nativeTransparentObserved:boolean;comparison:string;separateControlLabels?:string[]}>};
type Capture={expected:{characterId:string;characterName:string;messageIndex:number;width:390|1280;state:string};url:string;observedAt:string;viewport:{width:number;height:number;devicePixelRatio:number;clientWidth?:number};capture:{original:{path:string;sha256:string}};screenshot:{path:string;sha256:string};focusedMeasurement:{settle:{ok:boolean};host:{height:number;scrollHeight:number;overflowPx:number;text:string;controls:Array<{open:boolean}>;boxes:Array<{background:string;border:string}>;rawSystemTags:number};frames:Array<{height:number;bodyHeight:number;scrollHeight:number;overflowPx:number;text:string;controls:Array<{open:boolean}>;boxes:Array<{background:string;border:string}>;rawSystemTags:number;background:string;htmlBackground:string}>;consoleObservation:{errorCount:number;since:string}}};
const reviews=JSON.parse(await readFile(join(root,reviewName),'utf8')) as {rows:Review[]};
// A report is historical evidence, not a way to relabel old screenshots after
// a renderer deployment. Preflight every card before writing any report.
for(const review of reviews.rows){
  const existing=join(root,reportName,review.key,'reply-report.json');
  if(await Bun.file(existing).exists()){
    const previous=JSON.parse(await readFile(existing,'utf8')) as {rendererSha256?:string};
    if(previous.rendererSha256!==rendererSha256)
      throw Error('RENDERER_VERSION_CHANGED_PRESERVE_EXISTING_EVIDENCE:'+review.key+'; use a new capture/report directory for the new renderer');
  }
}
const results=[];
for(const review of reviews.rows){
  if(review.cases.length<2||review.cases.some(c=>c.status!=='pass')){results.push({key:review.key,ok:false,errors:['HUMAN_SOURCE_REVIEW_PENDING']});continue;}
  const dir=join(root,reportName,review.key);await mkdir(dir,{recursive:true});
  const sourceRuntimeSha256=hash(await readFile(join(root,'..',review.sourceKey,'mufy-runtime-rendered-20261015.json')));
  const binding={sourceRuntimeSha256,targetCharacterId:review.targetCharacterId,rendererSha256};
  async function save(name:string,bytes:string|Uint8Array){await writeFile(join(dir,name),bytes);return{path:name,sha256:hash(bytes)};}
  async function copyChecked(base:string,ref:{path:string;sha256:string}){const b=await readFile(join(base,ref.path));if(hash(b)!==ref.sha256)throw Error('CAPTURE_HASH_MISMATCH:'+ref.path);return save(basename(ref.path),b);}
  const sourceBytes=await readFile(resolve(root,review.sourceImage));
  const sourceScreenshot=await save('source.png',sourceBytes);
  const cases=[];
  for(const c of review.cases){
    const initial=JSON.parse(await readFile(join(measured,`${review.key}-reply-${c.index}-390-initial.json`),'utf8')) as Capture;
    const m0=initial.focusedMeasurement;
    const inputText=[m0.host.text,...m0.frames.map(f=>f.text)].filter(Boolean).join('\n');
    const input=await save(`input-${c.index}.txt`,inputText);
    const sourceObservation=await save(`source-contract-${c.index}.json`,JSON.stringify({sourceRuntimeSha256,inputSha256:input.sha256,detail:c.comparison,contract:{transparentOuter:true,systemBoxCount:c.systemBoxCount,controlCount:c.controlCount}},null,2));
    const observations=[];
    for(const width of [390,1280] as const)for(const state of ['initial','expanded','collapsed','reopened']){
      const stem=`${review.key}-reply-${c.index}-${width}-${state}`;
      const override=captureName==='measured-replies'?review.captureOverrides?.[stem]:undefined;
      const captureBase=override?resolve(root,override):measured;
      if(captureBase!==measured&&!captureBase.startsWith(root+'\\')&&!captureBase.startsWith(root+'/'))throw Error('CAPTURE_OVERRIDE_OUTSIDE_ACCEPTANCE_ROOT');
      const bytes=await readFile(join(captureBase,stem+'.json'));
      const r=JSON.parse(bytes.toString('utf8')) as Capture;
      if(r.expected.characterId!==review.targetCharacterId||r.expected.messageIndex!==c.index||r.expected.width!==width||r.expected.state!==state)throw Error('RAW_REPLY_TARGET_MISMATCH');
      if(captureName!=='measured-replies'&&(r.expected as typeof r.expected & {rendererSha256?:string}).rendererSha256!==rendererSha256)throw Error('RAW_CAPTURE_RENDERER_BINDING_REQUIRED');
      const m=r.focusedMeasurement;if(!m?.settle.ok)throw Error('LAYOUT_NOT_SETTLED:'+stem);
      const allControls=[...m.host.controls,...m.frames.flatMap(f=>f.controls)];
      const separateLabels=c.separateControlLabels??[];
      const separateControls=allControls.filter(item=>'label' in item&&typeof item.label==='string'&&separateLabels.includes(item.label.trim()));
      if(separateControls.length!==separateLabels.length)throw Error('SEPARATE_CONTROL_LABEL_NOT_UNIQUE:'+stem);
      const controls=allControls.filter(item=>!separateControls.includes(item));
      const boxes=[...m.host.boxes,...m.frames.flatMap(f=>f.boxes)];
      const allText=[m.host.text,...m.frames.map(f=>f.text)].join('\n');
      const rawText=await save(stem+'.original-observation.json',bytes);
      const screenshot=await copyChecked(captureBase,r.screenshot);
      const original=await copyChecked(captureBase,r.capture.original);
      const raw={version:1,...binding,kind:'existing-chat-reply',role:'assistant',messageId:`dom-assistant-${c.index}-${input.sha256}`,messageIndex:c.index,inputSha256:input.sha256,state,url:r.url,observedAt:r.observedAt,viewport:r.viewport,capture:{...r.capture,original},metrics:{
        systemBoxCount:boxes.length,unstyledSystemBoxCount:boxes.filter(b=>b.background==='rgba(0, 0, 0, 0)'&&/^0px none/u.test(b.border)).length,
        rawCustomTagCount:m.host.rawSystemTags+m.frames.reduce((n,f)=>n+f.rawSystemTags,0),unresolvedUserNameCount:(allText.match(/mufyer|\{\{user\}\}/giu)||[]).length,
        clippedElementCount:m.frames.filter(f=>f.bodyHeight>f.height+2).length,controlCount:controls.length,expandedCount:controls.filter(c=>c.open).length,consoleErrorCount:m.consoleObservation.errorCount,
        horizontalOverflowPx:m.host.overflowPx,iframeOverflowPx:Math.max(0,...m.frames.map(f=>f.overflowPx)),bodyHeight:m.frames.length?m.frames.reduce((n,f)=>n+f.bodyHeight,0):m.host.height,contentHeight:m.frames.length?m.frames.reduce((n,f)=>n+f.scrollHeight,0):m.host.scrollHeight,
        transparentOuter:m.frames.length?m.frames.every(f=>f.background==='rgba(0, 0, 0, 0)'&&f.htmlBackground==='rgba(0, 0, 0, 0)'):c.nativeTransparentObserved},
        visualStatus:c.status,visualComparison:c.comparison,rawObservation:rawText,measurementScope:'Focused message/frame body bounds; native outer transparency is a pixel-review observation. Console errors observed during this measured browser step, not an assertion about all historical browser logs.'};
      const proof=await save(stem+'.proof.json',JSON.stringify({...raw,separateControls:{status:'outside-reply-panel-scope-not-accepted',controls:separateControls}},null,2));
      observations.push({width,state,proof,screenshot});
    }
    cases.push({input,sourceObservation,sourceScreenshot,observations});
  }
  const report={version:1,scope:'continuous-replies',...binding,cases};
  const reportPath=join(dir,'reply-report.json');await writeFile(reportPath,JSON.stringify(report,null,2));
  const opening=JSON.parse(await readFile(join(root,`${review.key}-chat-390-initial.json`),'utf8')) as {frames:Array<{messageIndex:number;text:string}>};
  const expected={...binding,targetBaseUrl:'http://115.29.213.73:8091',notBefore:'2026-10-19T12:07:49.618Z',openingText:opening.frames.filter(f=>f.messageIndex===0).map(f=>f.text).join('\n')};
  const result=await verifyMufyReplyEvidence(report,expected,reportPath);results.push({key:review.key,...result});
}
await writeFile(join(root,reportName==='reply-reports'?'reply-report-validation.json':reportName+'-validation.json'),JSON.stringify({generatedAt:new Date().toISOString(),scope:'continuous-replies-only-not-complete-migration',results},null,2));
console.log(JSON.stringify(results,null,2));
