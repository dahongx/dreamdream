/** Offline validation of real cua_repl evidence. Never grants visual acceptance. */
import {readdir,readFile,writeFile,mkdir,appendFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {verifyMufyScreenshotGeometry} from '../src/lib/import/mufy-fidelity-review';
import {foldStateErrors} from './mufy-fold-state-validation';
const root=resolve('logs/mufy-profiles/full-20261013/next-batch-10-20261023/strict-acceptance-20261024');
const startedAt=new Date().toISOString(),tick=performance.now();
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const keys=['duanjiachen','junlishang','qie','fuchiling','xieyan','chengfeng'];
const themeCutoffs={
 xieyan:(await stat(join(root,'../xieyan-theme-after-status-repair.css'))).mtimeMs,
 fuchiling:(await stat(join(root,'../fuchiling-theme-after-scene-repair.css'))).mtimeMs,
};
const qiOpeningCutoff=Math.max((await stat(join(root,'../qie-theme-after-narrow-title-repair.css'))).mtimeMs,(await stat(join(root,'../qie-theme-after-canvas-width-repair.css'))).mtimeMs);
const chengOpeningCutoff=Math.max((await stat(join(root,'../chengfeng-opening-after-sidebar-repair.html'))).mtimeMs,(await stat(join(root,'../chengfeng-theme-after-narrow-stage-repair.css'))).mtimeMs);
const results=[];
for(const group of ['replies','openings']){
 const dir=join(root,group);await mkdir(dir,{recursive:true});
 const files=(await readdir(dir)).filter(f=>f.endsWith('.json'));
 for(const file of files){
  const bytes=await readFile(join(dir,file)),r=JSON.parse(bytes.toString());
  if(!r.expected||!r.screenshot)continue;
  const errors:string[]=[];
  const cardKey=file.split('-')[0];
  if(group==='openings'&&((cardKey==='qie'&&Date.parse(r.observedAt)<qiOpeningCutoff)||(cardKey==='chengfeng'&&Date.parse(r.observedAt)<chengOpeningCutoff)))errors.push('STALE_AFTER_OPENING_REPAIR');
  if(group==='replies'&&cardKey in themeCutoffs&&Date.parse(r.observedAt)<themeCutoffs[cardKey as keyof typeof themeCutoffs])errors.push('STALE_AFTER_THEME_REPAIR');
  if(group==='openings'&&r.expected.state==='initial'&&!r.initialPageReloadVerified)errors.push('DEFAULT_STATE_NEEDS_FRESH_PAGE_PROOF');
  try{
   const png=await readFile(join(dir,r.screenshot.path));
   if(sha(png)!==r.screenshot.sha256)errors.push('SCREENSHOT_HASH_MISMATCH');
   await verifyMufyScreenshotGeometry(png,r.viewport,r.capture,join(dir,file));
   if(r.viewport.width!==r.expected.width)errors.push('VIEWPORT_MISMATCH');
   const focused=r.focusedMeasurement;
   const measured=focused??r.openingMeasurement;
   if(!measured?.settle.ok)errors.push('UNSETTLED_LAYOUT');
   if(r.host.overflowPx>2)errors.push('HOST_HORIZONTAL_OVERFLOW');
   const controls=focused?[...focused.host.controls,...focused.frames.flatMap((f:{controls:unknown[]})=>f.controls)]:[...measured.frames.flatMap((f:{controls:unknown[]})=>f.controls),...(r.messages.find((m:{messageIndex:number})=>m.messageIndex===0)?.controls.filter((c:{visible:boolean})=>c.visible)??[])];
   const expanded=controls.filter((c:{open:boolean})=>c.open).length;
   const documents=focused?[focused.host.controls,...focused.frames.map((f:{controls:unknown[]})=>f.controls)]:[...measured.frames.map((f:{controls:unknown[]})=>f.controls),r.messages.find((m:{messageIndex:number})=>m.messageIndex===0)?.controls.filter((c:{visible:boolean})=>c.visible)??[]];
   errors.push(...foldStateErrors(documents,r.expected.state));
   for(const frame of measured.frames){if(frame.overflowPx>2)errors.push('FRAME_HORIZONTAL_OVERFLOW');if(frame.bodyHeight>frame.height+2)errors.push('FRAME_CLIPPED');}
   if(focused?.host.overflowPx>2)errors.push('REPLY_HORIZONTAL_OVERFLOW');
   if(focused?.consoleObservation.errorCount)errors.push('CONSOLE_ERROR_DURING_STEP');
   results.push({file,group,key:file.split('-')[0],state:r.expected.state,width:r.expected.width,messageIndex:r.expected.messageIndex,surface:r.expected.surface,controls:controls.length,expanded,errors});
  }catch(error){results.push({file,group,errors:[String(error)]});}
 }
}
const coverage=keys.map(key=>({key,replies:results.filter(r=>r.group==='replies'&&r.file.startsWith(key+'-')).length,openings:results.filter(r=>r.group==='openings'&&r.file.startsWith(key+'-')).length}));
const report={startedAt,finishedAt:new Date().toISOString(),coverage,expectedReplyStates:96,expectedOpeningStates:96,observed:results.length,errors:results.filter(r=>r.errors.length),results,visualAccepted:false};
await writeFile(join(root,'automatic-state-validation.json'),JSON.stringify(report,null,2));
await mkdir(join(root,'contact-sheets'),{recursive:true});
for(const key of keys)for(const index of [1,2]){
 const names=[390,1280].flatMap(width=>['initial','expanded','collapsed','reopened'].map(state=>`${key}-reply-${index}-${width}-${state}.png`));
 try{
 const tiles=await Promise.all(names.map(async(name,n)=>({input:await sharp(await readFile(join(root,'replies',name))).resize({width:640,height:600,fit:'contain',background:'#10131c'}).png().toBuffer(),left:(n%2)*640,top:Math.floor(n/2)*630})));
 await sharp({create:{width:1280,height:2520,channels:3,background:'#10131c'}}).composite(tiles).png().toFile(join(root,'contact-sheets',`${key}-reply-${index}.png`));
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
await appendFile(join(root,'compute-timing.jsonl'),JSON.stringify({startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'offline-evidence-verification-and-contact-sheets',excludes:['browser waiting','user pauses','scheduling gaps'],wholeAgentNetWorkMs:null})+'\n');
console.log(JSON.stringify({coverage,observed:results.length,failures:report.errors},null,2));
