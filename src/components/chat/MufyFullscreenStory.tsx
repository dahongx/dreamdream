"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {buildIframeSrcdoc} from '@/lib/regex/iframe-bridge';
import {fullscreenStoryDocument,type FullscreenStory} from '@/lib/opening/fullscreen-story';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';
import DOMPurify from 'isomorphic-dompurify';
import {MufyPublicTimeline} from './MufyPublicTimeline';

/** In-flow inert source trigger + isolated viewport-sized presentation.
 * No host RPC port, conversation context, storage or real parent DOM access. */
export function MufyFullscreenStory({spec,widgetKey}:{spec:FullscreenStory;widgetKey:string}){
 return spec.kind==='censy-timeline-v10'?<MufyPublicTimeline spec={spec} widgetKey={widgetKey}/>:<OpaqueFullscreenStory spec={spec} widgetKey={widgetKey}/>;
}
function OpaqueFullscreenStory({spec,widgetKey}:{spec:Exclude<FullscreenStory,{kind:'censy-timeline-v10'}>;widgetKey:string}){
 const host=useRef<HTMLDivElement>(null),trigger=useRef<HTMLDivElement>(null),frame=useRef<HTMLIFrameElement>(null);
 const[shadow,setShadow]=useState<ShadowRoot|null>(null),[open,setOpen]=useState(false);
 const css=useMemo(()=>sanitizeAndScopeCss(spec.triggerCss,'opening').css,[spec.triggerCss]);
 // Story stays above the chat stage (3), below native source navigation/music (44/45).
 const profile=spec.kind==='censy-profile-v9';
 const label=profile?spec.triggerLabel:'TAP TO AWAKEN MEMORIES';
 const triggerMarkup=useMemo(()=>spec.kind==='censy-profile-v9'?DOMPurify.sanitize(spec.triggerMarkup,{ALLOWED_TAGS:['div','span'],ALLOWED_ATTR:['class']}):'',[spec.kind,spec.kind==='censy-profile-v9'?spec.triggerMarkup:'']);
 const srcdoc=useMemo(()=>buildIframeSrcdoc({srcdoc:fullscreenStoryDocument(spec),captureGroups:[],inlineParentShim:true,cssScope:'fullscreen-story'}),[spec.kind,spec.document,spec.triggerCss,spec.kind==='censy-profile-v9'?spec.inheritedFont:'',spec.kind==='censy-profile-v9'?spec.inheritedColor:'',spec.kind==='censy-profile-v9'?spec.inheritedLineHeight:0]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  if(!open)return;
  const close=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());};
  const message=(e:MessageEvent)=>{if(e.source===frame.current?.contentWindow&&e.data?.type==='nj_mufy_fullscreen_story_closed')close();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close();}};
  window.addEventListener('message',message);document.addEventListener('keydown',key);frame.current?.focus();
  return()=>{window.removeEventListener('message',message);document.removeEventListener('keydown',key);};
 },[open]);
 return <><div ref={host} data-nj-fullscreen-story-trigger={widgetKey}>{shadow&&createPortal(<>
  <style>{`:host{all:initial;display:block;width:100%}${css}[data-character-css="opening"] .censy-anchor-v19:focus-visible,[data-character-css="opening"] .cenConfig_anchor_v9:focus-visible{outline:2px solid rgba(255,255,255,.4);outline-offset:-2px}`}</style>
  <div data-character-css="opening"><div ref={trigger} id={profile?'Mm_anchor_v9':undefined} className={profile?'cenConfig_anchor_v9':'censy-anchor-v19'} role="button" tabIndex={0} aria-label={label} onClick={()=>setOpen(true)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOpen(true);}}} dangerouslySetInnerHTML={{__html:triggerMarkup}}/></div>
 </>,shadow)}</div>{open&&createPortal(<div data-nj-fullscreen-story={widgetKey} role="dialog" aria-modal="true" aria-label={profile?label:'Memories'} style={{position:'fixed',inset:0,zIndex:profile?10000:43,...(profile?{width:'100vw',height:'100dvh'}:{})}}><iframe ref={frame} title={`mufy-fullscreen-story-${widgetKey}`} sandbox="allow-scripts" srcDoc={srcdoc} style={{display:'block',width:'100%',height:'100%',border:0,background:'transparent'}}/></div>,document.body)}</>;
}
