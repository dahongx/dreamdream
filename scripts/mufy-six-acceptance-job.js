// Run only from authorized cua_repl. Sequential normal UI; no network APIs,
// credentials, storage, database, sends, or hidden application state.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {focusedReplyCheckpoint} from './mufy-focused-reply-evidence.js';
import {openingReleaseCheckpoint} from './mufy-opening-release-checkpoint.js';
import {rendererFingerprint} from './mufy-renderer-fingerprint.js';

/** One awaited browser step per call; the UI runtime needs an active call. */
export async function createSixAcceptanceQueue({browser,tab,base,root,encoder,priority=[],openingCheckpoint=openingReleaseCheckpoint}){
 const rows=JSON.parse(await readFile(base+'/six-card-user-test-ready.json','utf8')).rows;
 const keys=['duanjiachen','junlishang','qie','fuchiling','xieyan','chengfeng'];
 const fingerprint=await rendererFingerprint('E:/agent/YearnAI/yearn-chat');
 const repairAt=(await stat(base+'/xieyan-theme-after-status-repair.css')).mtimeMs;
 const fuRepairAt=(await stat(base+'/fuchiling-theme-after-scene-repair.css')).mtimeMs;
 const chengRepairAt=Math.max((await stat(base+'/chengfeng-opening-after-sidebar-repair.html')).mtimeMs,(await stat(base+'/chengfeng-theme-after-narrow-stage-repair.css')).mtimeMs);
 const qiRepairAt=Math.max((await stat(base+'/qie-theme-after-narrow-title-repair.css')).mtimeMs,(await stat(base+'/qie-theme-after-canvas-width-repair.css')).mtimeMs);
 const previousAudit=JSON.parse(await readFile(root+'/automatic-state-validation.json','utf8'));
 const staleFoldProofs=new Set(previousAudit.errors.filter(e=>e.key==='fuchiling'&&e.errors.includes('EXPANSION_INCOMPLETE')).map(e=>e.file));
 const tasks=[];
 for(let i=0;i<rows.length;i++)for(const group of ['replies','openings'])for(const surface of group==='replies'?['chat']:['preview','chat'])for(const width of [390,1280])for(const messageIndex of group==='replies'?[1,2]:[undefined])for(const state of ['initial','expanded','collapsed','reopened']){
  const row=rows[i],key=keys[i];
  const expected=group==='replies'?{characterId:row.target,characterName:row.name,rendererSha256:fingerprint,surface,messageIndex,width,state}:{characterId:row.target,characterName:row.name,key,rendererSha256:fingerprint,surface,openingOnly:true,width,state};
  const stem=group==='replies'?`${key}-reply-${messageIndex}-${width}-${state}`:`${key}-${surface}-${width}-${state}`;
  let recapture=false;
  // Bind narrow-title captures to the saved repair; old snapshots are not
  // upgraded in place. Re-observe legacy exclusive-group evidence as well.
  const extraRecapture=key==='fuchiling'&&group==='openings'&&staleFoldProofs.has(stem+'.json');
  try{const old=JSON.parse(await readFile(root+'/'+group+'/'+stem+'.json','utf8'));if(JSON.stringify(old.expected)!==JSON.stringify(expected))throw Error('EXPECTED_BINDING_CHANGED:'+stem);recapture=extraRecapture||(key==='qie'&&group==='openings'&&Date.parse(old.observedAt)<qiRepairAt)||(key==='xieyan'&&group==='replies'&&Date.parse(old.observedAt)<repairAt)||(key==='fuchiling'&&group==='replies'&&Date.parse(old.observedAt)<fuRepairAt)||(key==='chengfeng'&&group==='openings'&&Date.parse(old.observedAt)<chengRepairAt)||(group==='openings'&&expected.state==='initial'&&!old.initialPageReloadVerified)||old.openingMeasurement?.settle?.ok===false;if(!recapture)continue;}catch(e){if(e.code!=='ENOENT')throw e;}
  tasks.push({group,key,expected,stem,recapture});
 }
 if(priority.length)tasks.sort((a,b)=>priority.indexOf(a.key)-priority.indexOf(b.key));
 let createdTab;
 const progress={status:'ready',pending:tasks.length,completed:[],errors:[]};
 const save=()=>writeFile(root+'/queue-status.json',JSON.stringify(progress,null,2));
 await save();
 return {progress,async next(){
  const task=tasks[0];if(!task){progress.status='completed';await save();return progress;}
  progress.status='running';progress.current=task.stem;await save();
  try{
   const e=task.expected,url=`http://115.29.213.73:8091/${e.surface==='preview'?'characters':'chat'}/${e.characterId}`;
   if(task.group==='openings'&&e.state==='initial'&&!task.initialized){
    // A fresh surface establishes author defaults without carrying details
    // state across widths. No messages are sent or conversation data changed.
    if(createdTab){try{await createdTab.close();}catch(error){progress.errors.push({kind:'ephemeral-tab-cleanup',error:String(error)});}}
    tab=await browser.tabs.new();createdTab=tab;task.initialized=true;await tab.goto(url);
   }else if(await tab.url()!==url)await tab.goto(url);
   // Observe the exact loaded page before invoking any state action.
   const heading=tab.playwright.getByRole('heading',{name:e.characterName,exact:true});
   if(!await heading.isVisible())await heading.waitFor({state:'visible',timeoutMs:10000});
   const viewport=await tab.playwright.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
   if(viewport.width!==e.width||viewport.height!==600){
    await (await browser.capabilities.get('viewport')).set({width:e.width,height:600});
    await (await tab.capabilities.get('cdp')).send('Emulation.setDeviceMetricsOverride',{width:e.width,height:600,deviceScaleFactor:viewport.dpr,mobile:false});
   }
   const result=task.group==='replies'?await focusedReplyCheckpoint({tab,browser,expected:e,root:root+'/'+task.group,key:task.key,nativePngEncoder:encoder,recapture:task.recapture}):await openingCheckpoint({tab,browser,expected:e,root:root+'/'+task.group,nativePngEncoder:encoder,recapture:task.recapture});
   if(task.group==='openings'&&e.state==='initial'){
    const path=root+'/'+task.group+'/'+task.stem+'.json',saved=JSON.parse(await readFile(path,'utf8'));
    saved.initialPageReloadVerified=true;await writeFile(path,JSON.stringify(saved,null,2));
   }
   tasks.shift();progress.completed.push(task.stem);progress.pending=tasks.length;progress.status=tasks.length?'ready':'completed';await save();return{...result,pending:tasks.length};
  }catch(e){progress.status='needs-attention';progress.errors.push({stem:task.stem,error:String(e)});await save();throw e;}
 }};
}

export async function runSixAcceptance({browser,tab,base,root,encoder,progress,only}) {
 const selection=JSON.parse(await readFile(base+'/six-card-user-test-ready.json','utf8')).rows;
 const slugs=['duanjiachen','junlishang','qie','fuchiling','xieyan','chengfeng'];
 const fingerprint=await rendererFingerprint('E:/agent/YearnAI/yearn-chat');
 const repairAt=(await stat(base+'/xieyan-theme-after-status-repair.css')).mtimeMs;
 await mkdir(root,{recursive:true});
 const save=()=>writeFile(root+'/job-status.json',JSON.stringify({...progress,promise:undefined,updatedAt:new Date().toISOString()},null,2));
 progress.status='running';progress.completed=[];progress.errors=[];await save();
 try{
  for(let card=0;card<selection.length;card++){
   const row=selection[card],key=slugs[card];
   if(only&&key!==only)continue;
   for(const group of ['replies','openings']){
    const surfaces=group==='replies'?['chat']:['preview','chat'];
    for(const surface of surfaces){
     const url=`http://115.29.213.73:8091/${surface==='preview'?'characters':'chat'}/${row.target}`;
     if(await tab.url()!==url)await tab.goto(url);
     // A fresh, exact heading observation separates navigation from capture.
     await tab.playwright.getByRole('heading',{name:row.name,exact:true}).waitFor({state:'visible',timeoutMs:10000});
     for(const width of [390,1280]){
      if(width===1280)await tab.reload();
      for(const messageIndex of group==='replies'?[1,2]:[undefined])for(const state of ['initial','expanded','collapsed','reopened']){
       if(progress.cancelled){progress.status='cancelled';await save();return;}
       const expected=group==='replies'
        ? {characterId:row.target,characterName:row.name,rendererSha256:fingerprint,surface,messageIndex,width,state}
        : {characterId:row.target,characterName:row.name,key,rendererSha256:fingerprint,surface,openingOnly:true,width,state};
       const stem=group==='replies'?`${key}-reply-${messageIndex}-${width}-${state}`:`${key}-${surface}-${width}-${state}`;
       progress.current={group,stem};await save();
       let recapture=false;
       if(key==='xieyan'&&group==='replies'){
        try{recapture=Date.parse(JSON.parse(await readFile(root+'/'+group+'/'+stem+'.json','utf8')).observedAt)<repairAt;}catch(e){if(e.code!=='ENOENT')throw e;}
       }
       const value=group==='replies'
        ? await focusedReplyCheckpoint({tab,browser,expected,root:root+'/'+group,key,nativePngEncoder:encoder,recapture})
        : await openingReleaseCheckpoint({tab,browser,expected,root:root+'/'+group,nativePngEncoder:encoder});
       progress.completed.push({group,stem,...value});await save();
      }
     }
    }
   }
  }
  progress.status='completed';await save();
 }catch(e){progress.status='needs-attention';progress.errors.push({at:progress.current,error:String(e)});await save();}
}
