import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {extractNativeImageSidebars,nativeImageSidebarEnvelope,type NativeImageSidebar} from '../../../lib/opening/native-image-sidebar';

const config={id:'duanxin-image-island' as const,audioSrc:'https://music.163.com/song/media/outer/url?id=2125237427.mp3',avatars:Array.from({length:9},(_,i)=>`https://i.imgs.ovh/avatar-${i}.jpg`),emojis:Array.from({length:16},(_,i)=>`https://i.imgs.ovh/emoji-${i}.jpg`)};
const spec:NativeImageSidebar={version:1,variant:'image-island',documents:[],css:'#censy-island-container{top:16px}',shellHtml:'<div id="censy-island-container" class="censy-image-island collapsed"><div class="island-trigger-text">小岛</div><div class="island-content-area"><div class="nav-btn">音乐</div><div class="nav-btn">头像</div><div class="nav-btn">表情</div><div class="close-btn">收起上推</div><div class="tab-pane"><div id="censy-record"></div><button id="censy-play-btn">播放</button></div><div class="tab-pane"><div id="avatar-grid-box"></div></div><div class="tab-pane"><div id="emoji-grid-box"></div></div><div id="island-toast"></div></div></div>',imageIsland:config};
test('image island accepts only its bounded observed public resources and no documents',()=>{
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars).toHaveLength(1);
 for(const bad of [{...spec,documents:['<p>unexpected frame</p>']},{...spec,imageIsland:{...config,avatars:config.avatars.slice(1)}},{...spec,imageIsland:{...config,audioSrc:'https://example.com/song.mp3'}},{...spec,imageIsland:{...config,avatars:config.avatars.map((x,i)=>i===0?'https://user:secret@i.imgs.ovh/image.jpg':x)}},{...spec,imageIsland:{...config,emojis:config.emojis.map(()=>config.emojis[0])}}])expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(bad)).sidebars).toHaveLength(0);
});
test('image island tabs retain one unloaded audio and25 images across parent repaint; no scripted copy/play',async()=>{
 const dom=new JSDOM('<div id="fixture"></div>',{pretendToBeVisual:true});let pauseCalls=0,loadCalls=0;
 dom.window.HTMLMediaElement.prototype.pause=function(){pauseCalls++;};dom.window.HTMLMediaElement.prototype.load=function(){loadCalls++;};
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const{createRoot}=await import('react-dom/client'),{MufyImageIsland}=await import('../MufyImageIsland');const root=createRoot(document.getElementById('fixture')!);let open=false;const render=()=>root.render(<MufyImageIsland spec={{...spec,imageIsland:{...config}}} onOpenChange={value=>{open=value;}}/>);
 try{
  await act(async()=>render());const shadow=document.querySelector('.nj_image_island')!.shadowRoot!,island=shadow.querySelector('#censy-island-container')!,audio=shadow.querySelector('audio')!;
  expect(audio.getAttribute('src')).toBeNull();expect(audio.preload).toBe('none');expect(audio.loop).toBe(true);expect(shadow.querySelectorAll('iframe,script')).toHaveLength(0);expect(shadow.querySelectorAll('img')).toHaveLength(25);expect(open).toBe(false);
  await act(async()=>shadow.querySelector('.island-trigger-text')!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));expect(open).toBe(true);
  for(let i=0;i<3;i++){await act(async()=>shadow.querySelectorAll('.nav-btn')[i].dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));expect(shadow.querySelectorAll('.tab-pane.active')).toHaveLength(1);expect((shadow.querySelectorAll('.tab-pane')[i] as HTMLElement).style.display).toBe('block');}
  await act(async()=>render());expect(shadow.querySelector('audio')).toBe(audio);expect(shadow.querySelector('#censy-island-container')).toBe(island);expect(open).toBe(true);expect(shadow.querySelectorAll('img')).toHaveLength(25);
  await act(async()=>shadow.querySelector('#censy-play-btn')!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));expect(audio.getAttribute('src')).toBeNull();
  await act(async()=>shadow.querySelector('.grid-item')!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));expect(shadow.querySelector('#island-toast')!.classList.contains('show')).toBe(false);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(open).toBe(false);expect(shadow.querySelector('.island-content-area')!.getAttribute('aria-hidden')).toBe('true');
  await act(async()=>root.unmount());expect(pauseCalls).toBe(1);expect(loadCalls).toBe(1);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
