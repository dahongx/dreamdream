import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {buildIframeIncrementalScript,iframeProgramKey} from '../regex/iframe-incremental';
import {buildIframeSrcdoc} from '../regex/iframe-bridge';

const html=(tail:string)=>`<style data-mufy-source-skin>summary{color:cyan}</style><div class="mufy-source-canvas"><details id="state"><summary>躯壳与心念</summary><p>状态</p></details><p id="text">${tail}</p></div>`;
function setup(){const seed=html('新');const dom=new JSDOM(seed,{runScripts:'outside-only'});const script=buildIframeIncrementalScript(seed).replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'');dom.window.eval(script);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));return dom;}
function update(dom:JSDOM,body:string,sequence:number,source:unknown=dom.window.parent){dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source:source as Window,type:'message',data:{type:'nj-mufy-stream-update',html:body,sequence}}));}

test('text growth keeps its executable/style document key stable; new programs do not',()=>{
 expect(iframeProgramKey(html('新'))).toBe(iframeProgramKey(html('新增文字')));
 expect(iframeProgramKey(html('新')+'<script>newProgram()</script>')).not.toBe(iframeProgramKey(html('新')));
});
test('many incremental updates retain the same title, details, listener, open state and text node',()=>{
 const dom=setup(),d=dom.window.document,fold=d.querySelector('details')!,summary=d.querySelector('summary')!,text=d.querySelector('#text')!.firstChild;
 fold.open=true;let clicked=0;summary.addEventListener('click',()=>clicked++);
 const generated=d.createElement('span');generated.textContent='author generated';fold.append(generated);
 for(let i=1;i<=30;i++)update(dom,html('新增文字'+i),i);
 expect(d.querySelector('details')).toBe(fold);expect(d.querySelector('summary')).toBe(summary);
 expect(fold.open).toBe(true);expect(fold.contains(generated)).toBe(true);
 expect(d.querySelector('#text')!.firstChild).toBe(text);expect(text!.textContent).toBe('新增文字30');
 summary.dispatchEvent(new dom.window.Event('click'));expect(clicked).toBe(1);dom.window.close();
});
test('new partial elements can complete without discarding previous folds',()=>{
 const dom=setup(),d=dom.window.document,fold=d.querySelector('details');
 update(dom,html('新增') .replace('</div>','<details id="memory"><summary>记忆</summary></details></div>'),1);
 const memory=d.querySelector('#memory');expect(memory).not.toBeNull();
 update(dom,html('新增文字').replace('</div>','<details id="memory"><summary>记忆</summary><p>追加</p></details></div>'),2);
 expect(d.querySelector('details')).toBe(fold);expect(d.querySelector('#memory')).toBe(memory);expect(memory!.textContent).toContain('追加');dom.window.close();
});
test('foreign senders and stale/out-of-order chunks cannot overwrite the canvas',()=>{
 const dom=setup();update(dom,html('正确'),3);update(dom,html('过期'),2);update(dom,html('外来'),4,{});
 expect(dom.window.document.querySelector('#text')!.textContent).toBe('正确');dom.window.close();
});
test('opt-in does not weaken CSP or change the default artifact route',()=>{
 const normal=buildIframeSrcdoc({srcdoc:html('新'),captureGroups:[]});
 const stream=buildIframeSrcdoc({srcdoc:html('新'),captureGroups:[],incrementalUpdates:true});
 expect(normal).not.toContain('data-nj-incremental-bridge');expect(stream).toContain('data-nj-incremental-bridge');
 expect(stream).toContain("connect-src 'none'");expect(stream).toContain("frame-src 'none'");
 expect(buildIframeIncrementalScript('</script><p>safe</p>')).not.toContain('})('+'"</script>');
});
