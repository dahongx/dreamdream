/** Isolated real-browser exercise of the production HTTP fallback. */
import {copyTextToClipboard} from '../src/lib/util/clipboard';
const root=document.querySelector('#copy-widget')!.attachShadow({mode:'open'});
const frame=document.createElement('iframe');
frame.title='HTTP fallback copy fixture';frame.sandbox.add('allow-scripts');
frame.srcdoc=`<!doctype html><html><body><button id="copy-a">复制公开测试 A</button><button id="copy-b">复制公开测试 B</button><script>document.addEventListener('click',function(e){if(!e.isTrusted||!/^copy-[ab]$/.test(e.target.id))return;parent.postMessage({type:'fixture-copy',id:e.target.id,text:e.target.id==='copy-a'?'公开复制验收 A：银杏叶':'公开复制验收 B：换一段文字'},'*');});</script></body></html>`;
root.append(frame);
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.data?.type!=='fixture-copy'||!['copy-a','copy-b'].includes(event.data.id)||typeof event.data.text!=='string')return;
 const active=navigator.userActivation.isActive;
 const ok=active&&await copyTextToClipboard(event.data.text);
 document.querySelector('#copy-result')!.textContent=JSON.stringify({id:event.data.id,active,ok,focusedFrame:document.activeElement===document.querySelector('#copy-widget')});
});
