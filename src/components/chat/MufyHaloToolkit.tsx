"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import DOMPurify from 'isomorphic-dompurify';
import {sanitizeAndScopeCss} from '@/lib/styling/whitelist';
import {validHaloToolkit,type HaloToolkitData,type HaloCommandState} from '@/lib/opening/halo-toolkit';
import {bindHaloCommands} from './mufy-halo-commands';
import {bindHaloDrawing} from './mufy-halo-drawing';

/** Inert public shell + finite native actions. No source JS, iframe or send API. */
export function MufyHaloToolkit({data,scope=data.id,onFillComposer,onOpenChange,onCommandChange}:{data:HaloToolkitData;scope?:string;onFillComposer:(text:string)=>void;onOpenChange:(open:boolean)=>void;onCommandChange?:(state:HaloCommandState|null)=>void}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),[shadow,setShadow]=useState<ShadowRoot|null>(null);
 const fill=useRef(onFillComposer),notify=useRef(onOpenChange),commandChange=useRef(onCommandChange);fill.current=onFillComposer;notify.current=onOpenChange;commandChange.current=onCommandChange;
 const valid=validHaloToolkit(data),key=valid?JSON.stringify(data):'';
 const markup=useMemo(()=>({__html:valid?DOMPurify.sanitize(data.shellHtml,{ALLOWED_TAGS:['div','span','input','svg','path','circle','line','polyline','canvas','audio'],ALLOWED_ATTR:['id','class','type','accept','title','value','min','max','step','viewBox','d','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','cx','cy','r','x1','x2','y1','y2','points','width','height','data-halo-action'],ALLOW_DATA_ATTR:false}):''}),[key]);
 const css=useMemo(()=>valid?sanitizeAndScopeCss(data.css,'opening').css:'',[key]);
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  const root=shell.current;if(!shadow||!root||!valid)return;
  const q=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>('#'+id);
  const ball=q('censy-tk-ball'),panel=q('censy-tk-panel'),audio=q<HTMLAudioElement>('censy-music-player');if(!ball||!panel||!audio)return;
  const bindings:[EventTarget,string,EventListener][]=[];
  const listen=(el:EventTarget|null,event:string,fn:EventListener)=>{if(el){el.addEventListener(event,fn);bindings.push([el,event,fn]);}};
  const button=(el:HTMLElement,label:string,fn:()=>void)=>{el.setAttribute('role','button');el.setAttribute('aria-label',label);el.tabIndex=0;listen(el,'click',fn);listen(el,'keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();fn();}});};
  let opened=false,track=0,loop=false,playing=false,pending=false,generation=0,destroyed=false;
  const objectUrls=new Set<string>(),playlist=data.tracks.map(t=>({...t}));
  const fmt=(sec:number)=>Number.isFinite(sec)?`${Math.floor(sec/60).toString().padStart(2,'0')}:${Math.floor(sec%60).toString().padStart(2,'0')}`:'00:00';
  const setOpen=(value:boolean)=>{opened=value;panel.style.display=value?'flex':'none';panel.inert=!value;panel.setAttribute('aria-hidden',String(!value));ball.classList.toggle('censy-tk-active',value);ball.setAttribute('aria-expanded',String(value));notify.current(value);};
  const overlayIds=['censy-drown-emo-overlay','censy-drown-cmd-overlay','censy-drown-qr-overlay'];
  const closeOverlay=()=>{for(const id of overlayIds){const el=q(id);if(el){el.style.display='none';el.inert=true;}}notify.current(opened);};
  const showOverlay=(id:string)=>{setOpen(false);closeOverlay();const el=q(id);if(el){el.style.display='flex';el.inert=false;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');notify.current(true);el.querySelector<HTMLElement>('[role=button],button,input')?.focus();}};
  const setPlaying=(value:boolean)=>{playing=value;const play=q('censy-icon-play'),pause=q('censy-icon-pause');if(play)play.style.display=value?'none':'block';if(pause)pause.style.display=value?'block':'none';q('censy-music-play-btn')?.setAttribute('aria-pressed',String(value));q('censy-music-play-btn')?.setAttribute('aria-label',value?'暂停':'播放/暂停');};
  const status=q('censy-music-title');if(status){status.setAttribute('aria-live','polite');}
  const fail=()=>{pending=false;setPlaying(false);q('censy-music-play-btn')?.setAttribute('aria-label','音频无法加载，点击重试');};
  const play=async()=>{const request=++generation;pending=true;q('censy-music-play-btn')?.setAttribute('aria-label','正在加载，点击取消');try{await audio.play();if(destroyed||request!==generation)return;pending=false;setPlaying(!audio.paused);}catch{if(!destroyed&&request===generation)fail();}};
  const renderPlaylist=()=>{const list=q('censy-music-dropdown');if(!list)return;for(let i=bindings.length-1;i>=0;i--){const[el,event,fn]=bindings[i];if(el instanceof window.Node&&list.contains(el)){el.removeEventListener(event,fn);bindings.splice(i,1);}}list.replaceChildren();playlist.forEach((song,i)=>{const item=document.createElement('div');item.className='censy-music-list-item'+(track===i?' active':'');item.textContent=song.name;button(item,song.name,()=>{load(i);void play();list.style.display='none';});list.append(item);});};
  const load=(index:number)=>{++generation;pending=false;audio.pause();track=(index+playlist.length)%playlist.length;audio.src=playlist[track].src;setPlaying(false);if(status)status.textContent=playlist[track].name;const range=q<HTMLInputElement>('censy-music-range');if(range)range.value='0';const cur=q('censy-music-cur');if(cur)cur.textContent='00:00';renderPlaylist();};
  listen(audio,'playing',()=>{pending=false;setPlaying(true);});listen(audio,'pause',()=>setPlaying(false));listen(audio,'error',fail);
  const time=()=>{const cur=q('censy-music-cur'),dur=q('censy-music-dur'),range=q<HTMLInputElement>('censy-music-range');if(cur)cur.textContent=fmt(audio.currentTime);if(dur)dur.textContent=fmt(audio.duration);if(range)range.value=Number.isFinite(audio.duration)&&audio.duration>0?String(audio.currentTime/audio.duration*100):'0';};
  listen(audio,'timeupdate',time);listen(audio,'loadedmetadata',time);listen(audio,'ended',()=>{load(loop?track:track+1);void play();});
  listen(q('censy-music-range'),'input',()=>{const value=Number(q<HTMLInputElement>('censy-music-range')?.value);if(Number.isFinite(audio.duration)&&audio.duration>0&&Number.isFinite(value))audio.currentTime=Math.max(0,Math.min(100,value))/100*audio.duration;});
  const musicUpload=q<HTMLInputElement>('censy-music-upload');listen(musicUpload,'change',()=>{const file=musicUpload?.files?.[0];if(!file||!file.type.startsWith('audio/')||file.size>30*1024*1024||playlist.length>=30){if(status)status.title='本地音频需小于30MB，歌单最多30首。';return;}const url=URL.createObjectURL(file);objectUrls.add(url);playlist.push({name:file.name.slice(0,200),src:url});load(playlist.length-1);void play();if(musicUpload)musicUpload.value='';});
  for(const n of [1,2]){const upload=q<HTMLInputElement>('censy-avatar-upload-'+n),avatar=q('censy-avatar-'+n),avatarKey='nj_halo_avatar_'+encodeURIComponent(scope)+'_'+data.id+'_'+n;
   try{const saved=window.localStorage.getItem(avatarKey);if(saved&&saved.length<=750000&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(saved)&&avatar)avatar.style.backgroundImage=`url("${saved}")`;}catch{/* Only own scoped image preference; no source storage. */}
   listen(upload,'change',()=>{const file=upload?.files?.[0];if(!file||!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>5*1024*1024)return;const url=URL.createObjectURL(file);objectUrls.add(url);if(avatar)avatar.style.backgroundImage=`url("${url}")`;
    const reader=new FileReader();reader.onload=()=>{if(destroyed||typeof reader.result!=='string'||!avatar)return;if(reader.result.length>750000){avatar.title='头像已更换；图片过大，仅当前页面保留。';return;}try{window.localStorage.setItem(avatarKey,reader.result);avatar.title='点击更换头像';}catch{avatar.title='头像已更换；浏览器无法保存，仅当前页面保留。';}};reader.readAsDataURL(file);if(upload)upload.value='';
   });}
  const grid=q('censy-emo-grid');if(grid){grid.replaceChildren();for(const e of data.emojis){const item=document.createElement('div');item.className='censy-emo-item';item.style.backgroundImage=`url("${e.url}")`;button(item,e.short,()=>{fill.current(`![${e.short}](${e.url})`);closeOverlay();ball.focus();});grid.append(item);}}
  const commands=bindHaloCommands(root,data,scope,text=>fill.current(text),value=>commandChange.current?.(value));
  const drawing=bindHaloDrawing(root,value=>{if(value){setOpen(false);closeOverlay();}notify.current(value||opened);});
  const bossKey='nj_halo_boss_'+encodeURIComponent(scope)+'_'+data.id;
  let category='其他';try{const saved=window.localStorage.getItem(bossKey);if(saved&&data.bossSites&&Object.hasOwn(data.bossSites,saved))category=saved;}catch{/* Own preference unavailable. */}
  const bossLink=document.createElement('a');bossLink.target='_blank';bossLink.rel='noopener noreferrer';bossLink.referrerPolicy='no-referrer';bossLink.hidden=true;root.append(bossLink);
  const bossLabel=q('censy-drown-boss-label');if(bossLabel)bossLabel.textContent=category;
  const syncBossLabel=()=>{const el=root.querySelector<HTMLElement>('[data-halo-action="censyBossGo()"]');if(el)el.setAttribute('aria-label',el.textContent?.trim()||'老板模式');};
  const bossDropdown=q('censy-drown-boss-dropdown');if(bossDropdown&&data.bossSites){bossDropdown.replaceChildren();for(const name of Object.keys(data.bossSites)){const b=document.createElement('button');b.type='button';b.className='censy-drown-boss-opt';b.textContent=name;listen(b,'click',()=>{category=name;if(bossLabel)bossLabel.textContent=name;syncBossLabel();for(const option of bossDropdown.querySelectorAll('button')){const selected=option===b;option.classList.toggle('censy-drown-active',selected);option.setAttribute('aria-pressed',String(selected));}try{window.localStorage.setItem(bossKey,name);}catch{/* Retain page selection. */}bossDropdown.style.display='none';});b.classList.toggle('censy-drown-active',name===category);b.setAttribute('aria-pressed',String(name===category));bossDropdown.append(b);}bossDropdown.style.display='none';}
  const actions:Record<string,()=>void>={
   'censyTogglePanel()':()=>setOpen(!opened),
   'censyMusicToggle()':()=>{if(playing||pending){++generation;pending=false;audio.pause();setPlaying(false);}else void play();},
   'censyMusicPrev()':()=>{load(track-1);void play();},'censyMusicNext()':()=>{load(track+1);void play();},
   'censyMusicToggleList()':()=>{const list=q('censy-music-dropdown');if(list)list.style.display=list.style.display==='block'?'none':'block';},
   'censyMusicToggleLoop()':()=>{loop=!loop;const one=q('censy-icon-loop-one'),all=q('censy-icon-loop-list');if(one)one.style.display=loop?'block':'none';if(all)all.style.display=loop?'none':'block';const el=q('censy-music-loop-btn');el?.setAttribute('title',loop?'单曲循环':'列表循环');el?.setAttribute('aria-label',loop?'单曲循环':'列表循环');el?.setAttribute('aria-pressed',String(loop));},
   'censyTriggerMusicUpload()':()=>musicUpload?.click(),
   'censyTriggerAvatarUpload(1)':()=>q<HTMLInputElement>('censy-avatar-upload-1')?.click(),
   'censyTriggerAvatarUpload(2)':()=>q<HTMLInputElement>('censy-avatar-upload-2')?.click(),
   'censyEmoOpen()':()=>showOverlay('censy-drown-emo-overlay'),
   'censyDrownCmdOpen()':()=>showOverlay('censy-drown-cmd-overlay'),
   'censyDrownQR_Open()':()=>showOverlay('censy-drown-qr-overlay'),
   'censyBossGo()':()=>{const pool=data.bossSites&&Object.hasOwn(data.bossSites,category)?data.bossSites[category]:null;if(!Array.isArray(pool)||!pool.length)return;const url=pool[Math.floor(Math.random()*pool.length)];if(new URL(url).protocol!=='https:')return;bossLink.href=url;bossLink.click();},
   'censyBossToggleCfg(event)':()=>{if(bossDropdown)bossDropdown.style.display=bossDropdown.style.display==='block'?'none':'block';},
   "censyScrollTo('top')":()=>document.getElementById('nj_chat_messages')?.scrollTo({top:0,behavior:'smooth'}),
   "censyScrollTo('bottom')":()=>{const chat=document.getElementById('nj_chat_messages');chat?.scrollTo({top:chat.scrollHeight,behavior:'smooth'});},
   'censyDrownCmdClose()':()=>{commands.closeForm();closeOverlay();},'censyEmoClose(null, true)':closeOverlay,'censyDrownQR_Close(null, true)':closeOverlay,
   'censyEmoClose(event)':closeOverlay,'censyDrownQR_Close(event)':closeOverlay,
   ...commands.actions,...drawing.actions,
  };
  for(const el of root.querySelectorAll<HTMLElement>('[data-halo-action]')){if(overlayIds.includes(el.id))continue;const action=el.getAttribute('data-halo-action')!,fn=actions[action];if(fn)button(el,el.getAttribute('title')||el.textContent?.trim()||action,fn);else{el.setAttribute('aria-disabled','true');el.title=(el.title?el.title+' · ':'')+'适配待完成';}}
  for(const id of ['censy-drown-emo-close','censy-drown-qr-close']){const el=q(id);if(el)button(el,'关闭面板',()=>{closeOverlay();ball.focus();});}
  listen(document,'keydown',e=>{if((e as KeyboardEvent).key==='Escape'){commands.closeForm();drawing.toggle(false);closeOverlay();setOpen(false);ball.focus();}});
  listen(document,'pointerdown',e=>{if(host.current&&!e.composedPath().includes(host.current)){closeOverlay();setOpen(false);}});
  for(const id of overlayIds)listen(q(id),'click',e=>{if(e.target===q(id)){closeOverlay();ball.focus();}});
  audio.preload='none';
  const dropdown=q('censy-music-dropdown');if(dropdown)dropdown.style.display='none';
  setOpen(false);closeOverlay();load(0);
  return()=>{destroyed=true;++generation;commands.dispose();drawing.dispose();bossLink.remove();audio.pause();audio.removeAttribute('src');for(const [el,event,fn]of bindings)el.removeEventListener(event,fn);for(const url of objectUrls)URL.revokeObjectURL(url);notify.current(false);};
 },[shadow,key,scope]);
 if(!valid)return null;
 return <div ref={host} data-nj-halo-toolkit={data.id} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:44}}>{shadow&&createPortal(<div data-character-css="opening" style={{font:'16px/1.5 ui-sans-serif,system-ui,sans-serif'}}><style>{css+`
 *,*::before,*::after{box-sizing:border-box}svg{display:block;vertical-align:middle}button,input{font:inherit;color:inherit}button{cursor:pointer}
 #censy-tk-ball{position:fixed!important;bottom:90px!important;right:18px!important;width:38px!important;height:38px!important;pointer-events:auto!important}
 #censy-tk-panel{position:fixed!important;right:18px!important;bottom:142px!important;width:268px!important;max-width:calc(100vw - 36px)!important;max-height:min(500px,calc(100dvh - 158px))!important;pointer-events:auto!important}
 #censy-drown-emo-overlay,#censy-drown-cmd-overlay,#censy-drown-qr-overlay{position:fixed!important;inset:0!important;pointer-events:auto!important;z-index:50}
 #censy-drown-emo-box,#censy-drown-cmd-box,#censy-drown-qr-box{max-width:calc(100vw - 24px)!important;max-height:calc(100dvh - 32px)!important;overflow:auto}
 #censy-music-dropdown{position:absolute;z-index:5}#censy-drown-island,#censy-drown-canvas{display:none!important}
 [data-halo-drawing=true] #censy-drown-canvas{display:block!important;position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;pointer-events:auto!important;touch-action:none;z-index:60}
 [data-halo-drawing=true] #censy-drown-island{display:flex!important;position:fixed!important;width:max-content!important;max-width:calc(100vw - 16px);overflow-x:auto;pointer-events:auto!important;z-index:61}
 @media(max-width:480px){[data-halo-drawing=true] #censy-drown-island{flex-wrap:wrap;justify-content:center;overflow:visible!important;height:auto!important;padding-block:4px;row-gap:2px}}
 .censy-drown-color{padding:0}#censy-drown-picker{display:none!important}
 .nj_halo_drawing_background{position:fixed;inset:0;background-color:var(--bg-base,#0b1220);background-position:center;background-size:cover;z-index:59;pointer-events:none}.nj_halo_drawing_background[hidden]{display:none}
 #censy-drown-grip{touch-action:none}#censy-drown-cmd-addform input,#censy-drown-cmd-addform textarea,#censy-drown-cmd-addform select{font-size:16px;max-width:100%;box-sizing:border-box}#censy-drown-cmd-addform textarea{min-height:80px;width:100%;resize:vertical}
 .censy-drown-cmd-row button{background:transparent;border:0;min-width:0;overflow-wrap:anywhere}.censy-drown-cmd-label{text-align:left}.nj_halo_command_status{font-size:12px;overflow-wrap:anywhere}.nj_halo_command_undo{background:transparent;color:inherit;border:1px solid currentColor;border-radius:6px;padding:6px}
 #censy-tk-ball:focus-visible,[role=button]:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid currentColor;outline-offset:2px}
 [aria-disabled=true]{opacity:.5;cursor:not-allowed}.nj-halo-command-group{width:100%;text-align:left;padding:10px;border:0;border-bottom:1px solid rgba(255,255,255,.2);background:transparent}.nj-halo-command-item{padding:8px;cursor:pointer}.nj-halo-command-item:hover{background:rgba(255,255,255,.1)}
 `}</style><div ref={shell} dangerouslySetInnerHTML={markup}/></div>,shadow)}</div>;
}
