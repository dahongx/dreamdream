"use client";

import DOMPurify from 'isomorphic-dompurify';
import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {NativeImageSidebar} from '@/lib/opening/native-image-sidebar';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';

// Measured source geometry and native-list defaults. No Dearm palette, author
// execution, iframe, host context, send callback or full-page hit mask.
const coordinates=`:host{all:initial;display:block;width:100%;height:100%}
[data-character-css="opening"] .ghost-sidebar-container{position:absolute!important;top:50%!important;left:-135px!important;transform:translateY(-50%)!important;pointer-events:none;box-sizing:border-box;font-size:14px;line-height:20px;color:rgb(242,243,245)}
[data-character-css="opening"] .ghost-sidebar-container *{box-sizing:border-box}
[data-character-css="opening"] .menu-panel{opacity:0!important;pointer-events:none}
[data-character-css="opening"] .toggle-button{pointer-events:auto}
[data-character-css="opening"] .toggle-button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
[data-character-css="opening"] .menu-panel ul{margin:10px 0;padding-left:28px;list-style-type:none}
[data-character-css="opening"][data-nj-ghost-open="true"] .ghost-sidebar-container{left:0!important}
[data-character-css="opening"][data-nj-ghost-open="true"] .menu-panel{opacity:1!important;pointer-events:auto}
[data-character-css="opening"][data-nj-ghost-open="true"] .arrow{transform:rotate(180deg)}`;

export function MufyGhostInstructions({spec,widgetKey,onOpenChange}:{spec:NativeImageSidebar;widgetKey:string;onOpenChange:(open:boolean)=>void}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null);
 const[shadow,setShadow]=useState<ShadowRoot|null>(null),[open,setOpen]=useState(false);
 const onOpen=useRef(onOpenChange);onOpen.current=onOpenChange;
 const html=useMemo(()=>DOMPurify.sanitize(spec.shellHtml,{ALLOWED_TAGS:['div','span','ul','li'],ALLOWED_ATTR:['class','tabindex','data-nj-native-documents'],ALLOW_DATA_ATTR:false}),[spec.shellHtml]);
 const markup=useMemo(()=>({__html:html}),[html]);
 const css=useMemo(()=>sanitizeAndScopeCss(spec.css,'opening').css,[spec.css]);
 useEffect(()=>{const node=host.current;if(node)setShadow(node.shadowRoot??node.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  if(!shadow)return;const node=host.current,root=shell.current?.querySelector<HTMLElement>('.ghost-sidebar-container'),trigger=root?.querySelector<HTMLElement>('.toggle-button');
  if(!node||!root||!trigger)return;
  root.removeAttribute('tabindex');trigger.setAttribute('tabindex','0');trigger.setAttribute('role','button');trigger.setAttribute('aria-label','查看指令');
  const show=()=>{setOpen(true);onOpen.current(true);};
  const hide=()=>{setOpen(false);onOpen.current(false);};
  const outside=(event:Event)=>{if(event.target&&!node.contains(event.target as Node))hide();};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();hide();trigger.blur();}else if(event.key==='Enter'||event.key===' '){event.preventDefault();show();}};
  trigger.addEventListener('focus',show);trigger.addEventListener('click',show);trigger.addEventListener('keydown',key);
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);
  return()=>{trigger.removeEventListener('focus',show);trigger.removeEventListener('click',show);trigger.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);onOpen.current(false);};
 },[shadow,html]);
 useEffect(()=>{shell.current?.querySelector('.toggle-button')?.setAttribute('aria-expanded',String(open));shell.current?.querySelector('.menu-panel')?.setAttribute('aria-hidden',String(!open));},[shadow,open]);
 return <div ref={host} className="nj_floating_widget nj_floating_sidebar" data-nj-ghost-instructions={widgetKey} style={{position:'fixed',left:0,top:'50%',transform:'translateY(-50%)',width:open?153:18,height:open?198:36,zIndex:45,pointerEvents:'none'}}>{shadow&&createPortal(<div data-character-css="opening" data-nj-ghost-open={String(open)}><style>{css+coordinates}</style>{/* Source shell is inert: scripts, handlers and network-capable tags excluded. */}<div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>;
}
