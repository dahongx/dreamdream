/** CUA caller-owned tab only; all evaluation is read-only public DOM. */
import {writeFile} from 'node:fs/promises';
import {savedReplyFrameInventory} from './mufy-saved-reply-ui-check.mjs';
const selectors={'command-drawer':'[data-nj-command-drawer]','page-controls':'.nj_source_quick_symbols,.nj_source_heart_navigation,.nj_source_narrow_navigation','cloud-music':'[data-nj-cloud-music],[data-nj-island-music]','ghost-focus-left':'[data-nj-ghost-instructions]','image-island':'.nj_image_island','halo-toolkit':'[data-nj-halo-toolkit]'};
export async function inspectCandidateComposition(tab,entry,{origin,outputDir,mode}){
 if(!['desktop','mobile'].includes(mode))throw Error('EXPLICIT_LAYOUT_MODE_REQUIRED');
 const tick=Date.now(),row={rank:entry.rank,name:entry.name,observedAt:new Date().toISOString(),candidateSha256:entry.sha256,mode,scope:'Final candidate production components composed locally; external network/media/fonts disabled. Not TEST, source fidelity, touch, complete interaction or whole-card acceptance',native:[],frames:[],agentNetMs:null};
 try{
  await tab.goto(origin+'/?rank='+entry.rank);row.identity=await tab.playwright.locator('#case-identity').innerText();
  if(await tab.playwright.locator('#case-identity').getAttribute('data-candidate-sha256')!==entry.sha256||row.identity!==entry.rank+' · '+entry.name)throw Error('CANDIDATE_IDENTITY_OR_HASH_MISMATCH');
  await tab.playwright.domSnapshot();
  for(const spec of entry.native){const selector=selectors[spec.variant]??'[data-nj-native-image-sidebar]';row.native.push({variant:spec.variant,selector,count:await tab.playwright.locator(selector).count()});}
  row.prefixCount=await tab.playwright.locator('[data-nj-composer-prefix]').count();row.expectedPrefixes=entry.prefixes.length;
  row.frames=await tab.playwright.locator('iframe').evaluateAll(savedReplyFrameInventory);
  await tab.playwright.locator('#repaint-button').click();row.repaintCount=await tab.playwright.locator('#repaint-count').innerText();
  row.framesAfterRepaint=await tab.playwright.locator('iframe').evaluateAll(savedReplyFrameInventory);
  row.sendCount=await tab.playwright.locator('#send-count').innerText();row.hostGeometry=await tab.playwright.locator('html').evaluate(e=>({viewport:innerWidth,width:e.clientWidth,scrollWidth:e.scrollWidth}));
  if(mode==='mobile'&&row.hostGeometry.viewport!==390)throw Error('MOBILE_VIEWPORT_NOT_APPLIED');
 }catch(error){row.error=String(error).slice(0,500);}
 row.finishedAt=new Date().toISOString();row.elapsedMs=Date.now()-tick;
 await writeFile(`${outputDir}/${entry.rank}-${mode}-mount-repaint-20261101.json`,JSON.stringify(row,null,2));return row;
}
export function compositionCheckSummary(row){return {rank:row.rank,mode:row.mode,native:row.native,prefixes:row.prefixCount,expected:row.expectedPrefixes,frames:row.frames.length,after:row.framesAfterRepaint?.length,overflow:row.hostGeometry?row.hostGeometry.scrollWidth-row.hostGeometry.width:null,sends:row.sendCount,error:row.error};}
export function compositionEvidenceIssues(entry,row,mode){
 const issues=[];if(row.error)issues.push('browser-error');
 if(row.rank!==entry.rank||row.candidateSha256!==entry.sha256||row.identity!==entry.rank+' · '+entry.name)issues.push('identity-or-candidate-fingerprint');
 if(row.native?.length!==entry.native.length||row.native?.some((item,index)=>item.variant!==entry.native[index]?.variant||item.count!==1))issues.push('native-mount-count');
 if(row.prefixCount!==entry.prefixes.length||row.expectedPrefixes!==entry.prefixes.length)issues.push('prefix-mount-count');
 if(!Array.isArray(row.frames)||!Array.isArray(row.framesAfterRepaint)||JSON.stringify(row.frames.map(f=>f.title))!==JSON.stringify(row.framesAfterRepaint.map(f=>f.title)))issues.push('iframe-slot-change');
 if(row.repaintCount!=='1'||row.sendCount!=='0')issues.push('repaint-or-send-count');
 if(!row.hostGeometry||row.hostGeometry.scrollWidth>row.hostGeometry.width+1)issues.push('host-overflow');
 if(mode==='mobile'&&row.hostGeometry?.viewport!==390)issues.push('mobile-viewport');
 return issues;
}
