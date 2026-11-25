"use client";
import type {HostSendHandler} from "@/lib/opening/host-composer-send-candidate";

import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {RegexIframe,type HostCharacterMeta} from '@/components/regex/RegexIframe';
import type {Segment} from '@/lib/regex/segments';
import {sanitizeHtml} from '@/lib/sanitize';
import {MufyReplyPet} from './MufyReplyPet';

const EMPTY_CAPTURE_GROUPS:string[]=[];

const SIDEBAR_LAYOUT=`<style data-mufy-viewport-terminal>
html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;background:transparent!important;overflow:hidden!important}
.mf-fire-widget{position:static!important;top:auto!important;right:auto!important;display:block!important}
.mf-fire-widget>summary{display:flex;justify-content:flex-end}
.mf-fire-panel{top:0!important;right:0!important;max-height:100vh!important;max-width:calc(100vw - 28px)!important;box-sizing:border-box}
.mf-fire-close-btn{top:10px!important;right:min(290px,calc(100vw - 22px))!important}
</style><script data-mufy-viewport-terminal-watch>(function(){function start(){var d=document.querySelector('details.mf-fire-widget');if(!d)return;function report(){parent.postMessage({type:'mufy-reply-terminal',open:d.open},'*')}d.addEventListener('toggle',report);report()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()})();</script>`;

const MEMORY_LAYOUT=`<style data-mufy-viewport-memory>
html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;background:transparent!important;overflow:hidden!important}
.right-stable-sidebar{position:absolute!important;top:50%!important;right:0!important;transform:translateY(-50%)!important}
.right-sidebar-content{box-sizing:border-box;max-width:calc(100vw - 20px)!important;max-height:68vh!important}
</style><script>(function(){var d=document.querySelector('details.right-stable-sidebar');if(!d)return;function report(){parent.postMessage({type:'mufy-reply-terminal',open:d.open},'*')}d.addEventListener('toggle',report);report()})();</script>`;

/** Only the latest assistant reply owns this sidebar. Source HTML is obtained
 * from that reply's already-public render segments, never from stored/private
 * app state. DOMParser is inert; author scripts/event handlers are sanitized. */
export function MufyReplySidebar({segments,freeze=false,css,character,userName,onSendMessage,onFillComposer}:{segments:Segment[];freeze?:boolean;css:string;character:HostCharacterMeta;userName:string;onSendMessage: HostSendHandler;onFillComposer?:(text:string)=>void}){
 const [html,setHtml]=useState(''),[open,setOpen]=useState(false);
 const container=useRef<HTMLDivElement>(null);
 const memory=html.includes('right-stable-sidebar');
 const candidates=useMemo(()=>segments.map(s=>s.type==='html'?s.content:s.srcdoc),[segments]);
 useEffect(()=>{
  if(!css){setHtml('');return;}
  // Continuations update the same message: keep its mounted, interactive widget.
  if(freeze)return;
  let found='';
  for(const source of candidates){
   if(!/\b(?:mf-fire-widget|right-stable-sidebar)\b/.test(source))continue;
   const doc=new DOMParser().parseFromString(source,'text/html');
   const widget=doc.querySelector('details.mf-fire-widget,details.right-stable-sidebar');
   if(widget){widget.removeAttribute('open');found=sanitizeHtml(widget.outerHTML);}
  }
  setOpen(false);setHtml(found);
 },[candidates,css,freeze]);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   const frame=container.current?.querySelector('iframe');
   if(!frame||event.source!==frame.contentWindow)return;
   const data=event.data as {type?:unknown;open?:unknown}|null;
   if(data?.type==='mufy-reply-terminal'&&typeof data.open==='boolean')setOpen(data.open);
  };
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[]);
 return <><MufyReplyPet segments={segments} freeze={freeze} character={character} userName={userName} onSendMessage={onSendMessage} onFillComposer={onFillComposer}/>{html&&createPortal(<div ref={container} data-mufy-reply-sidebar data-kind={memory?'memory':'fire'} data-open={open} className="nj_floating_widget nj_floating_sidebar fixed right-0 z-[45] overflow-hidden" style={{top:memory?'50dvh':'12dvh',transform:memory?'translateY(-50%)':undefined,width:open?(memory?'min(300px,100vw)':'min(315px,100vw)'):(memory?20:34),height:memory?(open?'70dvh':60):(open?'min(600px,70dvh)':34)}}>
  <RegexIframe ruleId="mufy-latest-reply-terminal" ruleName="mufy-reply-terminal" srcdoc={`<style>${css}</style>${html}${memory?MEMORY_LAYOUT:SIDEBAR_LAYOUT}`} captureGroups={EMPTY_CAPTURE_GROUPS} character={character} userName={userName} onSendMessage={onSendMessage} onFillComposer={onFillComposer} fillHeight />
 </div>,document.body)}</>;
}
