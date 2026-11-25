import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {extractNativeImageSidebars,nativeImageSidebarEnvelope,type NativeImageSidebar} from '@/lib/opening/native-image-sidebar';

const spec:NativeImageSidebar={version:1,variant:'ghost-focus-left',shellHtml:'<div class="ghost-sidebar-container" tabindex="0"><div class="menu-panel"><ul><li>$公开指令</li></ul></div><div class="toggle-button" onclick="bad()"><div class="arrow"></div></div><div data-nj-native-documents></div><script>bad()</script></div>',css:'.ghost-sidebar-container .menu-panel{width:135px;background:rgba(255,255,255,.08)}',documents:[]};
test('only the known static instructions envelope permits zero program documents',()=>{
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars).toHaveLength(1);
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...spec,variant:'black-focus'})).sidebars).toHaveLength(0);
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...spec,documents:['<p>unneeded program</p>']})).sidebars).toHaveLength(0);
});
test('static instructions keep focus state through parent updates and do not block an outside input',async()=>{
 const dom=new JSDOM('<div id="root"></div><textarea id="outside"></textarea>');
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{MufyGhostInstructions}=await import('../MufyGhostInstructions');
 const root=createRoot(document.getElementById('root')!),changes:boolean[]=[];
 const render=()=>root.render(<MufyGhostInstructions spec={{...spec}} widgetKey="ghost-fixture" onOpenChange={v=>changes.push(v)}/>);
 try{
  await act(async()=>render());const host=document.querySelector('[data-nj-ghost-instructions]')!,shadow=host.shadowRoot!,trigger=shadow.querySelector<HTMLElement>('.toggle-button')!;
  expect(shadow.querySelector('script')).toBeNull();expect(trigger.hasAttribute('onclick')).toBe(false);expect(shadow.querySelector('iframe')).toBeNull();expect(trigger.getAttribute('role')).toBe('button');expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await act(async()=>trigger.focus());expect(trigger.getAttribute('aria-expanded')).toBe('true');expect(changes.at(-1)).toBe(true);
  await act(async()=>render());expect(shadow.querySelector('.toggle-button')).toBe(trigger);expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const outside=document.getElementById('outside') as HTMLTextAreaElement;
  const event=new dom.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true});await act(async()=>{outside.dispatchEvent(event);outside.focus();});
  expect(event.defaultPrevented).toBe(false);expect(document.activeElement).toBe(outside);expect(trigger.getAttribute('aria-expanded')).toBe('false');expect((host as HTMLElement).style.width).toBe('18px');expect((host as HTMLElement).style.height).toBe('36px');expect((host as HTMLElement).style.pointerEvents).toBe('none');
  await act(async()=>{trigger.focus();trigger.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(changes.at(-1)).toBe(false);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of prior)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
});
