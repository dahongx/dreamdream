import {adaptMufySourceFrame} from './mufy-source-rule-envelope';

/** Only the known, already-rendered source program is eligible. Never search
 * host state or turn ordinary model HTML into an executable widget. */
export function extractMufyReplyPet(doc:Document):string|null {
 const template=doc.querySelector<HTMLTemplateElement>('template#censy-gu-pet-host');
 if(!template?.content.querySelector('#censy-gu-pet-wrapper #CenGu_Zone .CenGu_Img')||
    !template.content.querySelector('#CenGu_QianOverlay')||
    ![...template.content.querySelectorAll('script')].some(script=>script.textContent?.includes('pWin.CenGu_openIdeas')))return null;
 return template.innerHTML;
}

// Parent shim in RegexIframe redirects the author's pWin alias to its own
// opaque-origin document. The host receives geometry, never author DOM/code.
// Clip the full-viewport canvas to visible controls so a closed pet cannot
// leave an invisible full-screen layer blocking the chat underneath.
export function buildMufyReplyPetFrame(program:string):string {
 // Prose's mobile max-width:100% clamps intentionally overflowing pet menus
 // to the 90px pet zone. Keep draft/name bridges, not prose canvas layout CSS.
 const adapted=adaptMufySourceFrame(program).replace(/<style data-mufy-source-adaptation>[\s\S]*?<\/style>/,'');
 return '<style data-mufy-pet-preflight>:where(*,*::before,*::after){box-sizing:border-box}</style>'+adapted+`<style data-mufy-pet-viewport>html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important}
#CenGu_Menu{margin-left:-20px}
/* The authored food ring extends 40px beyond a pet only 20px from the edge. */
#censy-gu-pet-wrapper:has(#CenGu_FoodRing.CenGu_show){transform:translateX(-20px)}
</style><script data-mufy-pet-bounds>(function(){
 var queued=false,last='',dragging=false;
 function stabilizeAnchor(){if(!(innerWidth>0&&innerHeight>0))return;var wrap=document.getElementById('censy-gu-pet-wrapper'),zone=document.getElementById('CenGu_Zone'),bubble=document.getElementById('CenGu_Bubble');if(!wrap||!zone||!bubble)return;var z=getComputedStyle(zone),w=getComputedStyle(wrap),b=getComputedStyle(bubble),width=parseFloat(z.width),height=parseFloat(z.height),gap=parseFloat(w.columnGap)||parseFloat(w.gap)||0,max=parseFloat(b.maxWidth);if(width>0&&height>0&&max>0&&isFinite(width+height+max)){wrap.style.width=Math.min(innerWidth,width+gap+max)+'px';wrap.style.height=height+'px';}}
 function measure(){queued=false;var rects=[];
 ['CenGu_Zone','CenGu_Menu','CenGu_FoodRing','CenGu_IdeaPanel','CenGu_QianOverlay','CenGu_Bubble'].forEach(function(id){var el=document.getElementById(id);if(!el)return;var s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return;var r=el.getBoundingClientRect();if(r.width&&r.height)rects.push(r);});
 if(!rects.length)return;
 var x=Math.min(innerWidth,Math.max(0,Math.floor(Math.min.apply(null,rects.map(function(r){return r.left;})))));
 var y=Math.min(innerHeight,Math.max(0,Math.floor(Math.min.apply(null,rects.map(function(r){return r.top;})))));
 var right=Math.min(innerWidth,Math.ceil(Math.max.apply(null,rects.map(function(r){return r.right;}))));
 var bottom=Math.min(innerHeight,Math.ceil(Math.max.apply(null,rects.map(function(r){return r.bottom;}))));
 var value={type:'mufy-reply-pet-bounds',x:dragging?0:x,y:dragging?0:y,width:dragging?innerWidth:Math.max(0,right-x),height:dragging?innerHeight:Math.max(0,bottom-y),viewportWidth:innerWidth,viewportHeight:innerHeight};var key=JSON.stringify(value);if(key!==last){last=key;parent.postMessage(value,'*');}}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}
 function start(){stabilizeAnchor();new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true});measure();}
 ['pointermove','pointerup','transitionend','animationend','load'].forEach(function(name){window.addEventListener(name,schedule,true);});
 window.addEventListener('resize',function(){stabilizeAnchor();schedule();});
 window.addEventListener('host-ready',function(){stabilizeAnchor();last='';measure();});
 window.addEventListener('pointerdown',function(event){var node=event.target;if(!node||!node.closest||!node.closest('#CenGu_Zone')||node.closest('#CenGu_Menu,#CenGu_FoodRing'))return;dragging=true;last='';measure();},true);
 ['pointerup','pointercancel','lostpointercapture'].forEach(function(name){window.addEventListener(name,function(){if(!dragging)return;dragging=false;last='';measure();},true);});
 window.addEventListener('blur',function(){dragging=false;['CenGu_Menu','CenGu_FoodRing'].forEach(function(id){var node=document.getElementById(id);if(node)node.classList.remove('CenGu_show');});var ideas=document.getElementById('CenGu_IdeaPanel');if(ideas)ideas.style.display='none';last='';measure();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 })();</script>`;
}

export interface MufyPetBounds {x:number;y:number;width:number;height:number;viewportWidth:number;viewportHeight:number}
export function validateMufyPetBounds(value:unknown):MufyPetBounds|null {
 if(!value||typeof value!=='object')return null;
 const data=value as Record<string,unknown>;
 if(data.type!=='mufy-reply-pet-bounds')return null;
 const keys=['x','y','width','height','viewportWidth','viewportHeight'] as const;
 if(keys.some(key=>typeof data[key]!=='number'||!Number.isFinite(data[key])||(data[key] as number)<0||(data[key] as number)>20000))return null;
 const bounds=data as unknown as MufyPetBounds;
 if(!bounds.viewportWidth||!bounds.viewportHeight||bounds.x+bounds.width>bounds.viewportWidth||bounds.y+bounds.height>bounds.viewportHeight)return null;
 return Object.fromEntries(keys.map(key=>[key,bounds[key]])) as unknown as MufyPetBounds;
}
