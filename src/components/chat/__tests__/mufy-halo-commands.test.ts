import {test,expect} from 'bun:test';
import {JSDOM} from 'jsdom';
import {bindHaloCommands} from '../mufy-halo-commands';
import {defaultHaloCommands,readHaloCommands,validHaloCommands,applyHaloCommands,applyScopedHaloCommands,haloInjectedCommands,type HaloCommandState} from '@/lib/opening/halo-toolkit';
import fixture from '../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/49/native-toolkit/toolkit-data.json';

test('halo command state validates bounds and applies only explicit send prefixes/suffixes',()=>{
 const state=defaultHaloCommands(fixture),items=state.groups[0].items;
 expect(validHaloCommands(state)).toBe(true);expect(readHaloCommands('{bad',fixture)).toEqual(state);
 items[0].mode='prefix';items[1].mode='suffix';items[2].mode='inject';
 expect(applyHaloCommands('正文',state)).toBe(items[0].content+'\n正文\n'+items[1].content);
 expect(haloInjectedCommands(state)).toBe(items[2].content);expect(applyHaloCommands('',state)).toBe('');
 expect(applyScopedHaloCommands('正文',{scope:'a',value:state},'b')).toBe('正文');
 items[1].id=items[0].id;expect(validHaloCommands(state)).toBe(false);expect(applyHaloCommands('正文',state)).toBe('正文');
 expect(readHaloCommands(JSON.stringify(state),fixture)).toEqual(defaultHaloCommands(fixture));
});
test('halo native command CRUD, modes, group move and undo preserve text without HTML evaluation',()=>{
 const dom=new JSDOM('<div id="root"><div id="censy-drown-cmd-list"></div><div id="censy-drown-cmd-addmenu"></div><div id="censy-drown-cmd-addform"><div id="censy-drown-cmd-form-inner"></div></div></div>');
 const before={window:Object.getOwnPropertyDescriptor(globalThis,'window'),document:Object.getOwnPropertyDescriptor(globalThis,'document')};
 Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 let selected:HaloCommandState|null=null,draft='';const root=document.getElementById('root')!,bound=bindHaloCommands(root,fixture,'isolated-test',text=>{draft=text;},s=>{selected=s;});
 const click=(label:string)=>{const b=Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(b=>(b.getAttribute('aria-label')||b.textContent)===label);expect(Boolean(b)).toBe(true);b!.click();};
 try{
  const first=fixture.groups[0].items[0];click(first.label+'：静默');expect(applyHaloCommands('test',selected)).toBe(first.content+'\ntest');click(first.label+'：前缀');expect(applyHaloCommands('test',selected)).toBe('test\n'+first.content);click(first.label+'：后缀');bound.actions['censyDrownCmdInjectAll()']();expect(draft).toBe(first.content);
  bound.actions['censyDrownCmdAddMenu()']();click('添加指令');const title=root.querySelector<HTMLInputElement>('#nj_halo_cmd_title')!,content=root.querySelector<HTMLTextAreaElement>('#nj_halo_cmd_content')!;title.value='<img onerror=evil()> 中文';content.value='line1\nline2 <script>not executed</script>';click('确定');expect(root.querySelector('img,script')).toBeNull();click(title.value);expect(draft).toBe(content.value);
  const total=selected!.groups.flatMap(g=>g.items).length;click('删除指令 '+title.value);expect(selected!.groups.flatMap(g=>g.items).length).toBe(total-1);click('撤销上次修改');expect(selected!.groups.flatMap(g=>g.items).length).toBe(total);
  const groupCount=selected!.groups.length;bound.actions['censyDrownCmdAddMenu()']();click('添加合集');root.querySelector<HTMLInputElement>('#nj_halo_cmd_title')!.value='新合集';click('确定');expect(selected!.groups.length).toBe(groupCount+1);
  expect(root.textContent).toContain('无法保存到浏览器');
 }finally{bound.dispose();dom.window.close();for(const[k,d]of Object.entries(before))if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
