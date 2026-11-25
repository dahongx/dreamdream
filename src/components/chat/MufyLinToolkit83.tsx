"use client";
import {bindLin83Drag,ownLin83PositionStore} from "@/lib/opening/lin-toolkit-83-drag";
import {copyTextToClipboard} from "@/lib/util/clipboard";
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import DOMPurify from 'isomorphic-dompurify';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';
import {LIN_PUBLIC_DATA,bindLinCommandTemplate,generateLinConfiguration,insertLinCommand} from '@/lib/opening/lin-toolkit-83';
/** A finite page-controls presentation. No author code, send hook, parent or storage access. */
export function MufyLinToolkit83({inputRef,onChange,userName,characterName}:{inputRef:RefObject<HTMLTextAreaElement|null>;onChange:(value:string)=>void;userName:string;characterName:string}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),[shadow,setShadow]=useState<ShadowRoot|null>(null),[revision,bump]=useState(0),pending=useRef<{value:string;caret:number}|null>(null);
 const latest=useRef({onChange,userName,characterName});latest.current={onChange,userName,characterName};
 const markup=useMemo(()=>({__html:DOMPurify.sanitize(LIN_PUBLIC_DATA.shellHtml,{ALLOWED_TAGS:['div','span','button','label','select','option','textarea','details','summary','svg','circle','path','polyline'],ALLOWED_ATTR:['id','class','title','value','selected','placeholder','type','viewBox','width','height','stroke','stroke-width','fill','cx','cy','r','d','points','stroke-linecap','stroke-linejoin'],ALLOW_DATA_ATTR:false})}),[]);
 const css=useMemo(()=>sanitizeAndScopeCss(LIN_PUBLIC_DATA.css,'opening').css+`
 #lin-jb-root{position:fixed!important;right:20px!important;bottom:80px!important;z-index:45!important;pointer-events:auto}
 #lin-sidebar,#lin-instructions{display:none}.lin-instructions-panel{max-width:calc(100vw - 100px)}
 .lin-toast-msg{position:fixed;top:40px;left:50%;z-index:45;pointer-events:none}.lin-details summary::-webkit-details-marker{display:none}svg{display:block;flex-shrink:0}
 [role=button]:focus-visible,button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid currentColor;outline-offset:2px}
 `,[]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useLayoutEffect(()=>{const next=pending.current,input=inputRef.current;if(!next||!input||input.value!==next.value)return;pending.current=null;if(input.isConnected){input.focus();input.setSelectionRange(next.caret,next.caret);}},[revision,inputRef]);
 useEffect(()=>{
  const root=shell.current;if(!shadow||!root)return;const q=<T extends HTMLElement>(id:string)=>root.querySelector<T>('#'+id),ball=q('lin-ball'),sidebar=q('lin-sidebar'),panel=q('lin-instructions'),list=q('lin-static-cmds'),generate=q<HTMLButtonElement>('lin-config-generate'),quickButton=q<HTMLButtonElement>('lin-quick-inject'),quick=q<HTMLTextAreaElement>('lin-custom-quick');
  const buttons=root.querySelectorAll<HTMLElement>('.lin-side-btn'),selects=LIN_PUBLIC_DATA.fields.map(f=>q<HTMLSelectElement>(f.id)),custom=q<HTMLTextAreaElement>('lin-cfg-custom');
  const dragHandle=q('lin-drag-handle'),dragRoot=q('lin-jb-root');
  if(!dragHandle||!dragRoot||!ball||!sidebar||!panel||!list||!generate||!quickButton||!quick||buttons.length!==4||selects.some(s=>!s)||!custom)return;
  let alive=true;
  const bindings:[EventTarget,string,EventListener][]=[],listen=(node:EventTarget,event:string,handler:EventListener)=>{node.addEventListener(event,handler);bindings.push([node,event,handler]);};
  const status=document.createElement('div');status.className='lin-toast-msg';status.setAttribute('role','status');status.hidden=true;root.append(status);let timer:ReturnType<typeof setTimeout>|null=null,hideTimer:ReturnType<typeof setTimeout>|null=null;
  const toast=(text:string)=>{if(timer)clearTimeout(timer);if(hideTimer)clearTimeout(hideTimer);const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:'16',height:'16',stroke:'#4ade80','stroke-width':'2',fill:'none'}))icon.setAttribute(key,value);const check=document.createElementNS('http://www.w3.org/2000/svg','polyline');check.setAttribute('points','20 6 9 17 4 12');icon.append(check);status.replaceChildren(icon,document.createTextNode(text));status.style.opacity='1';status.hidden=false;timer=setTimeout(()=>{status.style.opacity='0';timer=null;hideTimer=setTimeout(()=>{status.hidden=true;hideTimer=null;},500);},1500);};
  const show=(open:boolean)=>{ball.style.display=open?'none':'flex';sidebar.style.display=open?'flex':'none';sidebar.inert=!open;ball.setAttribute('aria-expanded',String(open));if(!open){panel.style.display='none';panel.inert=true;} };
  const click=(node:HTMLElement,fn:()=>void)=>{node.setAttribute('role','button');node.tabIndex=0;listen(node,'mousedown',e=>e.preventDefault());listen(node,'click',fn);listen(node,'keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();fn();}});};
  const insert=(text:string)=>{const input=inputRef.current;if(!input){void copyTextToClipboard(text).then(ok=>{if(alive)toast(ok?'找不到输入框，已复制到剪贴板':'找不到输入框，复制失败');}).catch(()=>{if(alive)toast('找不到输入框，复制失败')});return;}const next=insertLinCommand(input.value,input.selectionStart,input.selectionEnd,text);pending.current=next;latest.current.onChange(next.value);bump(v=>v+1);toast('✓ 指令已注入');};
  const disposeDrag=bindLin83Drag(dragRoot,ball,dragHandle,ownLin83PositionStore(window));
  click(ball,()=>show(true));click(buttons[0],()=>document.getElementById('nj_chat_messages')?.scrollTo({top:0,behavior:'smooth'}));click(buttons[1],()=>{const chat=document.getElementById('nj_chat_messages');chat?.scrollTo({top:chat.scrollHeight,behavior:'smooth'});});
  click(buttons[2],()=>{const open=panel.style.display!=='block';panel.style.display=open?'block':'none';panel.inert=!open;buttons[2].setAttribute('aria-expanded',String(open));});click(buttons[3],()=>show(false));
  click(quickButton,()=>{if(quick.value.trim())insert(quick.value);});
  click(generate,()=>{const text=generateLinConfiguration(selects.map(s=>s!.value),custom.value,latest.current.userName,latest.current.characterName);if(text===null)toast('指令配置无效，草稿未改变');else insert(text);});
  list.replaceChildren();for(const group of LIN_PUBLIC_DATA.groups){const details=document.createElement('details');details.className='lin-details';const summary=document.createElement('summary');summary.textContent=group.title;const body=document.createElement('div');body.className='lin-details-content';for(const command of group.cmds){const item=document.createElement('div');item.className='lin-cmd-item';item.textContent=command;click(item,()=>insert(bindLinCommandTemplate(command,latest.current.userName,latest.current.characterName)));body.append(item);}details.append(summary,body);list.append(details);}
  show(false);return()=>{alive=false;disposeDrag();for(const [node,event,handler]of bindings)node.removeEventListener(event,handler);if(timer)clearTimeout(timer);if(hideTimer)clearTimeout(hideTimer);status.remove();pending.current=null;};
 },[shadow,inputRef]);
 useEffect(()=>{const rows=shell.current?.querySelectorAll<HTMLElement>('.lin-cmd-item'),commands=LIN_PUBLIC_DATA.groups.flatMap(g=>[...g.cmds]);if(rows?.length===commands.length)rows.forEach((row,i)=>{row.textContent=bindLinCommandTemplate(commands[i],userName,characterName);});},[shadow,userName,characterName]);
 return <div ref={host} data-nj-lin-toolkit="83-v1" style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:44}}>{shadow&&createPortal(<div data-character-css="opening"><style>{css}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>;
}
