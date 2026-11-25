"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import DOMPurify from 'isomorphic-dompurify';
import type {PublicMap} from '@/lib/opening/public-map';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';

/** Preserve the public SVG; replace only its failed cross-parent notification. */
export function MufyPublicMap({spec,widgetKey}:{spec:PublicMap;widgetKey:string}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null);
 const [shadow,setShadow]=useState<ShadowRoot|null>(null),[message,setMessage]=useState<{text:string;visible:boolean}|null>(null),[anchor,setAnchor]=useState({top:0,left:0});
 const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const messageKey=JSON.stringify(spec.messages);
 const queues=useMemo(()=>JSON.parse(messageKey) as string[][],[messageKey]);
 const markup=useMemo(()=>({__html:DOMPurify.sanitize(spec.document,{ALLOWED_TAGS:['div','svg','g','path','circle','line','rect','ellipse','text','tspan','defs','linearGradient','stop','filter','feGaussianBlur'],ALLOWED_ATTR:['class','id','style','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','fill','stroke','stroke-width','stroke-linecap','stroke-dasharray','transform','text-anchor','font-size','offset','stop-color','stop-opacity','filter','stdDeviation']})}),[spec.document]);
 const css=useMemo(()=>sanitizeAndScopeCss(spec.css,'opening').css,[spec.css]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[];};
  const nodes=shell.current?.querySelectorAll<SVGGElement>('.map-node');if(nodes?.length!==4)return;
  const bindings:{node:SVGGElement;click:()=>void;key:(e:KeyboardEvent)=>void}[]=[];
  nodes.forEach((node,index)=>{
   node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',node.textContent?.trim()??String(index+1));
   const click=()=>{clear();setMessage(null);queues[index].forEach((text,i)=>{
    timers.current.push(setTimeout(()=>{setMessage({text,visible:false});timers.current.push(setTimeout(()=>setMessage({text,visible:true}),50));if(i===3)timers.current.push(setTimeout(()=>setMessage({text,visible:false}),3000));},i*2000));
   });};
   const key=(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();click();}};
   node.addEventListener('click',click);node.addEventListener('keydown',key);bindings.push({node,click,key});
  });
  return()=>{clear();for(const b of bindings){b.node.removeEventListener('click',b.click);b.node.removeEventListener('keydown',b.key);}};
 },[shadow,markup,queues]);
 useEffect(()=>{
  const header=document.getElementById('nj_chat_header');if(!header)return;
  const update=()=>{const r=header.getBoundingClientRect();setAnchor({top:r.bottom+10,left:r.left+r.width/2});};update();
  const observer=new ResizeObserver(update);observer.observe(header);window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
 },[]);
 // These values are measured public author paint, intentionally not Dearm's
 // theme tokens. Shadow isolation prevents the platform tint from recoloring it.
 return <><div ref={host} data-nj-public-map={widgetKey}>{shadow&&createPortal(<div data-character-css="opening"><style>{`:host{all:initial;display:block;width:100%}${css}.map-node:focus-visible{outline:1px solid currentColor;outline-offset:3px}`}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>{message&&createPortal(<div data-nj-map-notification={widgetKey} role="status" style={{position:'fixed',top:anchor.top,left:anchor.left,transform:'translateX(-50%)',pointerEvents:'none',zIndex:10000,maxWidth:'calc(100vw - 24px)',width:'max-content'}}><div style={{all:'initial',boxSizing:'border-box',display:'flex',alignItems:'center',gap:12,minWidth:'min(220px,calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)',background:'rgba(255,255,255,0.05)',backdropFilter:'blur(2px)',border:'1px solid rgba(255,255,255,0.2)',boxShadow:'0 4px 15px rgba(255,255,255,0.05)',padding:'10px 22px 10px 12px',borderRadius:30,opacity:message.visible?1:0,transform:message.visible?'translateY(0)':'translateY(-10px)',transition:'opacity .3s,transform .3s'}}><img src={spec.avatar} alt="" style={{all:'initial',width:34,height:34,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:'0.5px solid rgba(255,255,255,0.3)'}}/><div style={{all:'initial',display:'flex',flexDirection:'column',alignItems:'flex-start',lineHeight:1.4}}><span style={{all:'initial',fontFamily:'Inter,sans-serif',fontSize:11,color:'rgba(255,255,255,0.7)',letterSpacing:.5}}>{spec.name}</span><span style={{all:'initial',fontFamily:'"Noto Serif SC",sans-serif',fontSize:14,color:'#ffffff',fontWeight:600,overflowWrap:'anywhere'}}>{message.text}</span></div></div></div>,document.body)}</>;
}
