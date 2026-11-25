import {expect,mock,test} from 'bun:test';
import {act,createElement,useEffect,useRef} from 'react';
import {JSDOM} from 'jsdom';

// Synthetic renderer only. It reports geometry in the child's first passive
// effect, before a parent's later program-change effect could erase the data.
mock.module('@/components/regex/RegexIframe',()=>({RegexIframe:({srcdoc}:{srcdoc:string})=>{
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{
  window.dispatchEvent(new MessageEvent('message',{source:frame.current!.contentWindow,data:{type:'mufy-reply-pet-bounds',x:280,y:634,width:90,height:90,viewportWidth:390,viewportHeight:844}}));
 },[srcdoc]);
 return createElement('iframe',{ref:frame,title:'synthetic-pet'});
}}));

test('early geometry survives program commit and an identical-segment rerender',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><main id="test-root"></main></body></html>');
 const globals={window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,MessageEvent:dom.window.MessageEvent,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 const {createRoot}=await import('react-dom/client');
 const {MufyReplyPet}=await import('../MufyReplyPet');
 const root=createRoot(document.getElementById('test-root')!);
 const program='<template id="censy-gu-pet-host"><div id="censy-gu-pet-wrapper"><div id="CenGu_Zone"><img class="CenGu_Img"></div></div><div id="CenGu_QianOverlay"></div><script>pWin.CenGu_openIdeas=function(){};</script></template>';
 const props={segments:[{type:'iframe' as const,ruleId:'fixture',ruleName:'fixture',captureGroups:[],srcdoc:program}],character:{id:'fixture',name:'fixture',avatarUrl:null,tags:[],bio:null},userName:'test',onSendMessage:()=>{throw Error('UNEXPECTED_SEND');}};
 try{
  await act(async()=>{root.render(createElement(MufyReplyPet,props));});
  expect(document.querySelector<HTMLElement>('[data-mufy-reply-pet]')?.style.width).toBe('90px');
  expect(document.querySelector<HTMLElement>('[data-mufy-reply-pet]')?.style.top).toBe('634px');
  await act(async()=>{root.render(createElement(MufyReplyPet,{...props,segments:[...props.segments]}));});
  expect(document.querySelector<HTMLElement>('[data-mufy-reply-pet]')?.style.width).toBe('90px');
  await act(async()=>{root.render(createElement(MufyReplyPet,{...props,freeze:true,segments:[]}));});
  expect(document.querySelectorAll('[data-mufy-reply-pet]')).toHaveLength(1);
 }finally{
  await act(async()=>{root.unmount();});dom.window.close();
  for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
