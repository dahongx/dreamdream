"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import DOMPurify from 'isomorphic-dompurify';
import {validImageIsland,type NativeImageSidebar} from '@/lib/opening/native-image-sidebar';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';
import {copyTextToClipboard} from '@/lib/util/clipboard';

/** One known public shell: three tabs,25 original image links,one original track. */
export function MufyImageIsland({spec,onOpenChange}:{spec:NativeImageSidebar;onOpenChange:(open:boolean)=>void}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),callback=useRef(onOpenChange);callback.current=onOpenChange;
 const[shadow,setShadow]=useState<ShadowRoot|null>(null),key=JSON.stringify(spec.imageIsland),config=useMemo(()=>{try{const c:unknown=JSON.parse(key??'null');return validImageIsland(c)?c:null;}catch{return null;}},[key]);
 const html=useMemo(()=>DOMPurify.sanitize(spec.shellHtml,{ALLOWED_TAGS:['div','span','button'],ALLOWED_ATTR:['id','class'],ALLOW_DATA_ATTR:false}),[spec.shellHtml]),markup=useMemo(()=>({__html:html}),[html]),css=useMemo(()=>sanitizeAndScopeCss(spec.css,'opening').css,[spec.css]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  const root=shell.current?.querySelector<HTMLElement>('#censy-island-container'),trigger=root?.querySelector<HTMLElement>('.island-trigger-text'),close=root?.querySelector<HTMLElement>('.close-btn'),tabs=root?.querySelectorAll<HTMLElement>('.nav-btn'),panes=root?.querySelectorAll<HTMLElement>('.tab-pane'),play=root?.querySelector<HTMLElement>('#censy-play-btn'),disk=root?.querySelector<HTMLElement>('#censy-record'),toast=root?.querySelector<HTMLElement>('#island-toast');
  if(!config||!shadow||!root||!trigger||!close||tabs?.length!==3||panes?.length!==3||!play||!disk||!toast)return;
  let alive=true,opened=false,request=0,timer:ReturnType<typeof setTimeout>|null=null;const audio=document.createElement('audio');audio.preload='none';audio.loop=true;audio.id='censy-audio-core';root.append(audio);
  const bindings:[EventTarget,string,EventListener][]=[];const listen=(el:EventTarget,type:string,fn:EventListener)=>{el.addEventListener(type,fn);bindings.push([el,type,fn]);};
  const bind=(el:HTMLElement,fn:(e:Event)=>void,label:string)=>{el.setAttribute('role','button');el.setAttribute('aria-label',label);el.tabIndex=0;listen(el,'click',fn);listen(el,'keydown',e=>{if(el.tagName!=='BUTTON'&&['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();fn(e);}});};
  const show=(message:string)=>{toast.textContent=message;toast.classList.add('show');toast.setAttribute('role','status');if(timer)clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),2000);};
  const setOpen=(value:boolean)=>{opened=value;root.classList.toggle('expanded',value);root.classList.toggle('collapsed',!value);trigger.tabIndex=value?-1:0;trigger.setAttribute('aria-expanded',String(value));const content=root.querySelector<HTMLElement>('.island-content-area');if(content){content.inert=!value;content.setAttribute('aria-hidden',String(!value));}callback.current(value);};
  bind(trigger,()=>setOpen(true),'·爱是宜居的小岛·');bind(close,()=>{setOpen(false);trigger.focus();},'收起上推');
  const select=(index:number)=>{tabs.forEach((t,i)=>{t.classList.toggle('active',i===index);t.setAttribute('aria-selected',String(i===index));});panes.forEach((p,i)=>{p.classList.toggle('active',i===index);p.style.display=i===index?'block':'none';p.inert=i!==index;p.setAttribute('aria-hidden',String(i!==index));});};
  tabs.forEach((t,i)=>bind(t,()=>select(i),t.textContent??''));select(0);
  for(const[id,urls,label]of[['avatar-grid-box',config.avatars,'头像'],['emoji-grid-box',config.emojis,'表情']] as const){const grid=root.querySelector('#'+id);if(!grid)continue;grid.replaceChildren();urls.forEach((url,i)=>{const row=document.createElement('div'),img=document.createElement('img');row.className='grid-item';img.src=url;img.alt=label+String(i+1);row.append(img);grid.append(row);bind(row,async event=>{if(!event.isTrusted)return;let ok=false;try{ok=await copyTextToClipboard(url);}catch{}if(alive)show(ok?'链接已复制':'复制失败，请重试');},`复制${label}${i+1}`);});}
  const render=()=>{play.textContent=audio.paused?'播放':'暂停';disk.classList.toggle('playing',!audio.paused);};
  bind(play,async event=>{if(!event.isTrusted)return;if(!audio.paused){request++;audio.pause();return;}const id=++request;play.textContent='加载中';if(!audio.src)audio.src=config.audioSrc;try{await audio.play();if(!alive||id!==request){audio.pause();return;}render();}catch{if(alive&&id===request){render();show('音乐暂时无法播放');}}},'播放或暂停');
  listen(audio,'playing',render);listen(audio,'pause',render);listen(audio,'ended',()=>{render();});listen(audio,'error',()=>{request++;render();show('音乐暂时无法播放');});
  const escape:EventListener=e=>{if((e as KeyboardEvent).key==='Escape'&&opened){setOpen(false);trigger.focus();}};listen(document,'keydown',escape);setOpen(false);
  return()=>{alive=false;request++;if(timer)clearTimeout(timer);bindings.forEach(([el,type,fn])=>el.removeEventListener(type,fn));audio.pause();audio.removeAttribute('src');audio.load();audio.remove();};
 },[shadow,html,config]);
 return <div ref={host} className="nj_image_island" style={{position:'fixed',inset:0,zIndex:45,pointerEvents:'none'}}>{shadow&&createPortal(<div data-character-css="opening"><style>{`:host{all:initial}${css}#censy-island-container{position:fixed!important;pointer-events:auto!important;box-sizing:border-box;max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);font-family:"PingFang SC",-apple-system,sans-serif;line-height:24px;color:rgb(249,250,251)}#censy-island-container *{box-sizing:border-box}[role=button]:focus-visible{outline:1px solid currentColor;outline-offset:-2px}`}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>;
}
