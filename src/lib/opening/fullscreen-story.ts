/** Explicit, inert envelopes for the two observed public viewport programs. */
export type PublicTimeline = {version:1;kind:'censy-timeline-v10';triggerCss:string;document:string;triggerMarkup:string;entries:{label:string;modalMarkup:string}[]};
export type FullscreenStory = PublicTimeline |
 {version:1;kind:'censy-v19';triggerCss:string;document:string} |
 {version:1;kind:'censy-profile-v9';triggerCss:string;document:string;triggerMarkup:string;triggerLabel:string;inheritedFont:string;inheritedColor:string;inheritedLineHeight:number};
const marker=/<template data-nj-fullscreen-story-v1>([\s\S]*?)<\/template>/;
export function fullscreenStoryEnvelope(spec:FullscreenStory):string{return `<template data-nj-fullscreen-story-v1>${JSON.stringify(spec).replace(/</g,'\\u003c')}</template>`;}
export function parseFullscreenStory(input:string):FullscreenStory|null{
 const match=marker.exec(input);if(!match||match[1].length>200_000)return null;
 try{const s=JSON.parse(match[1]) as Partial<FullscreenStory>;
  if(s.version!==1||typeof s.triggerCss!=='string'||typeof s.document!=='string'||s.triggerCss.length>20_000||s.document.length>150_000||/<iframe\b|__MUFY_ARTIFACT_BRIDGE__|__MUFY_CLOSE_INITIAL_CONTEXT__|Network requests are blocked in sandbox/i.test(s.document))return null;
  if(s.kind==='censy-timeline-v10'){
   const t=s as Partial<PublicTimeline>;
   if(t.document!==''||typeof t.triggerMarkup!=='string'||t.triggerMarkup.length>20000||!t.triggerMarkup.includes('Z_CONFIG-xm-timeline-v10-fix')||!t.triggerCss?.includes('.Tuan_node_v10')||!Array.isArray(t.entries)||t.entries.length!==4)return null;
   const unsafe=/<script\b|<iframe\b|\bon\w+\s*=|url\s*\(|@import|expression\s*\(|javascript:|\\(?:[0-9a-f]{1,6}|.)/i;
   if(unsafe.test(t.triggerMarkup)||t.entries.some(e=>!e||typeof e.label!=='string'||e.label.length>30||!e.label.trim()||typeof e.modalMarkup!=='string'||e.modalMarkup.length>10000||!e.modalMarkup.includes('Z_CONFIG_close_xm_v10')||unsafe.test(e.modalMarkup)))return null;
   if(/\{\{[\s\S]*?\}\}/.test(t.triggerMarkup+JSON.stringify(t.entries)))return null;
  }else if(s.kind==='censy-v19'){
   if(!s.triggerCss.includes('.censy-anchor-v19')||!s.document.includes('window.parent.censyStartV19 = function()')||!s.document.includes("stage.id = 'censy-v19-stage'"))return null;
  }else if(s.kind==='censy-profile-v9'){
   if(!s.triggerCss.includes('.cenConfig_anchor_v9')||!s.document.includes('function Sx_init_v9()')||!s.document.includes("mask.id = 'Tuan_cover_v9'")||!s.document.includes('window.parent.Cmtt_off_v9 = function()')||typeof s.triggerMarkup!=='string'||s.triggerMarkup.length>10_000||!s.triggerMarkup.includes('Tt_name_glow_v9')||typeof s.triggerLabel!=='string'||!s.triggerLabel.trim()||s.triggerLabel.length>128||/<script\b|<iframe\b|\bon\w+\s*=/i.test(s.triggerMarkup))return null;
   if(typeof s.inheritedFont!=='string'||s.inheritedFont.length>200||!/^[-a-zA-Z0-9 ,"']+$/.test(s.inheritedFont)||typeof s.inheritedColor!=='string'||!/^rgb\((?:\d{1,3}, ){2}\d{1,3}\)$/.test(s.inheritedColor)||[...s.inheritedColor.matchAll(/\d+/g)].some(m=>Number(m[0])>255)||typeof s.inheritedLineHeight!=='number'||!Number.isFinite(s.inheritedLineHeight)||s.inheritedLineHeight<1||s.inheritedLineHeight>3)return null;
   if(/\{\{[\s\S]*?\}\}/.test(s.triggerMarkup+s.triggerLabel))return null;
  }else return null;
  // This observed cinematic is not personalized. Do not allow outer opening
  // interpolation to corrupt the inert JSON or accidentally rewrite programs.
  if(/\{\{[\s\S]*?\}\}/.test(s.document+s.triggerCss))return null;
  return s as FullscreenStory;
 }catch{return null;}
}

/** Start and observe only the local stage. Parent is an opaque local alias;
 * postMessage is used solely to request closing this same presentation. */
export function fullscreenStoryDocument(spec:FullscreenStory):string{
 if(spec.kind==='censy-timeline-v10')throw Error('FINITE_NATIVE_TIMELINE_HAS_NO_EXECUTABLE_DOCUMENT');
 if(spec.kind==='censy-profile-v9'){
  const presentation=`html,body{width:100%!important;height:100%!important;overflow:hidden!important;margin:0!important;padding:0!important}
.cenConfig_anchor_v9{display:none!important}
#Tuan_cover_v9,#Tuan_cover_v9 *,#Tuan_cover_v9 *::before,#Tuan_cover_v9 *::after{box-sizing:border-box}
body #Tuan_cover_v9{font-family:${spec.inheritedFont};color:${spec.inheritedColor};line-height:${spec.inheritedLineHeight}}
#Tuan_cover_v9 .cenConfig_win_v9{font-family:inherit;line-height:inherit}
#Tuan_cover_v9 .Mg_left_v9{scrollbar-width:thin}
#Tuan_cover_v9 .Mg_left_v9::-webkit-scrollbar{width:8px}`;
  const lifecycle=`<style data-nj-story-canvas>${presentation}</style><script data-nj-story-lifecycle>(function(){var seen=false;function close(){parent.postMessage({type:'nj_mufy_fullscreen_story_closed'},'*');}document.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close();}});function start(){var observer=new MutationObserver(function(){var stage=document.getElementById('Tuan_cover_v9');if(stage)seen=true;else if(seen){observer.disconnect();close();}});observer.observe(document.body,{childList:true});if(typeof window.Sx_init_v9==='function')window.Sx_init_v9();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();</script>`;
  const at=spec.document.lastIndexOf('</body>');return at>=0?spec.document.slice(0,at)+lifecycle+spec.document.slice(at):spec.document+lifecycle;
 }
 const lifecycle=`<style data-nj-story-canvas>html,body{width:100%!important;height:100%!important;overflow:hidden!important;margin:0!important;padding:0!important}.censy-anchor-v19{display:none!important}</style><script data-nj-story-lifecycle>(function(){var seen=false;function close(){parent.postMessage({type:'nj_mufy_fullscreen_story_closed'},'*');}document.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close();}});function start(){var observer=new MutationObserver(function(){var stage=document.getElementById('censy-v19-stage');if(stage)seen=true;else if(seen){observer.disconnect();close();}});observer.observe(document.body,{childList:true});if(typeof window.parent.censyStartV19==='function')window.parent.censyStartV19();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();</script>`;
 const at=spec.document.lastIndexOf('</body>');return at>=0?spec.document.slice(0,at)+lifecycle+spec.document.slice(at):spec.document+lifecycle;
}
