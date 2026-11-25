/** Staging-only finite adapter. Never execute captured scripts or expose the host. */
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';

const PROGRAM_SHA256='f7a15a6cee2affe2631be3a92961125e18c3cb39d9375a8a08c8271c08e98550';
const inlineCalls=[
  'window.parent.Z_ToggleGhostPanel()', 'window.parent.Z_ToggleGhostAudio()',
  'window.parent.Z_SwitchGhostTrack(0)', 'window.parent.Z_SwitchGhostTrack(1)',
  'window.parent.Z_SwitchGhostTrack(2)',
];
const digest=(s:string)=>createHash('sha256').update(s.replace(/\r\n/g,'\n').trim()).digest('hex');

export function localizeKnownPublicGhostMusicV4(input:string):{
  html:string; localized:boolean; reason:string; localizedControllerCount:number;
  localizedInlineCount:number; mediaRuntimeVerified:false;
}{
  const unchanged=(reason:string)=>({html:input,localized:false,reason,localizedControllerCount:0,localizedInlineCount:0,mediaRuntimeVerified:false as const});
  const dom=new JSDOM(input),doc=dom.window.document;
  const templates=[...doc.querySelectorAll<HTMLTemplateElement>('template#censy-ghost-music-v4')];
  if(templates.length!==1){dom.window.close();return unchanged('EXACT_TEMPLATE_NOT_FOUND');}
  const template=templates[0];
  const requiredIds=['C_GhostTrigger_Box','C_GhostPlayer_Panel','C_Ghost_PlayBtn','C_Ghost_Wave','C_Ghost_AudioEngine'];
  const knownNodes=requiredIds.every(id=>template.content.querySelectorAll(`[id="${id}"]`).length===1);
  const handlers=[...template.content.querySelectorAll('[onclick]')].map(n=>n.getAttribute('onclick'));
  const exactHandlers=handlers.length===inlineCalls.length&&inlineCalls.every(call=>handlers.filter(h=>h===call).length===1);
  const knownPrograms=[...doc.scripts].filter(s=>digest(s.textContent??'')===PROGRAM_SHA256);
  dom.window.close();
  if(!knownNodes||!exactHandlers||knownPrograms.length!==1)return unchanged('EXACT_PUBLIC_CONTROLLER_OR_CONTROLS_NOT_MATCHED');

  let scriptCount=0,templateCount=0,inlineCount=0;
  let html=input.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(whole,attrs:string,code:string)=>{
    if(digest(code)!==PROGRAM_SHA256)return whole;
    scriptCount++;
    // Entire program is pinned, including its initial meta lookup before try.
    // These bindings are local to this sandbox; no window.parent alias remains.
    return `<script${attrs}>${code.replaceAll('window.parent','window')}</script>`;
  });
  html=html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,whole=>{
    if(!/^<template\b[^>]*\bid\s*=\s*(["'])censy-ghost-music-v4\1/i.test(whole))return whole;
    templateCount++;
    for(const call of inlineCalls){
      const old=`onclick="${call}"`,next=`onclick="${call.replace('window.parent.','window.')}"`;
      if(whole.split(old).length!==2)throw new Error('KNOWN_GHOST_INLINE_SERIALIZATION_CHANGED');
      whole=whole.replace(old,next);inlineCount++;
    }
    return whole;
  });
  if(scriptCount!==1||templateCount!==1||inlineCount!==5)throw new Error('KNOWN_GHOST_LOCALIZATION_BOUNDARY_CHANGED');
  return {html,localized:true,reason:'EXACT_PUBLIC_GHOST_MUSIC_V4_LOCALIZED',localizedControllerCount:scriptCount,localizedInlineCount:inlineCount,mediaRuntimeVerified:false};
}
