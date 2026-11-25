import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act} from 'react';
test('OC copy host accepts only own frame, finite text and active gesture; no send or draft writes',async()=>{
 const dom=new JSDOM('<div id="oc-root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 Object.defineProperty(dom.window,'isSecureContext',{value:true});
 let active=true,writes:string[]=[];Object.defineProperty(dom.window.navigator,'userActivation',{value:{get isActive(){return active;}}});Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async(text:string)=>{writes.push(text);}}});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,DOMParser:dom.window.DOMParser,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{RegexIframe}=await import('../../regex/RegexIframe'),{I18nProvider}=await import('../../../i18n/client'),{zh}=await import('../../../i18n/zh');
 const root=createRoot(document.getElementById('oc-root')!);let sends=0,drafts=0;
 const srcdoc='<div id="oc-generator"><div id="oc-output-wrap"><pre id="oc-output-text"></pre></div></div><script>function ocCopy(){}function ocFallbackCopy(){}</script>';
 const render=(html=srcdoc)=>root.render(<I18nProvider locale="zh-TW" dict={zh}><RegexIframe srcdoc={html} ruleId="oc-test" ruleName="public OC" captureGroups={[]} character={{id:'test',name:'Test',avatarUrl:null,tags:[],bio:null}} userName="Test" onSendMessage={()=>{sends++;}} onFillComposer={()=>{drafts++;}}/></I18nProvider>);
 try{
  await act(async()=>render());const frame=document.querySelector('iframe')!;
  const send=async(source:MessageEventSource|null,text:unknown,id:unknown=1)=>{await act(async()=>{dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source,data:{type:'nj-oc-profile-copy',id,text}}));});};
  await send(dom.window,'foreign');expect(writes).toHaveLength(0);
  active=false;await send(frame.contentWindow,'inactive');expect(writes).toHaveLength(0);active=true;
  await send(frame.contentWindow,'x'.repeat(100001));await send(frame.contentWindow,'bad id','1');await send(frame.contentWindow,'');expect(writes).toHaveLength(0);
  await send(frame.contentWindow,'验收玩家：28');expect(writes).toEqual(['验收玩家：28']);expect(sends).toBe(0);expect(drafts).toBe(0);expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  await act(async()=>render('<p>ordinary author frame</p>'));await send(frame.contentWindow,'not enabled');expect(writes).toHaveLength(1);
  const engraved=`<div class="mufy-glass-openings"><div class="mufy-glass-content"><button class="mufy-pill-btn" onclick="var btn=this;var text=btn.closest('.mufy-glass-content').querySelector('.mufy-engraved-text').innerText;navigator.clipboard.writeText(text)">一键提取</button><div class="mufy-engraved-text">公开开场</div></div></div>`;
  await act(async()=>render(engraved));const openingFrame=document.querySelector('iframe')!;await send(dom.window,'foreign opening');expect(writes).toHaveLength(1);
  await send(openingFrame.contentWindow,'公开开场');expect(writes).toEqual(['验收玩家：28','公开开场']);expect(sends).toBe(0);expect(drafts).toBe(0);expect(openingFrame.getAttribute('sandbox')).toBe('allow-scripts');
  const avatars=`<div class="censy-avatar-wrapper"><details><summary>Avatar Library</summary><div class="censy-avatar-content"><img class="censy-avatar-img" src="https://example.com/public.png" onclick="navigator.clipboard.writeText(this.src);alert('Image Link Copied!')"></div></details></div>`;
  await act(async()=>render(avatars));const avatarFrame=document.querySelector('iframe')!;await send(dom.window,'foreign avatar');expect(writes).toHaveLength(2);await send(avatarFrame.contentWindow,'https://example.com/public.png');expect(writes).toHaveLength(3);expect(writes[2]).toBe('https://example.com/public.png');expect(sends).toBe(0);expect(drafts).toBe(0);expect(avatarFrame.getAttribute('sandbox')).toBe('allow-scripts');
  const command=`<div class="cen_cmd_wrap_Sx"><div class="cold_tank_item" data-command="公开指令"><button class="Z_CONFIG_btn" onclick="censyCopyFn_v1(this)">COPY</button><div class="Mm_toast"></div></div></div><script>function censyCopyFn_v1(btn){const parentItem=btn.closest('.cold_tank_item');const fullCommand=parentItem.getAttribute('data-command');navigator.clipboard.writeText(fullCommand)}</script>`;
  await act(async()=>render(command));const commandFrame=document.querySelector('iframe')!;await send(dom.window,'foreign command');expect(writes).toHaveLength(3);await send(commandFrame.contentWindow,'公开指令');expect(writes).toHaveLength(4);expect(writes[3]).toBe('公开指令');expect(sends).toBe(0);expect(drafts).toBe(0);expect(commandFrame.getAttribute('sandbox')).toBe('allow-scripts');
  const mask='<div id="censy-mask-form-v7-white"><div id="cm-form-content-v7">'+['name','role','personality','appearance','preference','extra'].map(id=>'<input id="cm-'+id+'-v7">').join('')+'</div><button id="cm-copy-btn-v7">提取面具</button></div><script>function censyExtractDataV7(){let textToCopy="【角色档案面板】";const temp_Cmtt={};temp_Cmtt.value = textToCopy;}</script>';
  await act(async()=>render(mask));const maskFrame=document.querySelector('iframe')!;await send(dom.window,'foreign mask');expect(writes).toHaveLength(4);await send(maskFrame.contentWindow,'【角色档案面板】');expect(writes).toHaveLength(5);expect(writes[4]).toBe('【角色档案面板】');expect(sends).toBe(0);expect(drafts).toBe(0);expect(maskFrame.getAttribute('sandbox')).toBe('allow-scripts');
  const hub='<div class="mufy-hub-container"><div class="mufy-cmd-card"><button class="mufy-copy-btn">COPY</button>'+[1,2,3,4,5,6].map(n=>'<div class="mufy-cmd-text" id="cmd'+n+'">public</div>').join('')+'</div></div><script>function mufyCopyCmd(elementId, btnObj){const textToCopy = document.getElementById(elementId).innerText;window.host.fillComposer(textToCopy)}</script>';
  await act(async()=>render(hub));const hubFrame=document.querySelector('iframe')!;await send(dom.window,'foreign hub');expect(writes).toHaveLength(5);await send(hubFrame.contentWindow,'public hub');expect(writes).toHaveLength(6);expect(writes[5]).toBe('public hub');expect(sends).toBe(0);expect(drafts).toBe(0);expect(hubFrame.getAttribute('sandbox')).toBe('allow-scripts');
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
