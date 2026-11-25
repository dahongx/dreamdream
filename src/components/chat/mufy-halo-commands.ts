import {readHaloCommands,validHaloCommands,haloInjectedCommands,type HaloToolkitData,type HaloCommandState,type HaloCommandMode} from '@/lib/opening/halo-toolkit';

/** Own scoped preferences only; no original storage, HTML evaluation or send-button hook. */
export function bindHaloCommands(root:HTMLElement,data:HaloToolkitData,scope:string,fill:(text:string)=>void,onChange:(state:HaloCommandState|null)=>void){
 const q=(id:string)=>root.querySelector<HTMLElement>('#'+id),list=q('censy-drown-cmd-list'),form=q('censy-drown-cmd-form-inner'),formBox=q('censy-drown-cmd-addform'),menu=q('censy-drown-cmd-addmenu');
 const storageKey='nj_halo_commands_'+encodeURIComponent(scope)+'_'+data.id;
 let raw:string|null=null;try{raw=window.localStorage.getItem(storageKey);}catch{/* Storage unavailable, in-memory controls still work. */}
 let state=readHaloCommands(raw,data),undo:HaloCommandState|null=null,next=0;
 const cleanups:(()=>void)[]=[],dynamic:(()=>void)[]=[];
 const listen=(e:HTMLElement,event:string,fn:EventListener,bag=dynamic)=>{e.addEventListener(event,fn);bag.push(()=>e.removeEventListener(event,fn));};
 const button=(label:string,cls:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;listen(b,'click',fn);return b;};
 const message=document.createElement('div');message.setAttribute('role','status');message.className='nj_halo_command_status';formBox?.after(message);
 const save=()=>{onChange(structuredClone(state));try{window.localStorage.setItem(storageKey,JSON.stringify(state));message.textContent='';}catch{message.textContent='无法保存到浏览器，本次修改仅在当前页面有效。';}};
 const mutate=(change:()=>void)=>{const before=structuredClone(state);change();if(!validHaloCommands(state)){state=before;render();message.textContent='最多20个合集、100条指令，总内容不超过20万字。';return false;}undo=before;save();render();return true;};
 const closeForm=()=>{if(formBox)formBox.style.display='none';if(menu)menu.style.display='none';};
 const render=()=>{
  dynamic.splice(0).forEach(fn=>fn());if(!list)return;list.replaceChildren();
  for(const group of state.groups){const box=document.createElement('div');box.className='censy-drown-cmd-group';const head=document.createElement('div');head.className='censy-drown-cmd-group-head';const title=button(group.name,'nj-halo-command-group',()=>mutate(()=>{group.collapsed=!group.collapsed;}));title.setAttribute('aria-expanded',String(!group.collapsed));head.append(title);
   head.append(button('删除合集','censy-drown-cmd-group-del',()=>mutate(()=>{state.groups=state.groups.filter(g=>g!==group);let ungrouped=state.groups.find(g=>g.id==='own-ungrouped');if(!ungrouped){ungrouped={id:'own-ungrouped',name:'未分组',collapsed:false,items:[]};state.groups.push(ungrouped);}ungrouped.items.push(...group.items);})));box.append(head);
   const body=document.createElement('div');body.hidden=group.collapsed;body.className='censy-drown-cmd-group-body';
   for(const cmd of group.items){const row=document.createElement('div');row.className='censy-drown-cmd-row';const copy=button(cmd.label,'censy-drown-cmd-label nj-halo-command-item',()=>fill(cmd.content));copy.title=cmd.content;
    const labels:Record<HaloCommandMode,string>={prefix:'前缀',suffix:'后缀',inject:'注入',silence:'静默'},modes:HaloCommandMode[]=['prefix','suffix','inject','silence'];const mode=button(labels[cmd.mode],'censy-drown-cmd-mode',()=>mutate(()=>{cmd.mode=modes[(modes.indexOf(cmd.mode)+1)%4];}));mode.setAttribute('aria-label',cmd.label+'：'+labels[cmd.mode]);mode.dataset.mode=cmd.mode;
    const del=button('✕','censy-drown-cmd-row-del',()=>mutate(()=>{group.items=group.items.filter(c=>c!==cmd);}));del.setAttribute('aria-label','删除指令 '+cmd.label);row.append(copy,mode,del);body.append(row);
   }box.append(body);list.append(box);
  }
  if(undo)list.append(button('撤销上次修改','nj_halo_command_undo',()=>{const previous=undo!;undo=structuredClone(state);state=previous;save();render();}));
 };
 const showForm=(type:'group'|'cmd')=>{
  if(!form||!formBox)return;if(menu)menu.style.display='none';form.replaceChildren();formBox.style.display='block';
  const field=(label:string,id:string,multiline=false)=>{const l=document.createElement('label');l.textContent=label;const input=multiline?document.createElement('textarea'):document.createElement('input');input.id=id;input.className='censy-drown-cmd-form-input';input.setAttribute('aria-label',label);input.maxLength=multiline?40000:200;l.append(input);form.append(l);return input;};
  const title=field(type==='group'?'合集名称':'指令名称','nj_halo_cmd_title'),content=type==='cmd'?field('指令内容','nj_halo_cmd_content',true):null;
  const select=document.createElement('select');select.setAttribute('aria-label','所属合集');select.className='censy-drown-cmd-form-select';for(const g of state.groups){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;select.append(o);}if(type==='cmd')form.append(select);
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.onclick=closeForm;const submit=document.createElement('button');submit.type='button';submit.textContent='确定';submit.onclick=()=>{if(!title.value.trim()||(content&&!content.value.trim())){message.textContent='请填写名称和内容。';return;}const accepted=mutate(()=>{const id='own-'+Date.now()+'-'+next++;if(type==='group')state.groups.push({id,name:title.value.trim(),collapsed:false,items:[]});else{let g=state.groups.find(g=>g.id===select.value);if(!g){g={id:'own-ungrouped',name:'未分组',collapsed:false,items:[]};state.groups.push(g);}g.items.push({id,label:title.value.trim(),content:content!.value.trim(),mode:'silence'});}});if(accepted)closeForm();};form.append(cancel,submit);title.focus();
 };
 if(menu){menu.replaceChildren();const cmd=document.createElement('button'),group=document.createElement('button');cmd.type=group.type='button';cmd.textContent='添加指令';group.textContent='添加合集';cmd.onclick=()=>showForm('cmd');group.onclick=()=>showForm('group');menu.append(cmd,group);menu.style.display='none';}
 if(formBox)formBox.style.display='none';render();onChange(structuredClone(state));
 return {actions:{'censyDrownCmdAddMenu()':()=>{closeForm();if(menu)menu.style.display='block';},'censyDrownCmdInjectAll()':()=>{const text=haloInjectedCommands(state);if(text)fill(text);}},closeForm,dispose:()=>{cleanups.splice(0).forEach(fn=>fn());dynamic.splice(0).forEach(fn=>fn());message.remove();onChange(null);}};
}
