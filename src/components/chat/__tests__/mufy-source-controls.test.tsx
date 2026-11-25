import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act,useRef,useState} from 'react';
import {insertQuickSymbol,uniqueSourceControls} from '../MufySourceControls';
import {nativeImageSidebarEnvelope,type NativeImageSidebar} from '@/lib/opening/native-image-sidebar';
import heartFixture from '../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/41/native-heart-navigation/sidebar-spec.json';
import narrowFixture from '../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/43/native-narrow-navigation/sidebar-spec.json';
test('quick symbols replace selection and put cursor inside brackets without sending',()=>{
 expect(insertQuickSymbol('abc',1,2,'bracket')).toEqual({value:'a（）c',caret:2});
 expect(insertQuickSymbol('abc',3,3,'phone')).toEqual({value:'abc$线上聊天：',caret:9});
 expect(insertQuickSymbol('abc',-1,100,'dollar')).toEqual({value:'$',caret:1});
});

test('narrow four-arrow navigation scrolls only chat, preserves nodes and removes listeners',async()=>{
 const dom=new JSDOM('<div id="root"></div><div id="nj_chat_messages"></div><aside></aside>'),globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true},prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{MufySourceControls}=await import('../MufySourceControls'),root=createRoot(document.getElementById('root')!),spec=narrowFixture as NativeImageSidebar,render=()=>root.render(<MufySourceControls spec={structuredClone(spec)} inputRef={{current:null}} onChange={()=>{throw Error('NAV_MUST_NOT_EDIT');}}/>);
 try{
  expect(uniqueSourceControls([nativeImageSidebarEnvelope(spec)])?.pageControls?.navigation).toBe('narrow');expect(uniqueSourceControls([nativeImageSidebarEnvelope({...spec,shellHtml:'<div class="native-page-controls"></div>'})])).toBeNull();
  await act(async()=>render());const host=document.querySelector('.nj_source_narrow_navigation')!,shadow=host.shadowRoot!,buttons=shadow.querySelectorAll<HTMLElement>('.Cmtt_nbtn');expect(buttons).toHaveLength(4);expect(shadow.querySelector('script,iframe,[onpointerdown]')).toBeNull();expect(document.querySelector('.nj_source_quick_symbols')).toBeNull();expect(shadow.querySelector('style')!.textContent).toContain('#censy-narrow-nav-v14{position:fixed!important');
  const chat=document.getElementById('nj_chat_messages')!,tops:number[]=[];Object.defineProperty(chat,'scrollHeight',{value:1200});Object.defineProperty(chat,'clientHeight',{value:200});chat.scrollTo=(o:ScrollToOptions|number)=>{if(typeof o==='object'){tops.push(o.top??0);chat.scrollTop=Math.max(0,Math.min(1000,o.top??0));}};document.querySelector('aside')!.scrollTo=()=>{throw Error('UNRELATED_SCROLL');};
  for(const b of buttons)await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('pointerdown',{button:0,bubbles:true})));expect(tops).toEqual([0,-160,160,1200]);
  await act(async()=>render());expect(document.querySelector('.nj_source_narrow_navigation')!.shadowRoot).toBe(shadow);await act(async()=>buttons[0].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'})));expect(tops).toHaveLength(5);expect(tops.at(-1)).toBe(0);
  const nav=shadow.querySelector<HTMLElement>('#censy-narrow-nav-v14')!,handle=shadow.querySelector<HTMLElement>('.Tt_nbrand')!;nav.getBoundingClientRect=()=>new dom.window.DOMRect(0,0,22,216);await act(async()=>handle.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight'})));expect(nav.style.left).toBe('10px');
  await act(async()=>{nav.dispatchEvent(new dom.window.MouseEvent('pointerdown',{button:0,clientX:0,clientY:0,bubbles:true}));nav.dispatchEvent(new dom.window.MouseEvent('pointermove',{clientX:5000,clientY:5000,bubbles:true}));nav.dispatchEvent(new dom.window.MouseEvent('pointerup',{bubbles:true}));});expect(nav.style.left).toBe('1000px');expect(nav.style.top).toBe('552px');
  await act(async()=>root.unmount());buttons[0].dispatchEvent(new dom.window.MouseEvent('pointerdown',{button:0,bubbles:true}));expect(tops).toHaveLength(5);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});

test('source heart keeps authored shell, finite chat scrolling and keyboard state across repaint',async()=>{
 const dom=new JSDOM('<div id="root"></div><div id="nj_chat_messages"></div>');
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true},prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{MufySourceControls}=await import('../MufySourceControls'),root=createRoot(document.getElementById('root')!),spec=heartFixture as NativeImageSidebar;
 const render=()=>root.render(<MufySourceControls spec={structuredClone(spec)} inputRef={{current:null}} onChange={()=>{throw Error('HEART_MUST_NOT_EDIT_DRAFT');}}/>);
 try{
  expect(uniqueSourceControls([nativeImageSidebarEnvelope(spec)])?.pageControls?.navigation).toBe('heart');
  await act(async()=>render());const host=document.querySelector('.nj_source_heart_navigation')!,shadow=host.shadowRoot!,trigger=shadow.querySelector<HTMLElement>('#cen-v4-trigger')!,menu=shadow.querySelector<HTMLElement>('#cen-v4-menu')!;
  expect(document.querySelector('.nj_source_quick_symbols')).toBeNull();expect(menu.inert).toBe(true);expect(shadow.querySelectorAll('svg')).toHaveLength(4);expect(shadow.querySelector('script,iframe,[onclick]')).toBeNull();
  expect(shadow.querySelector('style')!.textContent).toContain('position:fixed!important');expect(shadow.querySelector('style')!.textContent).toContain('#cen-v4-trigger{pointer-events:auto}');
  await act(async()=>trigger.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(menu.inert).toBe(false);expect(trigger.getAttribute('aria-expanded')).toBe('true');
  await act(async()=>render());expect(document.querySelector('.nj_source_heart_navigation')!.shadowRoot).toBe(shadow);expect(menu.inert).toBe(false);
  const chat=document.getElementById('nj_chat_messages')!,tops:number[]=[];Object.defineProperty(chat,'scrollHeight',{value:1200});chat.scrollTo=(options:ScrollToOptions|number)=>{if(typeof options==='object')tops.push(options.top??0);};
  await act(async()=>shadow.querySelector<HTMLElement>('#cen-v4-down')!.click());await act(async()=>shadow.querySelector<HTMLElement>('#cen-v4-up')!.click());expect(tops).toEqual([1200,0]);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'})));expect(menu.inert).toBe(true);expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(uniqueSourceControls([nativeImageSidebarEnvelope({...spec,pageControls:{...spec.pageControls!,quickCss:'unexpected'}})])).toBeNull();
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
test('source controls retain native nodes, edit draft only and navigate only chat container',async()=>{
 const dom=new JSDOM('<div id="root"></div><div id="nj_chat_messages"></div>',{url:'http://localhost/controls'}),queue:FrameRequestCallback[]=[];
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(fn:FrameRequestCallback)=>queue.push(fn),cancelAnimationFrame:()=>{}};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),{MufySourceControls}=await import('../MufySourceControls'),root=createRoot(document.getElementById('root')!);
 const spec:NativeImageSidebar={version:1,variant:'page-controls',shellHtml:'<div class="native-page-controls"></div>',css:'.fox-btn{color:#aaa}',documents:[],pageControls:{id:'fixture',quickCss:'button{color:#eee}'}};
 const envelope=nativeImageSidebarEnvelope(spec);expect(uniqueSourceControls([envelope])?.variant).toBe('page-controls');expect(uniqueSourceControls([envelope,envelope])).toBeNull();
 let redraw=()=>{};function Fixture(){const[value,setValue]=useState('abc'),[n,setN]=useState(0),ref=useRef<HTMLTextAreaElement|null>(null);redraw=()=>setN(n+1);return <><textarea ref={ref} value={value} onChange={e=>setValue(e.target.value)}/><MufySourceControls spec={structuredClone(spec)} inputRef={ref} onChange={setValue}/></>;}
 try{
  await act(async()=>root.render(<Fixture/>));const host=document.querySelector('.nj_source_quick_symbols')!,input=document.querySelector('textarea')!;input.setSelectionRange(1,2);
  expect(host.shadowRoot!.querySelector('style')!.textContent).toContain('.symbol-panel button');
  expect(host.shadowRoot!.querySelector<HTMLElement>('[data-character-css]')!.style.fontFamily).toBe('ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"');
  await act(async()=>host.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click());expect(queue).toHaveLength(0);expect(input.value).toBe('a（）c');expect(input.selectionStart).toBe(2);
  await act(async()=>host.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')[1].click());expect(input.value).toBe('a（$）c');expect(input.selectionStart).toBe(3);
  await act(async()=>redraw());expect(document.querySelector('.nj_source_quick_symbols')).toBe(host);expect(document.querySelectorAll('iframe').length).toBe(0);
  const chat=document.getElementById('nj_chat_messages')!,tops:number[]=[];Object.defineProperty(chat,'scrollHeight',{value:1200});chat.scrollTo=(options:ScrollToOptions|number)=>{if(typeof options==='object')tops.push(options.top??0);};
  const scroll=document.querySelector('.nj_source_scroll_controls')!.shadowRoot!;await act(async()=>scroll.querySelectorAll<HTMLButtonElement>('button')[1].click());await act(async()=>scroll.querySelectorAll<HTMLButtonElement>('button')[0].click());expect(tops).toEqual([1200,0]);
  spec.pageControls!.scrollButtons=false;await act(async()=>redraw());expect(document.querySelector('.nj_source_scroll_controls')).toBeNull();expect(document.querySelector('.nj_source_quick_symbols')).toBe(host);
  expect(uniqueSourceControls([nativeImageSidebarEnvelope(spec)])?.pageControls?.scrollButtons).toBe(false);
  expect(uniqueSourceControls([nativeImageSidebarEnvelope({...spec,pageControls:{...spec.pageControls!,scrollButtons:'no' as unknown as boolean}})])).toBeNull();
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
