/** Compile fresh, version-bound public observations; visual review remains mandatory. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {FIDELITY_CHECKS,verifyFidelityEvidenceFiles,type FidelityArtifact,type FidelityEvidence} from '../src/lib/import/mufy-fidelity-review';
const root=resolve('logs/mufy-profiles/full-20261013/pilot-5/final-acceptance-20261020');
const captureRoot=join(root,'opening-release');
const sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
type Review={key:string;sourceKey:string;targetCharacterId:string;sourceImage:string;rendererSha256:string;checks:Record<typeof FIDELITY_CHECKS[number],{status:string;detail:string}>;mediaExceptions:Array<{url:string;reason:string;disposition:'deferred-authorized'}>};
type Capture={expected:{characterId:string;rendererSha256:string;surface:string;width:number;state:string};observedAt:string;url:string;viewport:{width:number;height:number;devicePixelRatio:number};capture:{original:FidelityArtifact};screenshot:FidelityArtifact;host:{overflowPx:number};messages:Array<{messageIndex:number;rawSystemTags:number;controls:Array<{open:boolean;visible:boolean}>}>;openingMeasurement:{settle:{ok:boolean};frames:Array<{bodyHeight:number;height:number;contentHeight:number;overflowPx:number;text:string;controls:Array<{open:boolean}>}>}};
const reviews=JSON.parse(await readFile(join(root,'opening-release-reviews.json'),'utf8')) as {rows:Review[]};
const startedAt=new Date().toISOString(),t=performance.now(),results=[];
for(const review of reviews.rows){
 if(FIDELITY_CHECKS.some(k=>review.checks[k]?.status!=='pass'||!review.checks[k]?.detail))throw Error('EXPLICIT_VISUAL_REVIEW_REQUIRED:'+review.key);
 const dir=join(root,'opening-reports-release',review.key);await mkdir(dir,{recursive:true});
 const binding={sourceRuntimeSha256:sha(await readFile(join(root,'..',review.sourceKey,'mufy-runtime-rendered-20261015.json'))),targetCharacterId:review.targetCharacterId,rendererSha256:review.rendererSha256};
 async function save(name:string,bytes:string|Uint8Array):Promise<FidelityArtifact>{await writeFile(join(dir,name),bytes);return{path:name,sha256:sha(bytes)};}
 async function copy(ref:FidelityArtifact){const b=await readFile(join(captureRoot,ref.path));if(sha(b)!==ref.sha256)throw Error('HASH_MISMATCH:'+ref.path);return save(ref.path,b);}
 const sourceBytes=await readFile(resolve(root,review.sourceImage));const sourceScreenshot=await save('source.png',sourceBytes);
 const observations:FidelityEvidence['observations']=[];
 for(const surface of ['chat','preview'] as const)for(const width of [390,1280] as const){let beforeHeight=0;
  for(const state of ['initial','expanded','collapsed','reopened'] as const){
   const stem=`${review.key}-${surface}-${width}-${state}`;
   const bytes=await readFile(join(captureRoot,stem+'.json'));const r=JSON.parse(bytes.toString()) as Capture;
   if(r.expected.characterId!==binding.targetCharacterId||r.expected.rendererSha256!==binding.rendererSha256||r.expected.surface!==surface||r.expected.width!==width||r.expected.state!==state)throw Error('RAW_VERSION_OR_TARGET_MISMATCH:'+stem);
   if(!r.openingMeasurement.settle.ok)throw Error('LAYOUT_NOT_SETTLED:'+stem);
   const frames=r.openingMeasurement.frames,native=r.messages.find(m=>m.messageIndex===0);
   const controls=[...frames.flatMap(f=>f.controls),...(native?.controls.filter(c=>c.visible)??[])];
   const height=frames.reduce((s,f)=>s+f.bodyHeight,0),text=frames.map(f=>f.text).join('\n');
   const targetScreenshot=await copy(r.screenshot),original=await copy(r.capture.original),originalObservation=await save(stem+'.original-observation.json',bytes);
   const checks={...review.checks,composerHit:surface==='preview'?{status:'not-applicable',detail:'Read-only preview has no live chat composer.'}:review.checks.composerHit};
   const raw={version:2,...binding,surface,state,observedAt:r.observedAt,url:r.url,viewport:r.viewport,capture:{...r.capture,original},
    metrics:{horizontalOverflowPx:r.host.overflowPx,iframeOverflowPx:Math.max(0,...frames.map(f=>f.overflowPx)),rawCustomTagCount:native?.rawSystemTags??0,unresolvedUserNameCount:(text.match(/mufyer|\{\{user\}\}/giu)||[]).length,clippedElementCount:frames.filter(f=>f.bodyHeight>f.height+2).length,bodyHeight:height,contentHeight:frames.reduce((s,f)=>s+f.contentHeight,0)},
    interaction:{applicable:controls.length>0,action:controls.length?state:'not-applicable',reason:controls.length?'All currently operable source opening summaries are measured.':'No operable source fold in this exact state.',controlCount:controls.length,expandedCount:controls.filter(c=>c.open).length,beforeHeight:beforeHeight||height,afterHeight:height},checks,mediaExceptions:review.mediaExceptions,originalObservation};
   beforeHeight=height;const evidence=await save(stem+'.proof.json',JSON.stringify(raw,null,2));
   observations.push({surface,width,state,observedAt:r.observedAt,evidencePath:evidence.path,evidenceSha256:evidence.sha256,sourceScreenshot,targetScreenshot});
  }
 }
 const report:FidelityEvidence={version:2,scope:'opening-and-source-components',...binding,observations};
 const reportPath=join(dir,'opening-report.json');await writeFile(reportPath,JSON.stringify(report,null,2));
 results.push({key:review.key,...await verifyFidelityEvidenceFiles(report,{...binding,targetBaseUrl:'http://115.29.213.73:8091',notBefore:'2026-10-20T21:35:57.511Z'},reportPath)});
}
await writeFile(join(root,'opening-release-validation.json'),JSON.stringify({startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,results},null,2));console.log(JSON.stringify(results));
