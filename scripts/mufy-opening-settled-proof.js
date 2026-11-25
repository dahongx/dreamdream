// Read-only public DOM measurements, called only from authorized cua_repl.
import { visibleRead } from './mufy-visible-read.js';
export async function measureOpening(tab){
  const refs=await tab.playwright.locator('iframe[title^="regex-"]').evaluateAll(es=>es.map(e=>({title:e.title,instance:[...e.ownerDocument.querySelectorAll('iframe')].filter(f=>f.title===e.title).indexOf(e),messageIndex:[...e.ownerDocument.querySelectorAll('.nj_ai_message_row')].indexOf(e.closest('.nj_ai_message_row')),height:e.getBoundingClientRect().height})).filter(f=>f.messageIndex<=0&&!f.title.includes('floating')));
  // Read one frame at a time: the extension queues CDP work and concurrent
  // frame reads can exhaust individual command deadlines.
  const frames=[];
  for(const f of refs){
    const selector='iframe[title='+JSON.stringify(f.title)+'] >> nth='+f.instance;
    const body=await visibleRead(tab,()=>tab.playwright.frameLocator(selector).locator('body').evaluate(b=>{
      const w=b.ownerDocument.defaultView,d=b.ownerDocument;
      return {bodyHeight:b.getBoundingClientRect().height,contentHeight:b.scrollHeight,text:b.innerText,overflowPx:Math.max(0,d.documentElement.scrollWidth-w.innerWidth),controls:[...b.querySelectorAll('details > summary')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({label:e.textContent,open:e.parentElement.open,exclusiveGroup:e.parentElement.getAttribute('name')})),images:[...b.querySelectorAll('img')].map(e=>({src:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),audio:[...b.querySelectorAll('audio')].map(a=>({src:a.currentSrc||a.getAttribute('src'),readyState:a.readyState,paused:a.paused}))};
    }, undefined, {timeoutMs:10000}));frames.push({...f,...body});
  }
  // Frame documents are read serially. Refresh their host heights afterwards:
  // the initial list can precede a ResizeObserver update by several seconds.
  const currentHosts=await tab.playwright.locator('iframe[title^="regex-"]').evaluateAll(es=>es.map(e=>({title:e.title,instance:[...e.ownerDocument.querySelectorAll('iframe')].filter(f=>f.title===e.title).indexOf(e),height:e.getBoundingClientRect().height})));
  for(const f of frames){const host=currentHosts.find(h=>h.title===f.title&&h.instance===f.instance);if(host)f.height=host.height;}
  return {frames};
}
export async function openingSettledProof(tab,expected,options,capture){
  const start=performance.now();let last,stableSince=start,measurement,samples=0;
  // First-open image/font reflow was observed to outlast seven seconds on
  // the connected browser. Keep sampling actual geometry, with a hard cap.
  while(performance.now()-start<15000){
    // Layout stabilization needs host geometry, not repeated reads of every
    // nested document. Read full public content once after geometry settles.
    measurement={frames:await tab.playwright.locator('iframe[title^="regex-"]').evaluateAll(es=>es.filter(e=>!e.title.includes('floating')&&[...e.ownerDocument.querySelectorAll('.nj_ai_message_row')].indexOf(e.closest('.nj_ai_message_row'))<=0).map(e=>({height:e.getBoundingClientRect().height})))};samples++;
    // Animated transforms inside an already-sized iframe are not layout
    // reflow. Keep checking content fits, but settle on the host dimensions.
    const footprint=JSON.stringify(measurement.frames.map(f=>Math.round(f.height)));
    const fits=measurement.frames.length>0;
    if(last!==footprint||!fits){last=footprint;stableSince=performance.now();}
    if(fits&&performance.now()-stableSince>=400){measurement.settle={ok:true,samples,elapsedMs:performance.now()-start};break;}
    await tab.playwright.waitForTimeout(100);
  }
  if(!measurement.settle)measurement.settle={ok:false,samples,elapsedMs:performance.now()-start};
  const settle=measurement.settle;
  measurement=await measureOpening(tab);
  measurement.settle={...settle,ok:settle.ok&&measurement.frames.every(f=>f.bodyHeight<=f.height+2)};
  // Keep a meaningful exact opening component in view after layout changes.
  for(const f of measurement.frames){
    const summaries=tab.playwright.frameLocator('iframe[title='+JSON.stringify(f.title)+'] >> nth='+f.instance).locator('details > summary');
    let summary;
    for(let i=0;i<await summaries.count();i++){
      const candidate=summaries.nth(i);
      if(await candidate.isVisible()&&(await candidate.textContent()??'').trim().length<=100){summary=candidate;break;}
    }
    // A decorative hero summary can be taller than the viewport and focus
    // leaves the camera in the following message. Prefer a compact panel.
    if(!summary)continue;
    try{await summary.press('Shift',{timeoutMs:3000});}catch(e){if(!await summary.evaluate(e=>e.ownerDocument.activeElement===e))throw e;}
    break;
  }
  return {...await capture(tab,expected,options),openingMeasurement:{...measurement,observedAt:new Date().toISOString(),scope:'opening-and-intro-only'}};
}
