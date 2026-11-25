"use client";
import type {HostSendHandler} from "@/lib/opening/host-composer-send-candidate";

import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {RegexIframe,type HostCharacterMeta} from '@/components/regex/RegexIframe';
import {buildMufyReplyPetFrame,extractMufyReplyPet,validateMufyPetBounds,type MufyPetBounds} from '@/lib/import/mufy-reply-pet';
import type {Segment} from '@/lib/regex/segments';

const EMPTY_CAPTURES:string[]=[];

/** Mounted only by the latest assistant row. Keep the live sandbox while a
 * continuation streams, just like the existing fire/memory sidebar. */
export function MufyReplyPet({segments,freeze=false,character,userName,onSendMessage,onFillComposer}:{segments:Segment[];freeze?:boolean;character:HostCharacterMeta;userName:string;onSendMessage: HostSendHandler;onFillComposer?:(text:string)=>void}) {
 const [program,setProgram]=useState('');
 const [bounds,setBounds]=useState<MufyPetBounds|null>(null);
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(freeze)return;
  let next='';
  for(const segment of segments){
   // Only executable source segments qualify, never sanitized prose HTML.
   if(segment.type!=='iframe'||!segment.srcdoc.includes('censy-gu-pet-host'))continue;
   next=extractMufyReplyPet(new DOMParser().parseFromString(segment.srcdoc,'text/html'))??next;
  }
  if(next===program)return;
  // Reset before mounting the new document. Resetting in a later [program]
  // effect can discard a small srcdoc's first geometry message after it loads.
  setBounds(null);setProgram(next);
 },[segments,freeze,program]);
 useEffect(()=>{
  function receive(event:MessageEvent){
   const frame=container.current?.querySelector('iframe');
   if(!frame||event.source!==frame.contentWindow)return;
   const next=validateMufyPetBounds(event.data);
   if(next)setBounds(next);
  }
  window.addEventListener('message',receive);
  return()=>window.removeEventListener('message',receive);
 },[]);
 const srcdoc=useMemo(()=>program?buildMufyReplyPetFrame(program):'',[program]);
 if(!program)return null;
 return createPortal(<div ref={container} data-mufy-reply-pet className="nj_floating_widget fixed z-[45] overflow-hidden" style={{left:bounds?.x??0,top:bounds?.y??0,width:bounds?.width??0,height:bounds?.height??0}}>
  <div style={{position:'absolute',left:-(bounds?.x??0),top:-(bounds?.y??0),width:'100dvw',height:'100dvh'}}>
   <RegexIframe ruleId="mufy-latest-reply-pet" ruleName="mufy-reply-pet" srcdoc={srcdoc} captureGroups={EMPTY_CAPTURES} character={character} userName={userName} onSendMessage={onSendMessage} onFillComposer={onFillComposer} parentShim fillHeight />
  </div>
 </div>,document.body);
}
