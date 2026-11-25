/** Called only through authorized cua_repl. Uses public rendered DOM and normal
 * keyboard focus; no sends, credentials, browser storage, private prompts or DB.
 * This is an evidence producer, never an automatic visual acceptance grant. */
import {mkdir,readFile,writeFile,appendFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectMufySurfaceStep} from './mufy-browser-state-driver.js';
import {captureMufyViewportProof} from './mufy-browser-viewport-proof.js';

const digest=b=>createHash('sha256').update(b).digest('hex');

async function readReply(tab,index){
  const row=tab.playwright.locator('.nj_ai_message_row').nth(index);
  const host=await row.evaluate(e=>{
    const r=e.getBoundingClientRect(),w=e.ownerDocument.defaultView;
    const narrative=[...e.querySelectorAll('p')].filter(p=>!p.closest('details')).map(p=>p.innerText).join('\n');
    return {height:r.height,width:r.width,scrollHeight:e.scrollHeight,overflowPx:Math.max(0,e.scrollWidth-e.clientWidth),text:e.innerText,narrative,
      controls:[...e.querySelectorAll('details > summary')].map(s=>({open:s.parentElement.open,label:s.textContent})),
      boxes:[...e.querySelectorAll('.mufy_message_system')].map(b=>({background:w.getComputedStyle(b).backgroundColor,border:w.getComputedStyle(b).border})),rawSystemTags:e.querySelectorAll('system,sys').length,
      frames:[...e.querySelectorAll('iframe')].map(f=>({title:f.title,instance:[...e.ownerDocument.querySelectorAll('iframe')].filter(i=>i.title===f.title).indexOf(f),height:f.getBoundingClientRect().height}))};
  });
  const frames=[];
  for(const f of host.frames){
    const selector='iframe[title='+JSON.stringify(f.title)+'] >> nth='+f.instance;
    const value=await tab.playwright.frameLocator(selector).locator('body').evaluate(b=>{
      const d=b.ownerDocument,w=d.defaultView;
      return {bodyHeight:b.getBoundingClientRect().height,scrollHeight:b.scrollHeight,rootScrollHeight:d.documentElement.scrollHeight,background:w.getComputedStyle(b).backgroundColor,htmlBackground:w.getComputedStyle(d.documentElement).backgroundColor,
        text:b.innerText,narrative:[...b.querySelectorAll('p')].filter(p=>!p.closest('details')).map(p=>p.innerText).join('\n'),overflowPx:Math.max(0,d.documentElement.scrollWidth-w.innerWidth),
        controls:[...b.querySelectorAll('details > summary')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({open:e.parentElement.open,label:e.textContent})),
        boxes:[...b.querySelectorAll('.mufy_message_system')].map(e=>({background:w.getComputedStyle(e).backgroundColor,border:w.getComputedStyle(e).border})),rawSystemTags:b.querySelectorAll('system,sys').length,
        requiredStyleFailures:[...b.querySelectorAll('.mf-fire-panel')].filter(e=>['transparent','rgba(0, 0, 0, 0)'].includes(w.getComputedStyle(e).backgroundColor)).map(()=> 'mf-fire-panel-missing-source-surface')};
    });
    frames.push({...f,...value});
  }
  return {host,frames};
}

async function settledReply(tab,index){
  const start=performance.now();let previous,stableSince=performance.now(),samples=0;
  while(performance.now()-start<5000){
    const value=await readReply(tab,index);samples++;
    const footprint=JSON.stringify([Math.round(value.host.height),...value.frames.flatMap(f=>[Math.round(f.height),Math.round(f.bodyHeight)])]);
    const clipped=value.frames.some(f=>f.bodyHeight>f.height+2);
    if(footprint!==previous||clipped){previous=footprint;stableSince=performance.now();}
    if(!clipped&&performance.now()-stableSince>=400)return {...value,settle:{ok:true,samples,elapsedMs:performance.now()-start}};
    // An observed asynchronous iframe resize needs bounded settling, not a
    // second toggle or a guessed successful height measurement.
    await tab.playwright.waitForTimeout(100);
  }
  return {...await readReply(tab,index),settle:{ok:false,samples,elapsedMs:performance.now()-start}};
}

export async function focusedReplyCheckpoint({tab,browser,expected,root,key,nativePngEncoder,driver=inspectMufySurfaceStep,capture=captureMufyViewportProof,recapture=false}) {
  if(!/^[a-z0-9-]+$/.test(key)||!Number.isSafeInteger(expected.messageIndex)||expected.messageIndex<1)throw Error('EXACT_LATER_REPLY_REQUIRED');
  const stem=`${key}-reply-${expected.messageIndex}-${expected.width}-${expected.state}`;
  await mkdir(root,{recursive:true});
  try {
    const prior=JSON.parse(await readFile(join(root,stem+'.json'),'utf8'));
    if(JSON.stringify(prior.expected)!==JSON.stringify(expected)||digest(await readFile(join(root,prior.screenshot.path)))!==prior.screenshot.sha256)throw Error('PRIOR_REPLY_BINDING_OR_HASH_MISMATCH');
    if(!recapture)return {stem,reused:true};
    const archived=join(root,'non-accepting',String(Date.now()));await mkdir(archived,{recursive:true});
    for(const ext of ['.json','.png','.original.jpg'])await rename(join(root,stem+ext),join(archived,stem+ext));
  }catch(e){if(e.code!=='ENOENT')throw e;}
  const startedAt=new Date().toISOString(),start=performance.now();
  try {
    let measured;
    const proof=async(t,e,o)=>{
      const row=t.playwright.locator('.nj_ai_message_row').nth(expected.messageIndex);
      // Folding changes document height and can move the viewport to another
      // message. Settle first, then focus this exact reply for every state.
      measured=await settledReply(t,expected.messageIndex);
      if(measured.frames.some(f=>f.requiredStyleFailures?.length))throw Error('SOURCE_COMPONENT_STYLE_MISSING');
      {
        const focusSummary=async control=>{
          // A modifier focuses/scrolls the locator without moving keyboard
          // focus to a later fixed-position control (Tab can leave the reply).
          try{await control.press('Shift',{timeoutMs:3000});}
          catch(error){
            // The extension can complete focus/scroll and fail to dispatch
            // the modifier. Focus is sufficient; never repeat fold activation.
            if(!await control.evaluate(e=>e.ownerDocument.activeElement===e))throw error;
          }
        };
        const native=row.locator('details > summary');
        if(await native.count())await focusSummary(native.first());
        else{
          const refs=await row.locator('iframe').evaluateAll(es=>es.map(i=>({title:i.title,instance:[...i.ownerDocument.querySelectorAll('iframe')].filter(f=>f.title===i.title).indexOf(i)})));
          if(!refs.length)throw Error('FOCUSABLE_REPLY_COMPONENT_REQUIRED');
          const controls=t.playwright.frameLocator('iframe[title='+JSON.stringify(refs[0].title)+'] >> nth='+refs[0].instance).locator('details > summary');
          if(!await controls.count())throw Error('FOCUSABLE_REPLY_COMPONENT_REQUIRED');
          await focusSummary(controls.first());
        }
      }
      measured.focusedAfterLayout=true;
      const errors=await t.dev.logs({levels:['error'],limit:100});
      measured.consoleObservation={since:startedAt,errorCount:errors.filter(x=>Date.parse(x.timestamp)>=Date.parse(startedAt)).length};
      measured.observedAt=new Date().toISOString();
      return capture(t,e,{...o,nativeViewportCapture:true});
    };
    const r=await driver(tab,expected,{browser,height:600,viewportMode:'browser',nativePngEncoder,captureViewportProof:proof});
    const {pngBytes,originalBytes,...meta}=r;
    await writeFile(join(root,stem+'.png'),pngBytes);
    if(originalBytes){await writeFile(join(root,stem+'.original.jpg'),originalBytes);meta.capture={...meta.capture,original:{path:stem+'.original.jpg',sha256:digest(originalBytes)}};}
    const screenshot={path:stem+'.png',sha256:digest(pngBytes)};
    await writeFile(join(root,stem+'.json'),JSON.stringify({...meta,focusedMeasurement:measured,screenshot},null,2));
    await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({runId:'focused-round1',stepId:stem+'-'+startedAt,kind:'browser',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,status:'ok'})+'\n');
    return {stem,reused:false,elapsedMs:r.elapsedMs,frames:r.frames.length,actions:r.actions.length};
  }catch(e){await appendFile(join(root,'timing-runs.jsonl'),JSON.stringify({runId:'focused-round1',stepId:stem+'-'+startedAt,kind:'browser',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,status:'failed',error:e.message})+'\n');throw e;}
}
