import {KNOWN_ORB_TEMPLATE,KNOWN_ORB_TEMPLATE_SERIALIZED} from './known-orb-binding';
import {parseFloatingSourceGeometry} from '@/lib/opening/floating-source-geometry';

/** A literal public author CSS + SVG + controller binding, never a caller-supplied hash. */
export function knownOrbGeometry(kind:string,value:unknown,srcdoc:string){
 if(kind!=='orb-right')return null;
 const geometry=parseFloatingSourceGeometry(value);
 if(!geometry)return null;
 const normalized=srcdoc.replace(/\r\n/g,'\n');
 const bindings=[KNOWN_ORB_TEMPLATE,KNOWN_ORB_TEMPLATE_SERIALIZED].map(s=>s.replace(/\r\n/g,'\n'));
 if(!bindings.some(binding=>normalized.split(binding).length===2))return null;
 if((normalized.match(/<template\b[^>]*\bid=["']censy-floatOrb-payload["']/g)||[]).length!==1)return null;
 // Geometry itself is part of this known source contract, not a freely movable author program.
 if(geometry.rightPx!==16||geometry.bottomPx!==140||geometry.collapsed.width!==48||geometry.collapsed.height!==78||geometry.topPx!==undefined)return null;
 if(geometry.expanded&&(geometry.expanded.width!==48||geometry.expanded.height!==78))return null;
 return geometry;
}

// Keep source transform for its kill scale animation. This changes only local coordinates.
export const KNOWN_ORB_LOCAL_CSS='<style data-nj-known-orb-local="v1">#censy-floatOrb-root{position:relative!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;margin:0!important}</style>';

/** Public document version checksum, NOT authentication or a capability grant. */
export function orbDocumentVersion(publicSrcdoc:string):string{
 let a=0x811c9dc5,b=0x9e3779b9;
 for(let i=0;i<publicSrcdoc.length;i++){const n=publicSrcdoc.charCodeAt(i);a=Math.imul(a^n,0x01000193);b=Math.imul(b^n,0x85ebca6b)}
 return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export function orbInstanceToken(reactInstanceId:string,publicSrcdoc:string):string{
 if(!/^[A-Za-z0-9:_-]{1,96}$/.test(reactInstanceId))throw Error('INVALID_ORB_REACT_INSTANCE');
 return `orb1:${reactInstanceId}:${orbDocumentVersion(publicSrcdoc)}`;
}
const validToken=(token:unknown):token is string=>typeof token==='string'&&/^orb1:[A-Za-z0-9:_-]{1,96}:[a-f\d]{16}$/.test(token)&&token.length<=120;

/** Trusted observer watches only the public known root class. No Audio closure access. */
export function knownOrbVisibilityScript(token:string){
 if(!validToken(token))throw Error('INVALID_ORB_INSTANCE_TOKEN');
 return `<script data-nj-known-orb-observer>(function(){var disposed=false,sent=false,observer;function dispose(){disposed=true;if(observer)observer.disconnect();window.removeEventListener('pagehide',dispose)}function check(){if(disposed||sent)return;var root=document.getElementById('censy-floatOrb-root');if(root&&root.classList.contains('censy-hidden')){sent=true;window.parent.postMessage({type:'nj_known_orb_visibility',version:1,hidden:true,token:${JSON.stringify(token)}},'*')}}observer=new MutationObserver(check);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});window.addEventListener('pagehide',dispose);check()})();</script>`;
}

export function acceptKnownOrbHidden(expected:unknown,source:unknown,data:unknown,token:string){
 if(!validToken(token)||expected==null||source!==expected||!data||typeof data!=='object'||Array.isArray(data))return false;
 const proto=Object.getPrototypeOf(data);if(proto!==Object.prototype&&proto!==null)return false;
 const descriptors=Object.getOwnPropertyDescriptors(data);
 if(Reflect.ownKeys(data).length!==4||Reflect.ownKeys(data).some(k=>typeof k!=='string'||!['type','version','hidden','token'].includes(k)))return false;
 if(Object.values(descriptors).some(d=>d.get||d.set))return false;
 const d=data as Record<string,unknown>;
 return d.type==='nj_known_orb_visibility'&&d.version===1&&d.hidden===true&&d.token===token;
}
