import {expect,mock,test} from 'bun:test';
import {act,createElement} from 'react';
import {JSDOM} from 'jsdom';

mock.module('@/i18n/client',()=>({useI18n:()=>({locale:'zh'})}));

test('TEST standalone video retains its sandbox but receives no host bridge or context',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'http://115.29.213.73:8091/chat/fixture'});
 let channels=0;
 class FakeChannel{
  port1={onmessage:null,postMessage(){},close(){}};
  port2={postMessage(){},close(){}};
  constructor(){channels++;}
 }
 const globals={window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,MessageEvent:dom.window.MessageEvent,MessageChannel:FakeChannel,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client');
 const {RegexIframe}=await import('../RegexIframe');
 const root=createRoot(document.getElementById('root')!);
 const props={ruleId:'fixture',ruleName:'fixture',srcdoc:'<div data-nj-doc><iframe src="//player.bilibili.com/player.html?bvid=fixture"></iframe></div>',captureGroups:['synthetic-private-capture'],character:{id:'fixture',name:'fixture',avatarUrl:null,tags:[],bio:null},userName:'synthetic-private-user',onSendMessage:()=>{throw Error('UNEXPECTED_SEND');},cssScope:'opening'};
 try{
  await act(async()=>root.render(createElement(RegexIframe,props)));
  const external=document.querySelector<HTMLIFrameElement>('iframe')!;
  expect(external.title).toBe('official-bilibili-fixture');
  expect(external.getAttribute('src')).toBe('https://player.bilibili.com/player.html?bvid=fixture');
  expect(external.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
  expect(external.hasAttribute('srcdoc')).toBe(false);
  const before=channels;
  await act(async()=>{
   external.dispatchEvent(new dom.window.Event('load'));
   window.dispatchEvent(new dom.window.MessageEvent('message',{source:external.contentWindow,data:{type:'nj_iframe_bridge_ready'}}));
  });
  expect(channels).toBe(before);
  expect(document.body.innerHTML).not.toContain('synthetic-private-user');
  expect(document.body.innerHTML).not.toContain('synthetic-private-capture');
  await act(async()=>root.render(createElement(RegexIframe,{...props,cssScope:'other'})));
  const ordinary=document.querySelector<HTMLIFrameElement>('iframe')!;
  expect(ordinary.title).toBe('regex-fixture');
  expect(ordinary.srcdoc).toContain("frame-src 'none'");
  expect(ordinary.getAttribute('sandbox')).toBe('allow-scripts');
  await act(async()=>root.render(null));
  dom.reconfigure({url:'https://dearm.ai/chat/fixture'});
  await act(async()=>root.render(createElement(RegexIframe,props)));
  const production=document.querySelector<HTMLIFrameElement>('iframe')!;
  expect(production.title).toBe('regex-fixture');
  expect(production.getAttribute('sandbox')).toBe('allow-scripts');
  expect(production.srcdoc).toContain("frame-src 'none'");
  expect(production.hasAttribute('src')).toBe(false);
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
