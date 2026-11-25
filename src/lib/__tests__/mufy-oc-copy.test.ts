import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {sourceComponentFallbacks,hasPublicEngravedOpening,hasPublicAvatarLibrary,hasPublicCommandCopy,hasPublicMaskExtraction,hasPublicHubCommandCopy} from '../regex/iframe-bridge';

const hubCommand='<div class="mufy-hub-container">'+[1,2,3,4,5,6].map(n=>`<div class="mufy-cmd-card"><div class="mufy-cmd-text" id="cmd${n}">公开指令${n}</div><button class="mufy-copy-btn" onclick="mufyCopyCmd('cmd${n}', this)">COPY</button></div>`).join('')+'</div><script>function mufyCopyCmd(elementId, btnObj){const textToCopy = document.getElementById(elementId).innerText;navigator.clipboard.writeText(textToCopy)}</script>';
test('finite glass hub copies public commands without drafts and retains legacy candidate recognition',()=>{
 expect(hasPublicHubCommandCopy(hubCommand)).toBe(true);expect(hasPublicCommandCopy(hubCommand)).toBe(true);
 expect(hasPublicHubCommandCopy(hubCommand.replace('cmd6','other'))).toBe(false);
 expect(hasPublicHubCommandCopy(hubCommand.replace('mufy-hub-container','other'))).toBe(false);
 expect(hasPublicHubCommandCopy(hubCommand.replace('navigator.clipboard.writeText(textToCopy)','window.host.fillComposer(textToCopy)'))).toBe(true);
 const script=sourceComponentFallbacks(hubCommand);expect(script).toContain('public-hub-command-copy');expect(script).toContain('event.isTrusted');expect(script).toContain('event.source!==window.parent');expect(script).toContain('form.contains(output)');expect(script).not.toContain('readText');expect(script).not.toContain('host.fillComposer');
 const dom=new JSDOM(hubCommand,{runScripts:'outside-only'});dom.window.eval(script.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));dom.window.document.querySelector<HTMLButtonElement>('button')!.click();expect(dom.window.document.querySelector('[data-copy-result]')).toBeNull();dom.window.close();
});
test('hub timeout is unconfirmed, accepts only its late matching host receipt, and retries original labels',()=>{
 const dom=new JSDOM(hubCommand,{runScripts:'outside-only'}),form=dom.window.document.querySelector('.mufy-hub-container')!,buttons=dom.window.document.querySelectorAll<HTMLButtonElement>('button');
 let click:((event:unknown)=>void)|undefined;const add=form.addEventListener.bind(form);form.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==='click')click=listener as (event:unknown)=>void;else add(type,listener,options);}) as typeof form.addEventListener;
 const timers:Array<()=>void>=[],writes:unknown[]=[];dom.window.setTimeout=((fn:()=>void)=>{timers.push(fn);return timers.length;}) as typeof dom.window.setTimeout;dom.window.clearTimeout=()=>{};dom.window.postMessage=((value:unknown)=>writes.push(value)) as typeof dom.window.postMessage;
 dom.window.eval(sourceComponentFallbacks(hubCommand).match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 const gesture=(target:Element)=>click!({target,isTrusted:true,preventDefault(){},stopImmediatePropagation(){}});
 const ack=(id:number,source:MessageEventSource|null=dom.window)=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source,data:{type:'nj-oc-profile-copy-result',id,ok:true}}));
 gesture(buttons[0]);expect(writes).toHaveLength(1);expect(buttons[0].dataset.copyResult).toBe('pending');timers.shift()!();expect(buttons[0].dataset.copyResult).toBe('unconfirmed');expect(buttons[0].disabled).toBe(false);
 ack(1,null);ack(2);expect(buttons[0].dataset.copyResult).toBe('unconfirmed');ack(1);expect(buttons[0].dataset.copyResult).toBe('copied');timers.shift()!();expect(buttons[0].textContent).toBe('COPY');
 gesture(buttons[1]);timers.shift()!();gesture(buttons[1]);ack(2);expect(buttons[1].dataset.copyResult).toBe('pending');ack(3);expect(buttons[1].textContent).toBe('COPIED');dom.window.close();
});

const form=`<div id="oc-generator"><button onclick="ocCopy()">复制文本</button><button onclick="ocClear()">清空重填</button><div id="oc-output-wrap"><pre id="oc-output-text">验收玩家：28</pre></div></div><script>function ocCopy(){}function ocFallbackCopy(){}function ocClear(){}</script>`;
const publicCommand=`<div class="cen_cmd_wrap_Sx"><div class="cold_tank_item" data-command="公开指令"><button class="Z_CONFIG_btn" onclick="censyCopyFn_v1(this)">COPY</button><div class="Mm_toast"></div></div></div><script>function censyCopyFn_v1(btn){const parentItem=btn.closest('.cold_tank_item');const fullCommand=parentItem.getAttribute('data-command');navigator.clipboard.writeText(fullCommand)}</script>`;
const maskForm='<div id="censy-mask-form-v7-white"><div id="cm-form-content-v7">'+['name','role','personality','appearance','preference','extra'].map(id=>`<input id="cm-${id}-v7">`).join('')+'</div><button id="cm-copy-btn-v7" onclick="window.censyExtractDataV7()">提取面具</button></div><script>function censyExtractDataV7(){let textToCopy="【角色档案面板】";const temp_Cmtt={};temp_Cmtt.value = textToCopy;}</script>';
test('finite mask extraction reads only the six visible form fields and waits for clipboard acknowledgement',()=>{expect(hasPublicMaskExtraction(maskForm)).toBe(true);expect(hasPublicMaskExtraction(maskForm.replace('cm-extra-v7','other'))).toBe(false);let script=sourceComponentFallbacks(maskForm);expect(script).toContain('public-mask-copy');expect(script).toContain("i===5?'无':'未录入'");expect(script).toContain('(注：这个是基础面具，可进行修改增加)');expect(script).not.toContain('host.fillComposer');expect(script).not.toContain('readText');const dom=new JSDOM(maskForm,{runScripts:'outside-only'});dom.window.eval(script.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));dom.window.document.querySelector<HTMLButtonElement>('button')!.click();expect(dom.window.document.querySelector('[data-copy-result="copied"]')).toBeNull();dom.window.close();});
test('finite public command COPY remains write-only and refuses synthetic success',()=>{expect(hasPublicCommandCopy(publicCommand)).toBe(true);expect(hasPublicCommandCopy(publicCommand.replace('cen_cmd_wrap_Sx','other'))).toBe(false);const script=sourceComponentFallbacks(publicCommand);expect(script).toContain('public-command-copy');expect(script).toContain('event.isTrusted');expect(script).toContain('event.source!==window.parent');expect(script).not.toContain('host.fillComposer');expect(script).not.toContain('readText');const dom=new JSDOM(publicCommand,{runScripts:'outside-only'});dom.window.eval(script.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));dom.window.document.querySelector<HTMLButtonElement>('button')!.click();expect(dom.window.document.querySelector('[data-copy-result="copied"]')).toBeNull();dom.window.close();});
function setup(){
 const dom=new JSDOM(form,{runScripts:'outside-only'});
 const script=sourceComponentFallbacks(form).match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
 dom.window.eval(script);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 return {dom,copy:()=>dom.window.document.querySelector<HTMLButtonElement>('button')!.click(),status:()=>dom.window.document.querySelector<HTMLElement>('[data-mufy-copy-status]')!};
}
describe('public OC profile native clipboard fallback',()=>{
 test('only enables for the known form; leaves generic pending polyfill and sandbox alone',()=>{
  expect(sourceComponentFallbacks('<button onclick="ocCopy()">复制</button>')).not.toContain('oc-profile-copy');
  const script=sourceComponentFallbacks(form);expect(script).toContain('oc-profile-copy');expect(script).not.toContain('host.');expect(script).not.toContain('readText');expect(script).not.toContain('allow-same-origin');expect(script).toContain('event.isTrusted');expect(script).toContain('event.source!==window.parent');
 });
 test('programmatic clicks never report success or request clipboard writes',()=>{
  const s=setup();s.copy();expect(s.status().dataset.copyResult).toBeUndefined();expect(s.dom.window.document.querySelector('textarea')).toBeNull();
  s.dom.window.document.querySelectorAll<HTMLButtonElement>('button')[1].click();expect(s.status().hidden).toBe(true);expect(s.status().textContent).toBe('');s.dom.window.close();
 });
 test('does not copy an empty profile or accept unsolicited success acknowledgements',()=>{
  const s=setup();s.dom.window.document.getElementById('oc-output-text')!.textContent='';s.copy();expect(s.status().dataset.copyResult).toBe('empty');
  s.dom.window.dispatchEvent(new s.dom.window.MessageEvent('message',{data:{type:'nj-oc-profile-copy-result',id:1,ok:true}}));expect(s.status().dataset.copyResult).toBe('empty');s.dom.window.close();
 });
});

test('avatar library keeps original clipboard semantics for original and legacy draft candidates',()=>{
 const original=`<div class="censy-avatar-wrapper"><details><summary>Avatar Library</summary><div class="censy-avatar-content"><img class="censy-avatar-img" src="https://example.com/public.png" onclick="navigator.clipboard.writeText(this.src);alert('Image Link Copied!')"></div></details></div>`;
 const legacy=original.replace("navigator.clipboard.writeText(this.src);alert('Image Link Copied!')","window.host.fillComposer(this.src);alert('已填入草稿，请确认后发送。')");
 const migratedCopiedLabel=legacy.replace("alert('已填入草稿，请确认后发送。')","alert('Copied!')");
 expect(hasPublicAvatarLibrary(migratedCopiedLabel)).toBe(true);
 expect(sourceComponentFallbacks(migratedCopiedLabel)).toContain('avatar-library-copy');
 for(const html of[original,legacy]){expect(hasPublicAvatarLibrary(html)).toBe(true);const script=sourceComponentFallbacks(html);expect(script).toContain('avatar-library-copy');expect(script).toContain('event.isTrusted');expect(script).toContain('event.stopImmediatePropagation()');expect(script).not.toContain('host.fillComposer');expect(script).not.toContain('readText');expect(script).not.toContain('allow-modals');const dom=new JSDOM(html,{runScripts:'outside-only'});dom.window.eval(script.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));dom.window.document.querySelector<HTMLImageElement>('img')!.click();expect(dom.window.document.querySelector('[data-copy-result="copied"]')).toBeNull();dom.window.close();}
 expect(hasPublicAvatarLibrary(original.replace('censy-avatar-wrapper','ordinary'))).toBe(false);
 const second=original.replace('Avatar Library','AVATAR <span>LIBRARY</span>').replace("alert('Image Link Copied!')","alert('Copied!')");expect(hasPublicAvatarLibrary(second)).toBe(true);expect(sourceComponentFallbacks(second)).toContain('avatar-library-copy');expect(hasPublicAvatarLibrary(second.replace("navigator.clipboard.writeText(this.src);alert('Copied!')",'arbitraryCall()'))).toBe(false);
});
test('engraved opening uses the same finite write-only acknowledgement without enabling generic buttons',()=>{
 const engraved=`<div class="mufy-glass-openings"><div class="mufy-glass-content"><button class="mufy-pill-btn" onclick="var btn=this;var text=btn.closest('.mufy-glass-content').querySelector('.mufy-engraved-text').innerText;navigator.clipboard.writeText(text)">一键提取</button><div class="mufy-engraved-text">公开开场</div></div></div>`;
 expect(hasPublicEngravedOpening(engraved)).toBe(true);expect(hasPublicEngravedOpening(engraved.replace('navigator.clipboard.writeText(text)','other()'))).toBe(false);
 const script=sourceComponentFallbacks(engraved);expect(script).toContain('engraved-opening-copy');expect(script).toContain('output.innerText||output.textContent');expect(script).toContain('event.isTrusted');expect(script).not.toContain('readText');expect(script).not.toContain('host.fillComposer');
 const dom=new JSDOM(engraved,{runScripts:'outside-only'});dom.window.eval(script.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));dom.window.document.querySelector<HTMLButtonElement>('button')!.click();expect(dom.window.document.querySelector('[data-copy-result="copied"]')).toBeNull();dom.window.close();
});
