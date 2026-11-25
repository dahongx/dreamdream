import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import type {PublicMap} from '../../../lib/opening/public-map';
test('native map keeps queued notifications through parent repaint, replaces old queue and cleans up',async()=>{
 const dom=new JSDOM('<header id="nj_chat_header"></header><div id="fixture"></div>',{pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 const{createRoot}=await import('react-dom/client'),{MufyPublicMap}=await import('../MufyPublicMap');
 const spec:PublicMap={name:'测试角色',avatar:'https://cdn.mufy.ai/images/test/public',css:'.map-art-board{height:500px}.map-node{cursor:pointer}',document:'<div class="map-art-board"><svg>'+[0,1,2,3].map(i=>`<g class="map-node" onclick="dangerous()"><text>节点${i}</text></g>`).join('')+'</svg><script>throw Error("must not run")</script></div>',messages:[['一','二','三','四'],['甲','乙','丙','丁'],['A','B','C','D'],['a','b','c','d']]};
 const root=createRoot(document.getElementById('fixture')!);const render=()=>root.render(<MufyPublicMap spec={{...spec,messages:spec.messages.map(x=>[...x])}} widgetKey="map"/>);
 try{
  await act(async()=>render());const shadow=document.querySelector('[data-nj-public-map]')!.shadowRoot!;
  expect(shadow.querySelectorAll('script,iframe,[onclick]')).toHaveLength(0);expect(shadow.querySelectorAll('[role="button"]')).toHaveLength(4);
  await act(async()=>{shadow.querySelector('.map-node')!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,80));});
  expect(document.querySelector('[role=status]')!.textContent).toContain('一');
  await act(async()=>render());
  await act(async()=>{await new Promise(r=>setTimeout(r,2050));});
  expect(document.querySelector('[role=status]')!.textContent).toContain('二');
  await act(async()=>{shadow.querySelectorAll('.map-node')[1].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await new Promise(r=>setTimeout(r,80));});
  expect(document.querySelector('[role=status]')!.textContent).toContain('甲');
  await act(async()=>root.unmount());expect(document.querySelector('[role=status]')).toBeNull();
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
// Real two-second source cadence plus cold JSDOM/import setup can exceed Bun's
// default five-second limit on a busy desktop. Assertions and cadence stay real.
},20000);
