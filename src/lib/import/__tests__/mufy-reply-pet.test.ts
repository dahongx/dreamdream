import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {mufySidebarOwnerIndex} from '../../chat/mufy-sidebar-owner';
import {buildMufyReplyPetFrame,extractMufyReplyPet,validateMufyPetBounds} from '../mufy-reply-pet';

const program='<div id="censy-gu-pet-wrapper"><div id="CenGu_Zone"><img class="CenGu_Img" alt="pet"></div></div><div id="CenGu_QianOverlay"></div><script>const pWin=window.parent;pWin.CenGu_openIdeas=function(){};</script>';
describe('source reply pet viewport boundary',()=>{
 test('self-styled pet does not require fire/memory CSS and the previous owner survives a new stream',()=>{
  const message=readFileSync('src/components/chat/MessageBubble.tsx','utf8');
  expect(message).toContain('mufySourceDefaults&&<MufyReplySidebar');
  expect(message).not.toContain('mufySourceDefaults&&sourceComponentStyle&&<MufyReplySidebar');
  const pet=readFileSync('src/components/chat/MufyReplyPet.tsx','utf8');
  expect(pet).toContain('setBounds(null);setProgram(next);');
  expect(pet).not.toContain('useEffect(()=>{setBounds(null);},[program])');
  const messages=[{role:'assistant',id:'opening'},{role:'user',id:'user1'},{role:'assistant',id:'completed'},{role:'user',id:'user2'},{role:'assistant',id:'streaming'}];
  expect(mufySidebarOwnerIndex(messages,'streaming',null)).toBe(2);
  expect(mufySidebarOwnerIndex(messages,'ready',null)).toBe(4);
 });
 test('extracts only the known complete source template without running scripts',()=>{
  const dom=new JSDOM(`<template id="censy-gu-pet-host">${program}</template>`);
  expect(extractMufyReplyPet(dom.window.document)).toBe(program);
  expect(dom.window.document.querySelector('#CenGu_Zone')).toBeNull();
  expect(extractMufyReplyPet(new JSDOM(program).window.document)).toBeNull();
  expect(extractMufyReplyPet(new JSDOM('<template id="censy-gu-pet-host"><script>other()</script></template>').window.document)).toBeNull();
  dom.window.close();
 });
 test('keeps the source program isolated and draft-only, with bounded interaction geometry',()=>{
  const frame=buildMufyReplyPetFrame(program);
  expect(frame).toContain('const pWin=window.parent');
  expect(frame).toContain('data-mufy-draft-relay');
  expect(frame).toContain("var text=draft.value;draft.value='';");
  expect(frame).toContain('window.host.fillComposer(text)');
  expect(frame).not.toContain('window.host.fillComposer(draft.value)');
  expect(frame).toContain('mufy-reply-pet-bounds');
  // A fully clipped initial iframe can suspend rAF. The first bounds message
  // must be synchronous at document readiness, not wait for visible paint.
  expect(frame).toContain('attributes:true});measure();}');
  expect(frame).toContain("window.addEventListener('host-ready',function(){stabilizeAnchor();last='';measure();});");
  expect(frame).toContain('height:100%!important');
  expect(frame).not.toContain('<style data-mufy-source-adaptation>');
  expect(frame).toContain('<script data-mufy-source-adaptation>');
  expect(frame.indexOf('data-mufy-pet-preflight')).toBeLessThan(frame.indexOf('censy-gu-pet-wrapper'));
  expect(frame).not.toContain('sendMessage(');
  expect(frame).not.toContain('allow-same-origin');
  const dom=new JSDOM(frame);
  for(const script of dom.window.document.querySelectorAll('script'))expect(()=>new Function(script.textContent??'')).not.toThrow();
  dom.window.close();
 });
 test('rejects malformed geometry and clips only finite in-viewport rectangles',()=>{
  const message={type:'mufy-reply-pet-bounds',x:280,y:634,width:90,height:90,viewportWidth:390,viewportHeight:844};
  expect(validateMufyPetBounds(message)).toEqual({x:280,y:634,width:90,height:90,viewportWidth:390,viewportHeight:844});
  for(const value of [null,{}, {...message,type:'resize'},{...message,x:NaN},{...message,width:Infinity},{...message,x:-1},{...message,width:400},{...message,viewportHeight:0}])expect(validateMufyPetBounds(value)).toBeNull();
 });
 test('initial geometry is reported even when a clipped frame never receives an animation frame',async()=>{
  const messages:unknown[]=[];
  // Bun does not support jsdom's VM global proxy. Run only our bounds reporter
  // with explicit synthetic DOM dependencies, never captured author programs.
  const dom=new JSDOM(buildMufyReplyPetFrame(program));
  dom.window.HTMLElement.prototype.getBoundingClientRect=function(){
   return this.id==='CenGu_Zone'?{x:280,y:634,left:280,top:634,right:370,bottom:724,width:90,height:90,toJSON(){return{};}}:{x:0,y:0,left:0,top:0,right:0,bottom:0,width:0,height:0,toJSON(){return{};}};
  };
  const reporter=dom.window.document.querySelector('script[data-mufy-pet-bounds]')!.textContent!;
  const run=new Function('document','window','parent','getComputedStyle','innerWidth','innerHeight','MutationObserver','requestAnimationFrame',reporter);
  run(dom.window.document,dom.window,{postMessage(value:unknown){messages.push(value);}},dom.window.getComputedStyle.bind(dom.window),390,844,dom.window.MutationObserver,()=>0);
  await new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));
  expect(messages.map(validateMufyPetBounds).filter(Boolean)).toEqual([{x:280,y:634,width:90,height:90,viewportWidth:390,viewportHeight:844}]);
  const zone=dom.window.document.getElementById('CenGu_Zone')!;
  zone.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));
  expect(validateMufyPetBounds(messages.at(-1))).toEqual({x:0,y:0,width:390,height:844,viewportWidth:390,viewportHeight:844});
  zone.dispatchEvent(new dom.window.Event('pointerup',{bubbles:true}));
  expect(validateMufyPetBounds(messages.at(-1))).toEqual({x:280,y:634,width:90,height:90,viewportWidth:390,viewportHeight:844});
  zone.getBoundingClientRect=()=>({x:500,y:1000,left:500,top:1000,right:590,bottom:1090,width:90,height:90,toJSON(){return{};}});
  dom.window.dispatchEvent(new dom.window.Event('host-ready'));
  expect(validateMufyPetBounds(messages.at(-1))).toEqual({x:390,y:844,width:0,height:0,viewportWidth:390,viewportHeight:844});
  dom.window.close();
 });
 test('speech bubble growth cannot change the pet drag anchor dimensions',async()=>{
  const fixture='<style>#censy-gu-pet-wrapper{display:flex;gap:12px}#CenGu_Zone{width:90px;height:90px}#CenGu_Bubble{max-width:150px}</style><div id="censy-gu-pet-wrapper"><div id="CenGu_Zone"></div><div id="CenGu_Bubble"></div></div>';
  const dom=new JSDOM(buildMufyReplyPetFrame(fixture));
  const positiveLoaded=new Promise<void>(resolve=>dom.window.addEventListener('load',()=>resolve(),{once:true}));
  const reporter=dom.window.document.querySelector('script[data-mufy-pet-bounds]')!.textContent!;
  const run=new Function('document','window','parent','getComputedStyle','innerWidth','innerHeight','MutationObserver','requestAnimationFrame',reporter);
  const zeroDom=new JSDOM(buildMufyReplyPetFrame(fixture));
  run(zeroDom.window.document,zeroDom.window,{postMessage(){}},zeroDom.window.getComputedStyle.bind(zeroDom.window),0,0,zeroDom.window.MutationObserver,()=>0);
  await new Promise<void>(resolve=>zeroDom.window.addEventListener('load',()=>resolve(),{once:true}));
  expect(zeroDom.window.document.getElementById('censy-gu-pet-wrapper')!.style.width).toBe('');
  zeroDom.window.close();
  run(dom.window.document,dom.window,{postMessage(){}},dom.window.getComputedStyle.bind(dom.window),390,844,dom.window.MutationObserver,()=>0);
  await positiveLoaded;
  dom.window.dispatchEvent(new dom.window.Event('host-ready'));
  const wrap=dom.window.document.getElementById('censy-gu-pet-wrapper')!;
  expect(wrap.style.width).toBe('252px');
  expect(wrap.style.height).toBe('90px');
  dom.window.document.getElementById('CenGu_Bubble')!.textContent='synthetic speech '.repeat(30);
  expect(wrap.style.width).toBe('252px');
  dom.window.close();
 });
});
