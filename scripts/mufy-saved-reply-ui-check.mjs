/** CUA orchestration only. The caller supplies its authorized tab; no other browser/network API. */
import {readFile,writeFile} from 'node:fs/promises';

/** Pure public-DOM inventory, serializable into the read-only browser scope. */
export function savedReplyFrameInventory(elements){
 const titles=elements.map(e=>e.getAttribute('title'));
 return elements.map((e,index)=>{
  const title=e.getAttribute('title');let selector;
  if(title&&titles.filter(value=>value===title).length===1)selector='iframe[title='+JSON.stringify(title)+']';
  else{
   const parts=[];let current=e;
   while(current&&current.id!=='nj_chat_messages'){
    const parent=current.parentElement;if(!parent)break;
    parts.unshift(current.tagName.toLowerCase()+':nth-child('+(Array.from(parent.children).indexOf(current)+1)+')');current=parent;
   }
   if(current?.id!=='nj_chat_messages')throw Error('AMBIGUOUS_FRAME_OUTSIDE_KNOWN_PUBLIC_ROOT');
   selector='#nj_chat_messages > '+parts.join(' > ');
  }
  return {index,title,selector,height:e.getBoundingClientRect().height,sandbox:e.getAttribute('sandbox')};
 });
}

export async function inspectSavedReplyUI(tab,entry,{origin,outputDir}){
 const tick=Date.now(),row={rank:entry.rank,round:entry.round,rawSha256:entry.rawSha256,ruleSetSha256:entry.ruleSetSha256,renderContract:entry.renderContract,observedAt:new Date().toISOString(),expectedStaticDetails:entry.expectedStaticDetails,providerQualification:entry.providerQualification,scopes:[],fullFidelityAccepted:false};
 try{
  await tab.goto(origin+'/?rank='+entry.rank+'&round='+entry.round);
  row.identity=await tab.playwright.locator('#case-identity').innerText();
  if(!entry.ruleSetSha256||await tab.playwright.locator('#case-identity').getAttribute('data-rules-sha256')!==entry.ruleSetSha256)throw Error('REPLAY_RULE_SET_HASH_MISMATCH');
  if(!row.identity.startsWith(entry.rank+' · ')||!row.identity.includes(entry.name)||!row.identity.endsWith('第 '+entry.round+' 条'))throw Error('WRONG_REPLAY_IDENTITY');
  const settled=async()=>{for(let attempt=0;attempt<3;attempt++){try{await tab.playwright.locator('header #layout-state[data-state="stable"]').waitFor({state:'visible',timeoutMs:3000});return;}catch(error){if(attempt===2||await tab.playwright.locator('header #layout-state').getAttribute('data-state')!=='measuring')throw error;}}};await settled();row.layoutStableBeforeInspection=true;
  row.frames=await tab.playwright.locator('iframe').evaluateAll(savedReplyFrameInventory);
  const scopes=[{name:'host',api:tab.playwright,body:'#nj_chat_messages'},...row.frames.map(frame=>({name:frame.title??'frame-'+frame.index,selector:frame.selector,api:tab.playwright.frameLocator(frame.selector),body:'body'}))];
  for(const scope of scopes){
   const info={name:scope.name,selector:scope.selector,before:await scope.api.locator(scope.body).evaluate(e=>({textLength:e.innerText.length,textStart:e.innerText.slice(0,110),width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,rawCodeBlocks:e.querySelectorAll('pre.nj_code_block').length,visibleProtocolLeak:/<(?:c_post_system|matrix_pre_status|nathan_mail_ui)\b/.test(e.innerText),invalidSummaryParents:Array.from(e.querySelectorAll('summary')).filter(n=>n.parentElement?.tagName!=='DETAILS').map(n=>({label:n.innerText,parent:n.parentElement?.tagName}))})),folds:[],pointerFallbacks:[]};
   row.scopes.push(info);
   const toggle=async(summary,index)=>{if(scope.selector){await tab.playwright.domSnapshot();await settled();}try{await summary.click();}catch(error){if(!scope.selector||!String(error).includes('<iframe')||!String(error).includes('intercepts'))throw error;const state=await summary.evaluate(e=>({label:e.innerText,parent:e.parentElement?.tagName,open:e.parentElement?.open}));if(state.parent!=='DETAILS'||!await summary.isVisible())throw error;
    // Ordinary keyboard navigation through the outer frame avoids the driver's
    // ambiguous child-frame input routing. Never invoke DOM handlers or mutate
    // focus through evaluate, and never press Enter on an unverified target.
    const focusState=()=>summary.evaluate(e=>{const nodes=Array.from(e.ownerDocument.querySelectorAll('summary,button,input,textarea,a[href],[tabindex]')).filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0);return {focused:e.ownerDocument.activeElement===e,active:nodes.indexOf(e.ownerDocument.activeElement),target:nodes.indexOf(e),count:nodes.length};});
    let focus=await focusState(),steps=0;const maxSteps=Math.min(100,focus.count+2);
    while(!focus.focused&&steps<maxSteps){await tab.playwright.locator(scope.selector).press(focus.active>focus.target&&focus.target>=0?'Shift+Tab':'Tab');focus=await focusState();steps++;}
    if(!focus.focused)throw Error('NORMAL_KEYBOARD_TARGET_NOT_REACHED');await tab.playwright.locator(scope.selector).press('Enter');info.pointerFallbacks.push({index,label:state.label,priorOpen:state.open,keyboardNavigationSteps:steps,qualification:'Pointer action intercepted by iframe; verified normal Tab/Shift+Tab and Enter via outer frame used. NOT a pointer/touch acceptance.',errorCategory:'iframe-pointer-interception'});}};
   const details=scope.api.locator(scope.name==='host'?'#nj_chat_messages details':'details');
   const initial=await details.evaluateAll(es=>es.map(e=>({open:e.open,label:e.querySelector(':scope > summary')?.innerText??''})));
   for(let i=0;i<initial.length;i++){
    const summary=details.nth(i).locator(':scope > summary');
    await settled();
    if(!await summary.isVisible()){info.folds.push({index:i,label:initial[i].label,visible:false});continue;}
    if(initial[i].open)await toggle(summary,i);await toggle(summary,i);
    info.folds.push({index:i,label:initial[i].label,opened:await details.nth(i).evaluate(e=>({open:e.open,height:e.getBoundingClientRect().height,textLength:e.innerText.length,opacity:getComputedStyle(e).opacity}))});
   }
   for(let j=initial.length-1;j>=0;j--){await settled();const state=await details.nth(j).evaluate(e=>e.open);if(state!==initial[j].open&&await details.nth(j).locator(':scope > summary').isVisible())await toggle(details.nth(j).locator(':scope > summary'),j);}
   info.restored=JSON.stringify(await details.evaluateAll(es=>es.map(e=>e.open)))===JSON.stringify(initial.map(e=>e.open));
  }
  row.sendCount=await tab.playwright.locator('#send-count').innerText();
 }catch(error){row.error=String(error).slice(0,700);}
 row.actualDetails=row.scopes.reduce((n,s)=>n+s.folds.length,0);row.finishedAt=new Date().toISOString();row.elapsedMs=Date.now()-tick;row.timingKind='browser-local-saved-public-reply-replay-wall-not-agent-net';row.agentNetMs=null;row.externalNetworkDisabled=true;
 const outputPath=outputDir+'/'+entry.rank+'-round'+entry.round+'-browser-structural-check-20261101.json';
 try{const prior=await readFile(outputPath,'utf8'),previous=JSON.parse(prior);if(previous.error||previous.ruleSetSha256!==row.ruleSetSha256||previous.scopes?.some(scope=>scope.folds.some(fold=>!fold.opened?.open))){const history=outputDir+'/'+entry.rank+'-round'+entry.round+'-prior-'+previous.observedAt.replace(/[:.]/g,'-')+'.json';try{await writeFile(history,prior,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}row.priorFailurePreserved=history;}}catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(outputPath,JSON.stringify(row,null,2));
 return row;
}

export function savedReplyCheckSummary(row){return {rank:row.rank,round:row.round,details:row.actualDetails,minimumExpected:row.expectedStaticDetails,frames:row.frames?.length,allRestored:row.scopes.every(s=>s.restored),notOpened:row.scopes.flatMap(s=>s.folds.filter(f=>!f.opened?.open).map(f=>({scope:s.name,label:f.label,visible:f.visible}))),pointerFallbacks:row.scopes.reduce((n,s)=>n+(s.pointerFallbacks?.length??0),0),invalidSummaryParents:row.scopes.flatMap(s=>s.before.invalidSummaryParents??[]),protocolLeak:row.scopes.some(s=>s.before.visibleProtocolLeak),sendCount:row.sendCount,elapsedMs:row.elapsedMs,error:row.error};}
