"use client";
import {MufyLinToolkit83} from "./MufyLinToolkit83";
import {validLin83Spec} from "@/lib/opening/lin-toolkit-83-contract";
import {MufyLinToolkit} from "./MufyLinToolkit";
import {KNOWN_V5_QUICK_ACTIONS,insertKnownV5QuickSymbol,type KnownV5QuickAction} from '@/lib/opening/known-v5-quick-symbols';
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import DOMPurify from 'isomorphic-dompurify';
import {extractNativeImageSidebars,type NativeImageSidebar} from '@/lib/opening/native-image-sidebar';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';

export type QuickSymbolAction='bracket'|'dollar'|'phone';
export function insertQuickSymbol(value:string,start:number,end:number,action:QuickSymbolAction){
 const at=Number.isFinite(start)?Math.max(0,Math.min(value.length,start)):value.length;
 const until=Number.isFinite(end)?Math.max(at,Math.min(value.length,end)):at;
 const text=action==='bracket'?'（）':action==='dollar'?'$':'$线上聊天：';
 return{value:value.slice(0,at)+text+value.slice(until),caret:at+(action==='bracket'?1:text.length)};
}
export function uniqueSourceControls(contents:string[]):NativeImageSidebar|null{
 const found=contents.flatMap(c=>extractNativeImageSidebars(c).sidebars).filter(s=>s.variant==='page-controls');
 return found.length===1?found[0]:null;
}
/** Only currently rendered chat DOM is searchable; no storage, frame crossing or network. */
export function capsuleSearchNodes(chat:HTMLElement,query:string):HTMLElement[]{
 const value=query.trim().toLocaleLowerCase();if(!value)return[];
 return Array.from(chat.querySelectorAll<HTMLElement>('.nj_ai_message_bubble,.nj_user_message_bubble,p[dir="auto"]')).filter(node=>{
  const bubble=node.matches('.nj_ai_message_bubble,.nj_user_message_bubble');if(!bubble&&node.closest('.nj_ai_message_bubble,.nj_user_message_bubble'))return false;
  return !node.closest('[hidden],[aria-hidden="true"],template,script,style')&&!!node.textContent?.toLocaleLowerCase().includes(value);
 });
}
function CapsuleNavigation({spec}:{spec:NativeImageSidebar}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),[shadow,setShadow]=useState<ShadowRoot|null>(null);
 const html=useMemo(()=>DOMPurify.sanitize(spec.shellHtml,{ALLOWED_TAGS:['div','span','button','input','svg','circle','line','polyline'],ALLOWED_ATTR:['id','class','type','placeholder','value','viewBox','fill','stroke','stroke-width','points','cx','cy','r','x1','x2','y1','y2','width','height'],ALLOW_DATA_ATTR:false}),[spec.shellHtml]);
 const markup=useMemo(()=>({__html:html}),[html]),css=useMemo(()=>sanitizeAndScopeCss(spec.css,'opening').css+'input{padding:0}svg{display:block;vertical-align:middle}',[spec.css]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  if(!shadow)return;const root=shell.current,hub=root?.querySelector<HTMLElement>('#cen_nav_capsule_hub'),panel=root?.querySelector<HTMLElement>('#cen_NAV_Search_Panel'),query=root?.querySelector<HTMLInputElement>('#CEN_MINI_SEARCH_INP'),jump=root?.querySelector<HTMLInputElement>('#CEN_MINI_JUMP_INP'),total=root?.querySelector<HTMLElement>('#CEN_MINI_SEARCH_TOTAL'),handle=root?.querySelector<HTMLElement>('.cen-nav-drag-handle');
  const hubButtons=hub?.querySelectorAll<HTMLButtonElement>('button'),panelButtons=panel?.querySelectorAll<HTMLButtonElement>('button'),close=panel?.querySelector<HTMLElement>('span:last-child');
  if(!root||!hub||!panel||!query||!jump||!total||!handle||hubButtons?.length!==3||panelButtons?.length!==3||!close)return;
  let opened=false,hits:HTMLElement[]=[],index=-1,glow:HTMLElement|null=null,glowBefore='',glowApplied='',glowTimer:ReturnType<typeof setTimeout>|null=null,drag:{id:number;x:number;y:number;left:number;top:number}|null=null;
  const clearGlow=()=>{if(glowTimer)clearTimeout(glowTimer);glowTimer=null;if(glow&&glow.style.boxShadow===glowApplied)glow.style.boxShadow=glowBefore;glow=null;};
  const getChat=()=>document.getElementById('nj_chat_messages');
  const prune=()=>{const chat=getChat();hits=hits.filter(n=>n.isConnected&&!!chat?.contains(n));if(!hits.length)index=-1;else index=Math.max(0,Math.min(index,hits.length-1));};
  const count=()=>{total.textContent=String(hits.length);jump.value=String(index<0?0:index+1);};
  const focusHit=()=>{clearGlow();prune();count();const node=hits[index],chat=getChat();if(!node||!chat)return;const r=node.getBoundingClientRect(),c=chat.getBoundingClientRect();chat.scrollTo({top:chat.scrollTop+r.top-c.top-(chat.clientHeight-r.height)/2,behavior:'smooth'});glow=node;glowBefore=node.style.boxShadow;node.style.boxShadow='0 0 15px 5px rgba(255,255,255,0.4)';glowApplied=node.style.boxShadow;glowTimer=setTimeout(clearGlow,2000);};
  const find=()=>{clearGlow();const chat=getChat();hits=chat?capsuleSearchNodes(chat,query.value):[];index=hits.length?0:-1;query.setAttribute('aria-invalid',String(!hits.length&&!!query.value.trim()));focusHit();};
  const setOpen=(v:boolean)=>{opened=v;panel.style.display=v?'block':'none';panel.inert=!v;panel.setAttribute('aria-hidden',String(!v));hubButtons[1].setAttribute('aria-expanded',String(v));if(v)query.focus();else{clearGlow();hubButtons[1].focus();}};
  const edge=(bottom:boolean)=>{const chat=getChat();chat?.scrollTo({top:bottom?chat.scrollHeight:0,behavior:'smooth'});};
  const bindings:[EventTarget,string,EventListener][]=[];const listen=(el:EventTarget,event:string,fn:EventListener)=>{el.addEventListener(event,fn);bindings.push([el,event,fn]);};
  const bind=(el:HTMLElement,label:string,fn:()=>void)=>{el.setAttribute('aria-label',label);el.setAttribute('role','button');el.tabIndex=0;listen(el,'click',()=>fn());if(el.tagName!=='BUTTON')listen(el,'keydown',e=>{const k=e as KeyboardEvent;if(k.key==='Enter'||k.key===' '){k.preventDefault();fn();}});};
  bind(hubButtons[0],'回顶部',()=>edge(false));bind(hubButtons[1],'查找对话文字',()=>setOpen(!opened));bind(hubButtons[2],'去底部',()=>edge(true));bind(panelButtons[0],'查找',find);bind(panelButtons[1],'上一处',()=>{prune();if(hits.length)index=(index-1+hits.length)%hits.length;focusHit();});bind(panelButtons[2],'下一处',()=>{prune();if(hits.length)index=(index+1)%hits.length;focusHit();});bind(close,'关闭查找',()=>setOpen(false));
  query.setAttribute('aria-label','查找当前已渲染对话');jump.setAttribute('aria-label','跳到第几处');jump.min='1';listen(query,'keydown',e=>{if((e as KeyboardEvent).key==='Enter'){e.preventDefault();find();}});
  const commitJump=()=>{prune();const n=Number.parseInt(jump.value,10);index=hits.length?Math.max(0,Math.min(hits.length-1,(Number.isFinite(n)?n:1)-1)):-1;focusHit();};listen(jump,'change',commitJump);listen(jump,'blur',commitJump);listen(jump,'keydown',e=>{if((e as KeyboardEvent).key==='Enter'){e.preventDefault();commitJump();}});
  listen(document,'keydown',e=>{if((e as KeyboardEvent).key==='Escape'&&opened)setOpen(false);});listen(document,'pointerdown',e=>{if(opened&&host.current&&!e.composedPath().includes(host.current))setOpen(false);});
  const clamp=()=>{const r=panel.getBoundingClientRect();panel.style.transform='none';panel.style.left=Math.max(8,Math.min(r.left,window.innerWidth-r.width-8))+'px';panel.style.top=Math.max(8,Math.min(r.top,window.innerHeight-r.height-8))+'px';};
  listen(handle,'pointerdown',e=>{const p=e as PointerEvent;if(p.button!==0)return;const r=panel.getBoundingClientRect();drag={id:p.pointerId,x:p.clientX,y:p.clientY,left:r.left,top:r.top};handle.setPointerCapture?.(p.pointerId);p.preventDefault();});
  listen(handle,'pointermove',e=>{const p=e as PointerEvent;if(!drag||drag.id!==p.pointerId)return;panel.style.transform='none';panel.style.left=drag.left+p.clientX-drag.x+'px';panel.style.top=drag.top+p.clientY-drag.y+'px';clamp();});listen(handle,'pointerup',()=>{drag=null;});listen(handle,'pointercancel',()=>{drag=null;});listen(window,'resize',()=>{if(opened)clamp();});
  panel.style.display='none';panel.inert=true;panel.setAttribute('aria-hidden','true');hubButtons[1].setAttribute('aria-expanded','false');count();
  return()=>{for(const[el,event,fn]of bindings)el.removeEventListener(event,fn);clearGlow();};
 },[shadow,html]);
 return <div ref={host} className="nj_source_capsule_navigation" style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:44}}>{shadow&&createPortal(<div data-character-css="opening" style={{fontFamily:'ui-sans-serif,system-ui,sans-serif',fontSize:16,lineHeight:1.5}}><style>{css+`*,*::before,*::after{box-sizing:border-box}#cen_nav_capsule_hub{position:fixed!important;top:50%!important;right:1px!important;transform:translateY(70%)!important;pointer-events:auto!important}#cen_NAV_Search_Panel{position:fixed!important;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:auto!important;max-width:calc(100vw - 16px)}.cen-nav-drag-handle{touch-action:none}button{padding:0;margin:0;font-size:inherit}button,input{font-family:inherit;line-height:inherit}input{min-width:0}button:focus-visible,[role=button]:focus-visible,input:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>;
}
function SourceShadow({css,children,fixed=false}:{css:string;children:React.ReactNode;fixed?:boolean}){
 const host=useRef<HTMLDivElement>(null),[shadow,setShadow]=useState<ShadowRoot|null>(null);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 // These buttons live in an isolated local panel, not Dearm's global toolbar.
 // Anchor bare source selectors before the global semantic-button mapper runs.
 const safeCss=useMemo(()=>sanitizeAndScopeCss(css.replace(/(^|[}\n])(\s*)button\b/g,'$1$2.symbol-panel button'),'opening').css,[css]);
 // Match the source panel's 10px right inset, but let the host toolbar wrap
 // when Dearm's extra native controls leave insufficient room. Never overlap.
 return <div ref={host} className={fixed?'nj_source_scroll_controls':'nj_source_quick_symbols'} style={fixed?{position:'fixed',inset:0,pointerEvents:'none',zIndex:44}:{display:'flex',justifyContent:'flex-end',flexShrink:0,marginInlineStart:'auto',paddingInlineEnd:10,width:'max-content',maxWidth:'100%',boxSizing:'border-box'}}>{shadow&&createPortal(<div data-character-css="opening" style={{fontFamily:'ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'}}><style>{safeCss+`[data-character-css="opening"] *{box-sizing:border-box}[data-character-css="opening"] .fox-elevator-container{position:fixed;right:max(20px,calc(50vw - 420px));top:100px;pointer-events:none}[data-character-css="opening"] .fox-btn{pointer-events:auto}[data-character-css="opening"] button:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}</style>{children}</div>,shadow)}</div>;
}
function HeartNavigation({spec}:{spec:NativeImageSidebar}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),[shadow,setShadow]=useState<ShadowRoot|null>(null);
 const html=useMemo(()=>DOMPurify.sanitize(spec.shellHtml,{ALLOWED_TAGS:['div','svg','path'],ALLOWED_ATTR:['id','class','viewBox','d'],ALLOW_DATA_ATTR:false}),[spec.shellHtml]);
 const markup=useMemo(()=>({__html:html}),[html]),css=useMemo(()=>sanitizeAndScopeCss(spec.css,'opening').css,[spec.css]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  const root=shell.current,trigger=root?.querySelector<HTMLElement>('#cen-v4-trigger'),menu=root?.querySelector<HTMLElement>('#cen-v4-menu'),up=root?.querySelector<HTMLElement>('#cen-v4-up'),down=root?.querySelector<HTMLElement>('#cen-v4-down');if(!shadow||!trigger||!menu||!up||!down)return;
  let open=false;const bindings:[EventTarget,string,EventListener][]=[];
  const listen=(el:EventTarget,event:string,fn:EventListener)=>{el.addEventListener(event,fn);bindings.push([el,event,fn]);};
  const setOpen=(value:boolean)=>{open=value;trigger.classList.toggle('is-active',value);trigger.setAttribute('aria-expanded',String(value));menu.classList.toggle('is-open',value);menu.inert=!value;menu.setAttribute('aria-hidden',String(!value));};
  const edge=(bottom:boolean)=>{const chat=document.getElementById('nj_chat_messages');chat?.scrollTo({top:bottom?chat.scrollHeight:0,behavior:'smooth'});};
  for(const[el,label,fn]of [[trigger,'展开滚动工具',()=>setOpen(!open)],[up,'回顶部',()=>edge(false)],[down,'去底部',()=>edge(true)]] as const){el.setAttribute('role','button');el.setAttribute('aria-label',label);el.tabIndex=0;listen(el,'click',fn);listen(el,'keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();fn();}});}
  listen(document,'keydown',e=>{if((e as KeyboardEvent).key==='Escape'&&open){setOpen(false);trigger.focus();}});setOpen(false);
  return()=>{for(const[el,event,fn]of bindings)el.removeEventListener(event,fn);};
 },[shadow,html]);
 return <div ref={host} className="nj_source_heart_navigation" style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:44}}>{shadow&&createPortal(<div data-character-css="opening"><style>{css+`#censy-heart-elevator-v4-wrap{position:fixed!important;right:20px!important;bottom:90px!important;pointer-events:none}#cen-v4-trigger{pointer-events:auto}.cen-v4-menu{pointer-events:none}.cen-v4-menu.is-open{pointer-events:auto}svg{display:block}*,*::before,*::after{box-sizing:border-box}[role=button]:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>;
}
/** Four source arrows; only the rendered chat scrolls, never unrelated panels. */
function NarrowNavigation({spec}:{spec:NativeImageSidebar}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),[shadow,setShadow]=useState<ShadowRoot|null>(null);
 const html=useMemo(()=>DOMPurify.sanitize(spec.shellHtml,{ALLOWED_TAGS:['div','span'],ALLOWED_ATTR:['id','class','title'],ALLOW_DATA_ATTR:false}),[spec.shellHtml]),markup=useMemo(()=>({__html:html}),[html]),css=useMemo(()=>sanitizeAndScopeCss(spec.css,'opening').css,[spec.css]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  const root=shell.current?.querySelector<HTMLElement>('#censy-narrow-nav-v14'),buttons=root?.querySelectorAll<HTMLElement>('.Cmtt_nbtn'),handle=root?.querySelector<HTMLElement>('.Tt_nbrand');if(!shadow||!root||buttons?.length!==4||!handle)return;
  const bindings:[EventTarget,string,EventListener][]=[];const listen=(el:EventTarget,name:string,fn:EventListener)=>{el.addEventListener(name,fn);bindings.push([el,name,fn]);};
  const move=(x:number,y:number)=>{const r=root.getBoundingClientRect();root.style.left=Math.max(0,Math.min(window.innerWidth-r.width-2,x))+'px';root.style.top=Math.max(0,Math.min(window.innerHeight-r.height,y))+'px';};
  for(const[i,button]of Array.from(buttons).entries()){const action=()=>{const chat=document.getElementById('nj_chat_messages');if(!chat)return;const top=i===0?0:i===3?chat.scrollHeight:chat.scrollTop+(i===1?-1:1)*chat.clientHeight*.8;chat.scrollTo({top,behavior:'smooth'});};button.setAttribute('role','button');button.setAttribute('aria-label',['回顶部','向上一屏','向下一屏','去底部'][i]);button.tabIndex=0;listen(button,'pointerdown',e=>{e.preventDefault();e.stopPropagation();action();});listen(button,'keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();action();}});}
  let drag:{id:number;x:number;y:number;left:number;top:number}|null=null;handle.setAttribute('role','button');handle.setAttribute('aria-label','拖动滚动导航');handle.tabIndex=0;
  listen(root,'pointerdown',e=>{const p=e as PointerEvent;if(p.button!==0||(p.target as Element).closest('.Cmtt_nbtn'))return;e.preventDefault();const r=root.getBoundingClientRect();drag={id:p.pointerId,x:p.clientX,y:p.clientY,left:r.left,top:r.top};root.setPointerCapture?.(p.pointerId);});
  listen(root,'pointermove',e=>{const p=e as PointerEvent;if(drag?.id===p.pointerId)move(drag.left+p.clientX-drag.x,drag.top+p.clientY-drag.y);});
  const stop:EventListener=()=>{drag=null;};listen(root,'pointerup',stop);listen(root,'pointercancel',stop);
  listen(handle,'keydown',e=>{const k=(e as KeyboardEvent).key;if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k))return;e.preventDefault();const r=root.getBoundingClientRect();move(r.left+(k==='ArrowLeft'?-10:k==='ArrowRight'?10:0),r.top+(k==='ArrowUp'?-10:k==='ArrowDown'?10:0));});
  const resize=()=>{if(root.style.left||root.style.top){const r=root.getBoundingClientRect();move(r.left,r.top);}};window.addEventListener('resize',resize);
  return()=>{for(const[el,name,fn]of bindings)el.removeEventListener(name,fn);window.removeEventListener('resize',resize);drag=null;};
 },[shadow,html]);
 return <div ref={host} className="nj_source_narrow_navigation" style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:44}}>{shadow&&createPortal(<div data-character-css="opening"><style>{css+'#censy-narrow-nav-v14{position:fixed!important;pointer-events:auto!important}.Tt_nbrand{width:100%;touch-action:none;cursor:grab}[role=button]:focus-visible{outline:1px solid currentColor;outline-offset:-1px}'}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>;
}

/** Trusted, bounded actions only: no author script, send, storage or context API. */
export function MufySourceControls({spec,inputRef,onChange,userName="",characterName=""}:{spec:NativeImageSidebar;inputRef:RefObject<HTMLTextAreaElement|null>;onChange:(value:string)=>void;userName?:string;characterName?:string}){
 const pending=useRef<{value:string;caret:number}|null>(null);
 // Restore before paint: consecutive native actions must not observe the
 // textarea's temporary end-of-value selection while waiting for an rAF.
 useLayoutEffect(()=>{const next=pending.current,input=inputRef.current;if(!next||!input||input.value!==next.value)return;pending.current=null;if(input.isConnected){input.focus();input.setSelectionRange(next.caret,next.caret);}});
 const insert=(action:QuickSymbolAction)=>{const input=inputRef.current;if(!input)return;const next=insertQuickSymbol(input.value,input.selectionStart,input.selectionEnd,action);pending.current=next;onChange(next.value);};
 const scroll=(bottom:boolean)=>{const chat=document.getElementById('nj_chat_messages');if(chat)chat.scrollTo({top:bottom?chat.scrollHeight:0,behavior:'smooth'});};
 const insertV5=(action:KnownV5QuickAction)=>{const input=inputRef.current;if(!input)return;const next=insertKnownV5QuickSymbol(input.value,input.selectionStart,input.selectionEnd,action);pending.current=next;onChange(next.value);};
 if(validLin83Spec(spec))return <MufyLinToolkit83 inputRef={inputRef} onChange={onChange} userName={userName} characterName={characterName}/>;
 if(spec.pageControls?.linToolkit)return <MufyLinToolkit inputRef={inputRef} onChange={onChange} userName={userName} characterName={characterName}/>;
 if(spec.pageControls?.quickSymbols==='source-v5-four')return <SourceShadow css={spec.pageControls?.quickCss??''}><div id="cen_quick_insert_toolbar_v5" className="symbol-panel">{KNOWN_V5_QUICK_ACTIONS.map(item=><button key={item.action} className={'cen-quick-btn'+(item.action==='phone'?' cen-quick-icon':'')} type="button" title={item.title} aria-label={item.title} onMouseDown={e=>e.preventDefault()} onClick={()=>insertV5(item.action)}>{item.action==='phone'?<svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>:item.label}</button>)}</div></SourceShadow>;
 if(spec.pageControls?.navigation==='heart')return <HeartNavigation spec={spec}/>;
 if(spec.pageControls?.navigation==='narrow')return <NarrowNavigation spec={spec}/>;
 return <>{spec.pageControls?.navigation==='capsule'&&<CapsuleNavigation spec={spec}/>}<SourceShadow css={spec.pageControls?.quickCss??''}><div className="symbol-panel">{([['bracket','（）','插入括号'],['dollar','$','插入指令符'],['phone','📱','线上聊天前缀']] as const).map(([action,label,title])=><button key={action} type="button" title={title} aria-label={title} onMouseDown={e=>e.preventDefault()} onClick={()=>insert(action)}>{label}</button>)}</div></SourceShadow>{spec.pageControls?.scrollButtons!==false&&<SourceShadow css={spec.css} fixed><div className="fox-elevator-container"><button type="button" className="fox-btn" title="回顶部" aria-label="回顶部" onClick={()=>scroll(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button><button type="button" className="fox-btn" title="去底部" aria-label="去底部" onClick={()=>scroll(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg></button></div></SourceShadow>}</>;
}
