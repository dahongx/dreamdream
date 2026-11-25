import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import postcss from 'postcss';
import {act} from 'react';
import {MufyHaloToolkit} from '../MufyHaloToolkit';
import {validHaloToolkit,haloDraftAppend} from '@/lib/opening/halo-toolkit';
import fixture from '../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/49/native-toolkit/toolkit-data.json';

test('halo public shell cannot execute author code; 17 emoji and 22 commands are draft-only',async()=>{
 const dom=new JSDOM('<div id="root"></div><div id="nj_chat_messages"></div>'),globals={window:dom.window,document:dom.window.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true};
 const prior=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 dom.window.HTMLMediaElement.prototype.pause=function(){};dom.window.HTMLMediaElement.prototype.play=async function(){};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!);
 let draft='',open=false;const data={...fixture,shellHtml:fixture.shellHtml+'<script>window.evil=1</script><iframe></iframe><div onclick="evil()">unsafe</div>'};
 const render=()=>act(async()=>root.render(<MufyHaloToolkit data={structuredClone(data)} onFillComposer={s=>{draft=haloDraftAppend(draft,s);}} onOpenChange={v=>{open=v;}}/>));
 try{
  expect(validHaloToolkit(data)).toBe(true);expect(validHaloToolkit({...data,tracks:[{name:'bad',src:'javascript:evil()'}]})).toBe(false);
  expect(validHaloToolkit({...data,emojis:[{short:'bad',url:'http://unsafe.invalid'}]})).toBe(false);
  await render();const shadow=document.querySelector('[data-nj-halo-toolkit]')!.shadowRoot!,q=(s:string)=>shadow.querySelector<HTMLElement>(s)!;
  expect(Boolean(shadow.querySelector('script,iframe,[onclick],[onchange]'))).toBe(false);
  expect(q('.nj_halo49_source_root')).toBeTruthy();
  const sourceStyle:Record<string,string>={};
  postcss.parse(shadow.querySelector('style')!.textContent!).walkRules(rule=>{if(rule.selector.endsWith('.nj_halo49_source_root'))rule.walkDecls(decl=>{sourceStyle[decl.prop]=decl.value;});});
  expect(sourceStyle.color.replace(/\s/g,'')).toBe('rgb(249,250,251)');
  // Unitless inheritance is required: the 13px title must remain 19.5px high,
  // not inherit a fixed 24px line box from the 16px source page root.
  expect(sourceStyle['line-height']).toBe('1.5');
  expect(q('#censy-tk-panel').inert).toBe(true);expect(q('#censy-music-dropdown').style.display).toBe('none');
  await act(async()=>q('#censy-tk-ball').click());expect(open).toBe(true);expect(q('#censy-tk-panel').style.display).toBe('flex');
  await render();expect(q('#censy-tk-panel').style.display).toBe('flex');expect(document.querySelector('[data-nj-halo-toolkit]')!.shadowRoot).toBe(shadow);
  const emojis=Array.from(shadow.querySelectorAll<HTMLElement>('.censy-emo-item'));expect(emojis.length).toBe(17);
  for(let i=0;i<emojis.length;i++){draft='';await act(async()=>emojis[i].click());expect(draft).toBe(`![${fixture.emojis[i].short}](${fixture.emojis[i].url})`);}
  const commands=Array.from(shadow.querySelectorAll<HTMLElement>('.nj-halo-command-item')),expected=fixture.groups.flatMap(g=>g.items);expect(commands.length).toBe(22);
  for(let i=0;i<commands.length;i++){draft='';await act(async()=>commands[i].click());expect(draft).toBe(expected[i].content);}
  await act(async()=>q('.nj-halo-command-group').click());expect(q('.nj-halo-command-group').getAttribute('aria-expanded')).toBe('false');await act(async()=>q('.nj-halo-command-group').click());expect(q('.nj-halo-command-group').getAttribute('aria-expanded')).toBe('true');
  const openEmoji=q('[data-halo-action="censyEmoOpen()"]');await act(async()=>openEmoji.click());expect(q('#censy-drown-emo-overlay').inert).toBe(false);await act(async()=>q('#censy-drown-emo-close').click());expect(q('#censy-drown-emo-overlay').inert).toBe(true);
  await act(async()=>q('#censy-tk-ball').click());await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'})));expect(open).toBe(false);expect(q('#censy-tk-panel').inert).toBe(true);
  expect(shadow.querySelectorAll('.censy-music-list-item').length).toBe(24);expect(q('[data-halo-action="censyDrownImmersive()"]').getAttribute('aria-disabled')).toBeNull();
  await act(async()=>q('#censy-music-loop-btn').click());expect(q('#censy-music-loop-btn').getAttribute('aria-label')).toBe('单曲循环');
  await act(async()=>q('#censy-music-loop-btn').click());expect(q('#censy-music-loop-btn').getAttribute('aria-label')).toBe('列表循环');
  const program=Array.from(shadow.querySelectorAll<HTMLButtonElement>('.censy-drown-boss-opt')).find(b=>b.textContent==='程序')!;
  await act(async()=>program.click());expect(q('[data-halo-action="censyBossGo()"]').getAttribute('aria-label')).toContain('程序');expect(program.getAttribute('aria-pressed')).toBe('true');expect(shadow.querySelectorAll('.censy-drown-boss-opt[aria-pressed="true"]').length).toBe(1);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
