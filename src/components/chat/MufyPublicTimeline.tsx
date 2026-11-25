"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import DOMPurify from 'isomorphic-dompurify';
import type {PublicTimeline} from '@/lib/opening/fullscreen-story';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';

/** Four observed public entries only. No source program, parent access or host RPC. */
export function MufyPublicTimeline({spec,widgetKey}:{spec:PublicTimeline;widgetKey:string}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),modal=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const[shadow,setShadow]=useState<ShadowRoot|null>(null),[selected,setSelected]=useState<number|null>(null);
 const html=useMemo(()=>DOMPurify.sanitize(spec.triggerMarkup,{ALLOWED_TAGS:['div','span','svg','path'],ALLOWED_ATTR:['id','class','style','viewBox','preserveAspectRatio','d','fill','stroke','stroke-width']}),[spec.triggerMarkup]);
 const markup=useMemo(()=>({__html:html}),[html]);
 const css=useMemo(()=>sanitizeAndScopeCss(spec.triggerCss,'opening').css,[spec.triggerCss]);
 const entryLabels=spec.entries.map(e=>e.label).join('\u0000');
 const modalMarkup=useMemo(()=>selected===null?'':DOMPurify.sanitize(spec.entries[selected]?.modalMarkup??'',{ALLOWED_TAGS:['div','h3','p'],ALLOWED_ATTR:['id','style']}),[selected,spec.entries]);
 const modalHtml=useMemo(()=>({__html:modalMarkup}),[modalMarkup]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  const root=shell.current?.querySelector<HTMLElement>('#Z_CONFIG-xm-timeline-v10-fix'),trigger=root?.querySelector<HTMLElement>('#Z_CONFIG_btn_xm_v10'),nodes=root?.querySelectorAll<HTMLElement>('.Tuan_node_v10');
  if(!root||!trigger||nodes?.length!==4)return;
  const bindings:[HTMLElement,string,EventListener][]=[],timers:ReturnType<typeof setTimeout>[]=[];
  const bind=(el:HTMLElement,fn:()=>void,label:string)=>{el.setAttribute('role','button');el.setAttribute('aria-label',label);el.tabIndex=0;const click=()=>fn(),key:EventListener=e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();fn();}};el.addEventListener('click',click);el.addEventListener('keydown',key);bindings.push([el,'click',click],[el,'keydown',key]);};
  bind(trigger,()=>{root.classList.add('expanded');trigger.style.opacity='0';trigger.style.pointerEvents='none';trigger.tabIndex=-1;nodes.forEach((n,i)=>timers.push(setTimeout(()=>n.classList.add('visible'),500+i*400)));},'谢闽的过往履历（可点击）');
  nodes.forEach((node,i)=>bind(node,()=>{returnFocus.current=node;setSelected(i);},spec.entries[i].label));
  return()=>{for(const[el,event,fn]of bindings)el.removeEventListener(event,fn);timers.forEach(clearTimeout);};
 },[shadow,html,entryLabels]);
 useEffect(()=>{
  if(selected===null)return;
  const close=()=>{setSelected(null);returnFocus.current?.focus();};
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();close();}
   else if(e.key==='Tab'){e.preventDefault();modal.current?.querySelector<HTMLElement>('#Z_CONFIG_close_xm_v10')?.focus();}
  };
  const button=modal.current?.querySelector<HTMLElement>('#Z_CONFIG_close_xm_v10');
  if(button){button.setAttribute('role','button');button.tabIndex=0;button.addEventListener('click',close);button.focus();}
  const activate=(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();close();}};
  button?.addEventListener('keydown',activate);document.addEventListener('keydown',key);
  return()=>{button?.removeEventListener('click',close);button?.removeEventListener('keydown',activate);document.removeEventListener('keydown',key);};
 },[selected]);
 return <><div ref={host} data-nj-public-timeline={widgetKey}>{shadow&&createPortal(<div data-character-css="opening"><style>{`:host{all:initial;display:block;width:100%}${css}[role=button]:focus-visible{outline:1px solid currentColor;outline-offset:3px}`}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>{selected!==null&&createPortal(<div id="censy_modal_overlay_xm_v10" data-nj-public-timeline-modal={widgetKey} ref={modal} role="dialog" aria-modal="true" aria-label={spec.entries[selected].label} style={{position:'fixed',inset:0,width:'100vw',height:'100dvh',zIndex:10000,background:'rgba(5,5,8,0.85)',backdropFilter:'blur(8px)',display:'flex',justifyContent:'center',alignItems:'center',fontFamily:'"Helvetica Neue", "PingFang SC", sans-serif',overflowY:'auto',paddingBlock:'20px',boxSizing:'border-box'}} dangerouslySetInnerHTML={modalHtml}/>,document.body)}</>;
}
