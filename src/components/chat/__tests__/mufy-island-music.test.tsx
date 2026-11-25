import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {MufyCloudMusic} from '../MufyCloudMusic';
import {validNativeCloudMusic,type NativeImageSidebar} from '@/lib/opening/native-image-sidebar';
import fixture from '../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/22/native-island-music/sidebar-spec.json';
import multiFixture from '../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/43/native-multimodule-island/sidebar-spec.json';

test('island player owns only native audio and isolated preferences across repaint, pause, mode and cleanup',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/island'}),globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 let paused=true,plays=0;Object.defineProperty(dom.window.HTMLMediaElement.prototype,'paused',{get:()=>paused});dom.window.HTMLMediaElement.prototype.play=function(){plays++;paused=false;this.dispatchEvent(new dom.window.Event('play'));return Promise.resolve();};dom.window.HTMLMediaElement.prototype.pause=function(){paused=true;this.dispatchEvent(new dom.window.Event('pause'));};dom.window.HTMLMediaElement.prototype.load=()=>{};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!),spec=fixture as NativeImageSidebar,render=()=>root.render(<MufyCloudMusic spec={structuredClone(spec)} characterId="test-island" onOpenChange={()=>{}}/>);
 try{
  expect(validNativeCloudMusic(spec.cloudMusic)).toBe(true);expect(validNativeCloudMusic({...spec.cloudMusic,layout:'unknown'})).toBe(false);
  await act(async()=>render());const host=document.querySelector('[data-nj-island-music]')!,shadow=host.shadowRoot!,audio=shadow.querySelector('audio')!,mini=shadow.querySelector<HTMLElement>('.island-mini-view')!,play=shadow.querySelector<HTMLElement>('.btn-play')!;
  expect(shadow.querySelector<HTMLElement>('.plist-item span:last-child')!.style.fontSize).toBe('10px');expect(shadow.querySelector('script,iframe,[onclick]')).toBeNull();expect(plays).toBe(0);expect(shadow.querySelector<HTMLElement>('.island-expanded-view')!.inert).toBe(true);
  await act(async()=>mini.click());expect(mini.getAttribute('aria-expanded')).toBe('true');await act(async()=>play.click());expect(plays).toBe(1);expect(paused).toBe(false);audio.currentTime=12;
  await act(async()=>render());expect(shadow.querySelector('audio')).toBe(audio);expect(audio.currentTime).toBe(12);expect(paused).toBe(false);
  await act(async()=>audio.pause());expect(play.getAttribute('aria-label')).toBe('播放');await act(async()=>play.click());expect(plays).toBe(2);
  const mode=shadow.querySelector<HTMLElement>('#mode-btn-v3')!;await act(async()=>mode.click());expect(mode.textContent).toBe('单曲循环');await act(async()=>mode.click());expect(mode.textContent).toBe('随机播放');await act(async()=>mode.click());expect(mode.textContent).toBe('列表循环');
  await act(async()=>shadow.querySelectorAll<HTMLButtonElement>('.ctrl-btn')[2].click());expect(shadow.querySelector('#exp-title')!.textContent).toBe('寂寞作伴');expect(audio.src).toContain('1806634682');expect(JSON.parse(window.localStorage.getItem('nj_mufy_island_test-island_jiangzhi-island-v3')!).index).toBe(1);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'})));expect(mini.getAttribute('aria-expanded')).toBe('false');expect(shadow.querySelector<HTMLElement>('.island-expanded-view')!.inert).toBe(true);
  await act(async()=>mini.click());await act(async()=>document.body.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true,composed:true})));expect(mini.getAttribute('aria-expanded')).toBe('false');
  await act(async()=>mini.click());await act(async()=>play.click());let finish:(()=>void)|undefined;dom.window.HTMLMediaElement.prototype.play=function(){return new Promise<void>(resolve=>{finish=resolve;});};
  await act(async()=>play.click());expect(play.getAttribute('aria-label')).toBe('取消加载');expect(host.getAttribute('data-nj-audio-status')).toBe('loading');
  await act(async()=>play.click());await act(async()=>finish?.());expect(play.getAttribute('aria-label')).toBe('播放');expect(host.getAttribute('data-nj-audio-status')).toBe('paused');expect(paused).toBe(true);
  await act(async()=>root.unmount());expect(paused).toBe(true);expect(audio.getAttribute('src')).toBeNull();
 }finally{dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});

test('three-module island retains relations, all commands, source modes and caret insertion through repaint',async()=>{
 const room=await Bun.file('src/components/chat/ChatRoom.tsx').text(),slot=await Bun.file('src/components/chat/FloatingSlot.tsx').text();expect(room.match(/<FloatingSlot\b[\s\S]*?\/>/)?.[0]).toContain('onReplaceComposer={setInput}');expect(slot.match(/<FloatingWidgets\b[\s\S]*?\/>/)?.[0]).toContain('onReplaceComposer={onReplaceComposer}');
 const dom=new JSDOM('<div id="root"></div><textarea id="nj_chat_input_textarea"></textarea>',{url:'http://localhost/island-v4'}),globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,HTMLTextAreaElement:dom.window.HTMLTextAreaElement,requestAnimationFrame:(fn:FrameRequestCallback)=>{fn(0);return 1;},IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 let paused=true;dom.window.HTMLMediaElement.prototype.play=function(){paused=false;return Promise.resolve();};dom.window.HTMLMediaElement.prototype.pause=function(){paused=true;};dom.window.HTMLMediaElement.prototype.load=()=>{};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!),spec=multiFixture as NativeImageSidebar,input=document.querySelector('textarea')!;let filled=0;
 const render=()=>root.render(<MufyCloudMusic spec={structuredClone(spec)} characterId="multi-test" onOpenChange={()=>{}} onReplaceComposer={text=>{filled++;input.value=text;}}/>);
 try{
  expect(validNativeCloudMusic(spec.cloudMusic)).toBe(true);expect(validNativeCloudMusic({...spec.cloudMusic,multiModule:{...spec.cloudMusic!.multiModule,modeLabels:['bad']}})).toBe(false);
  await act(async()=>render());const host=document.querySelector('[data-nj-island-music]')!,shadow=host.shadowRoot!,audio=shadow.querySelector('audio')!,mini=shadow.querySelector<HTMLElement>('.island-mini-view')!;
  expect(shadow.querySelector('script,iframe,[onclick]')).toBeNull();expect(shadow.querySelectorAll('.lore-card')).toHaveLength(6);expect(shadow.querySelectorAll('.cmd-item')).toHaveLength(26);expect(paused).toBe(true);
  await act(async()=>mini.click());const tabs=shadow.querySelectorAll<HTMLElement>('.island-tab');await act(async()=>tabs[1].click());expect(shadow.querySelector('#module-1')!.classList.contains('active')).toBe(true);expect(shadow.querySelector<HTMLElement>('#module-0')!.inert).toBe(true);expect(shadow.querySelector<HTMLElement>('#module-0')!.style.display).toBe('none');expect(shadow.querySelector<HTMLElement>('#module-1')!.style.display).toBe('flex');await act(async()=>tabs[2].click());expect(shadow.querySelector('#module-2')!.classList.contains('active')).toBe(true);expect(shadow.querySelector<HTMLElement>('#module-1')!.style.display).toBe('none');
  expect(shadow.querySelector<HTMLElement>('.plist-item span:last-child')!.style.fontSize).toBe('11px');const commands=shadow.querySelectorAll<HTMLElement>('.cmd-item');for(let i=0;i<commands.length;i++){input.value='前后';input.setSelectionRange(1,1);await act(async()=>commands[i].click());expect(input.value).toBe('前'+spec.cloudMusic!.multiModule!.commands[i].content+'后');expect(input.selectionStart).toBe(1+spec.cloudMusic!.multiModule!.commands[i].content.length);}expect(filled).toBe(26);
  await act(async()=>render());expect(shadow.querySelector('audio')).toBe(audio);expect(shadow.querySelector('#module-2')!.classList.contains('active')).toBe(true);expect(shadow.querySelectorAll('.cmd-item')).toHaveLength(26);
  await act(async()=>tabs[0].click());const mode=shadow.querySelector<HTMLElement>('#mode-btn-v4')!;expect(mode.textContent).toBe('循环如环');await act(async()=>mode.click());expect(mode.textContent).toBe('执念单曲');await act(async()=>mode.click());expect(mode.textContent).toBe('随缘散播');
  await act(async()=>shadow.querySelector<HTMLElement>('.ios-home-bar-wrapper')!.click());expect(mini.getAttribute('aria-expanded')).toBe('false');
  const rank59Spec = structuredClone(spec);
  rank59Spec.cloudMusic!.id = 'rank59-island-v4';
  await act(async()=>root.render(<MufyCloudMusic spec={rank59Spec} characterId="rank59-test" onOpenChange={()=>{}}/>));
  await act(async()=>mini.click());
  await act(async()=>input.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true,composed:true})));
  expect(mini.getAttribute('aria-expanded')).toBe('true');
  await act(async()=>shadow.querySelector<HTMLElement>('.ios-home-bar-wrapper')!.click());
  expect(mini.getAttribute('aria-expanded')).toBe('false');
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
