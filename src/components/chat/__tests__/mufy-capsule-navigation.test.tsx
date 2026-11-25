import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act,useRef} from 'react';
import {MufySourceControls,capsuleSearchNodes,uniqueSourceControls} from '../MufySourceControls';
import {nativeImageSidebarEnvelope,type NativeImageSidebar} from '@/lib/opening/native-image-sidebar';
import fixture from '../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/22/native-capsule/sidebar-spec.json';
test('capsule search is bounded, deduplicated, reversible and resilient to removed hits',async()=>{
 const dom=new JSDOM('<p dir="auto">alpha outside</p><div id="root"></div><div id="nj_chat_messages"><div class="nj_ai_message_bubble" style="box-shadow:1px 1px 2px red">ALPHA<p dir="auto">alpha nested</p></div><p dir="auto">alpha standalone</p><div class="nj_user_message_bubble">alpha user</div><div hidden><p dir="auto">alpha hidden</p></div><iframe></iframe></div>',{url:'http://localhost/capsule'}),globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!),spec=fixture as NativeImageSidebar;
 function Fixture(){const ref=useRef<HTMLTextAreaElement|null>(null);return <><textarea ref={ref}/><MufySourceControls spec={structuredClone(spec)} inputRef={ref} onChange={()=>{}}/></>;}
 try{
  const chat=document.getElementById('nj_chat_messages')!,tops:number[]=[];chat.scrollTo=(v:ScrollToOptions|number)=>{if(typeof v==='object')tops.push(v.top??0);};expect(capsuleSearchNodes(chat,'alpha')).toHaveLength(3);expect(capsuleSearchNodes(chat,'')).toHaveLength(0);
  expect(uniqueSourceControls([nativeImageSidebarEnvelope({...spec,pageControls:{...spec.pageControls!,scrollButtons:true}})])).toBeNull();
  await act(async()=>root.render(<Fixture/>));const shadow=document.querySelector('.nj_source_capsule_navigation')!.shadowRoot!,panel=shadow.querySelector<HTMLElement>('#cen_NAV_Search_Panel')!,hub=shadow.querySelectorAll<HTMLButtonElement>('#cen_nav_capsule_hub button'),query=shadow.querySelector<HTMLInputElement>('#CEN_MINI_SEARCH_INP')!,jump=shadow.querySelector<HTMLInputElement>('#CEN_MINI_JUMP_INP')!,buttons=panel.querySelectorAll<HTMLButtonElement>('button'),total=shadow.querySelector('#CEN_MINI_SEARCH_TOTAL')!;
  expect(Boolean(shadow.querySelector('script,iframe,[onclick]'))).toBe(false);expect(panel.style.display).toBe('none');expect(panel.inert).toBe(true);await act(async()=>hub[1].click());expect(panel.inert).toBe(false);query.value='alpha';await act(async()=>buttons[0].click());expect(total.textContent).toBe('3');expect(jump.value).toBe('1');expect(tops.length).toBe(1);
  const original=chat.querySelector<HTMLElement>('.nj_ai_message_bubble')!;await act(async()=>buttons[2].click());expect(jump.value).toBe('2');expect(original.style.boxShadow).toBe('1px 1px 2px red');jump.value='999';await act(async()=>jump.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'})));expect(jump.value).toBe('3');
  chat.querySelector('.nj_user_message_bubble')!.remove();await act(async()=>buttons[2].click());expect(total.textContent).toBe('2');expect(Number(jump.value)).toBeLessThanOrEqual(2);
  await act(async()=>root.render(<Fixture/>));expect(document.querySelector('.nj_source_capsule_navigation')!.shadowRoot).toBe(shadow);expect(query.value).toBe('alpha');
  query.value='missing';await act(async()=>buttons[0].click());expect(total.textContent).toBe('0');expect(jump.value).toBe('0');expect(query.value).toBe('missing');
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'})));expect(panel.inert).toBe(true);expect(panel.style.display).toBe('none');
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
