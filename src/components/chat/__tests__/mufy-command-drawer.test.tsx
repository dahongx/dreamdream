import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {extractNativeImageSidebars,nativeImageSidebarEnvelope,type NativeImageSidebar} from '@/lib/opening/native-image-sidebar';
test('native commands fill drafts only, survive redraw and keep recoverable scoped preferences',async()=>{
 const dom=new JSDOM('<div id="root"></div><input id="outside">',{url:'http://localhost/command-fixture'});
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [k,v] of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{MufyCommandDrawer}=await import('../MufyCommandDrawer');
 const root=createRoot(document.getElementById('root')!);let draft='',opened=false;
 const spec:NativeImageSidebar={version:1,variant:'command-drawer',css:'.cen-cmd-panel{color:#555}',documents:[],commandDrawer:{id:'fixture',commands:[{title:'known',content:'original text'}]},shellHtml:'<div id="Ks_wrapper_v2" class="native-command-sidebar"><div id="cen-cmd-toggle" onclick="evil()"></div><div id="Mg_board_v2"><span id="cen-cmd-close"></span><div id="cen-cmd-ul"></div><input id="cen-new-title"><textarea id="cen-new-content"></textarea><button id="cen-save-btn">save</button></div><script>evil()</script></div>'};
 const render=async(characterId='a')=>act(async()=>root.render(<MufyCommandDrawer spec={structuredClone(spec)} characterId={characterId} onFillComposer={text=>{draft=text;}} onOpenChange={open=>{opened=open;}}/>));
 try{
  expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars.length).toBe(1);
  expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...spec,documents:['<p>untrusted</p>']})).sidebars.length).toBe(0);
  await render();const host=document.querySelector('[data-nj-command-drawer]')!,shadow=host.shadowRoot!,q=(s:string)=>shadow.querySelector<HTMLElement>(s)!;
  expect(shadow.querySelector('script,[onclick],iframe')).toBeNull();
  await act(async()=>q('#cen-cmd-toggle').click());expect(opened).toBe(true);
  const input=q('#cen-new-title') as HTMLInputElement,body=q('#cen-new-content') as HTMLTextAreaElement;input.value='custom';body.value='custom payload';
  await act(async()=>q('#cen-save-btn').click());expect(shadow.querySelectorAll('.nj_command_pick').length).toBe(2);expect(draft).toBe('');
  await render();expect(shadow.querySelector('#cen-new-title')).toBe(input);expect(opened).toBe(true);
  await act(async()=>q('.nj_command_pick').click());expect(draft).toBe('original text');expect(opened).toBe(false);
  await act(async()=>q('#cen-cmd-toggle').click());await act(async()=>q('.cen-cmd-del').click());expect(shadow.querySelectorAll('.nj_command_pick').length).toBe(1);
  await act(async()=>q('.nj_command_status button').click());expect(shadow.querySelectorAll('.nj_command_pick').length).toBe(2);
  await act(async()=>document.getElementById('outside')!.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true})));expect(opened).toBe(false);
  await render('b');expect(shadow.querySelectorAll('.nj_command_pick').length).toBe(1);await render('a');expect(shadow.querySelectorAll('.nj_command_pick').length).toBe(2);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const [k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
