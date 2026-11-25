"use client";
import {publicIslandEmojiUrls,createPublicIslandInsertFeedback,type PublicIslandPaintOptions} from '@/lib/opening/public-island-emoji';
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  validNativeCloudMusic,
  type NativeImageSidebar,
} from "@/lib/opening/native-image-sidebar";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { isolateMufyIslandLocalFonts } from "@/lib/styling/mufy-native-fonts";

const PLAY =
  '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const PAUSE =
  '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const POWER =
  '<svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>';
const POWER_OFF = POWER.replace(
  "</svg>",
  '<line x1="2" y1="2" x2="22" y2="22"/></svg>',
);
/** Known public island shell with native audio, never its parent-injection program. */
function MufyIslandMusic({spec,characterId,onOpenChange,onReplaceComposer}:{spec:NativeImageSidebar;characterId:string;onOpenChange:(open:boolean)=>void;onReplaceComposer?:(text:string)=>void}){
 const host=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),[shadow,setShadow]=useState<ShadowRoot|null>(null),callback=useRef(onOpenChange);callback.current=onOpenChange;
 const replace=useRef(onReplaceComposer);replace.current=onReplaceComposer;
 const pendingCaret=useRef<{input:HTMLTextAreaElement;value:string;caret:number}|null>(null),[caretRevision,setCaretRevision]=useState(0);
 useLayoutEffect(()=>{const pending=pendingCaret.current;pendingCaret.current=null;if(pending?.input.isConnected&&pending.input.value===pending.value){pending.input.focus();pending.input.setSelectionRange(pending.caret,pending.caret);}},[caretRevision]);
 const configKey=JSON.stringify(spec.cloudMusic),config=useMemo(()=>{try{const value:unknown=JSON.parse(configKey??'null');return validNativeCloudMusic(value)&&value.layout==='island'?value:null;}catch{return null;}},[configKey]);
 const html=useMemo(()=>DOMPurify.sanitize(spec.shellHtml,{ALLOWED_TAGS:['div','span','button','svg','path','circle','line','polyline'],ALLOWED_ATTR:['id','class','viewBox','d','fill','stroke','stroke-width','points','cx','cy','r','x1','x2','y1','y2'],ALLOW_DATA_ATTR:false}),[spec.shellHtml]);
 const markup=useMemo(()=>({__html:html}),[html]),fontIsolation=useMemo(()=>isolateMufyIslandLocalFonts(sanitizeAndScopeCss(spec.css,'opening').css,spec.css),[spec.css]),css=fontIsolation.css;
 useEffect(()=>{if(host.current)setShadow(host.current.shadowRoot??host.current.attachShadow({mode:'open'}));},[]);
 useEffect(()=>{
  if(!shadow||!config)return;const scope=shell.current,root=scope?.querySelector<HTMLElement>('#censy-island-container'),audio=scope?.querySelector<HTMLAudioElement>('audio'),buttons=scope?.querySelectorAll<HTMLButtonElement>('.ctrl-btn'),list=scope?.querySelector<HTMLElement>('#exp-playlist'),modeButton=scope?.querySelector<HTMLElement>('#mode-btn-v3'),close=scope?.querySelector<HTMLElement>('.ios-home-bar-wrapper'),mini=scope?.querySelector<HTMLElement>('.island-mini-view'),icon=scope?.querySelector<SVGPathElement>('#icon-play-state-v3'),vis=scope?.querySelector<HTMLElement>('#mini-vis');
  const sourceModeButton=modeButton??scope?.querySelector<HTMLElement>('#mode-btn-v4'),sourceIcon=icon??scope?.querySelector<SVGPathElement>('#icon-play-state-v4');
  if(!scope||!root||!audio||!buttons||buttons.length!==3||!list||!sourceModeButton||!close||!mini||!sourceIcon||!vis)return;
  const [prev,play,next]=Array.from(buttons),modes=config.multiModule?.modeLabels??['列表循环','单曲循环','随机播放'],key=`nj_mufy_island_${characterId}_${config.id}`;let index=0,mode=0,opened=false,active=true,wants=false,pending=false,request=0;
  try{const v:unknown=JSON.parse(window.localStorage.getItem(key)??'null');if(v&&typeof v==='object'){const p=v as {index?:unknown;mode?:unknown};if(typeof p.index==='number'&&Number.isInteger(p.index)&&p.index>=0&&p.index<config.tracks.length)index=p.index;if(typeof p.mode==='number'&&Number.isInteger(p.mode)&&p.mode>=0&&p.mode<3)mode=p.mode;}}catch{}
  const status=(s:string)=>host.current?.setAttribute('data-nj-audio-status',s),save=()=>{try{window.localStorage.setItem(key,JSON.stringify({index,mode}));}catch{}};
  const playing=()=>{pending=false;wants=true;vis.classList.add('playing');sourceIcon.setAttribute('d','M6 19h4V5H6v14zm8-14v14h4V5h-4z');play.setAttribute('aria-label','暂停');play.setAttribute('aria-busy','false');status('playing');};
  const paused=()=>{vis.classList.remove('playing');sourceIcon.setAttribute('d','M8 5v14l11-7z');play.setAttribute('aria-label',pending&&wants?'取消加载':'播放');play.setAttribute('aria-busy',String(pending&&wants));status(pending&&wants?'loading':'paused');};
  const cancel=()=>{wants=false;pending=false;request++;audio.pause();paused();};
  const start=()=>{const id=++request;wants=true;pending=true;paused();const failed=(error:unknown)=>{if(!active||id!==request)return;wants=false;pending=false;paused();status(error instanceof DOMException&&error.name==='NotAllowedError'?'blocked':error instanceof DOMException&&error.name==='AbortError'?'paused':'unavailable');};try{audio.play()?.then(()=>{if(!active||id!==request)return;pending=false;if(!audio.paused)playing();else paused();}).catch(failed);}catch(e){failed(e);}};
  const render=()=>{const track=config.tracks[index];for(const selector of ['#mini-title','#exp-title']){const node=scope.querySelector(selector);if(node)node.textContent=track.title;}const artist=scope.querySelector('#exp-artist');if(artist)artist.textContent=track.artist??'';sourceModeButton.textContent=modes[mode];Array.from(list.children).forEach((node,i)=>node.classList.toggle('active',i===index));save();};
  const select=(n:number,auto=true)=>{cancel();index=(n+config.tracks.length)%config.tracks.length;audio.src=config.tracks[index].src;render();if(auto)start();};
  const setOpen=(value:boolean)=>{opened=value;root.classList.toggle('expanded',value);const panel=scope.querySelector<HTMLElement>('.island-expanded-view');if(panel){panel.inert=!value;panel.setAttribute('aria-hidden',String(!value));}mini.setAttribute('aria-expanded',String(value));mini.tabIndex=value?-1:0;callback.current(value);};
  const bindings:[Element,string,EventListener][]=[];const bind=(el:HTMLElement,fn:()=>void,label:string)=>{el.setAttribute('aria-label',label);el.setAttribute('role','button');el.tabIndex=0;const click:EventListener=e=>{e.stopPropagation();fn();},keyboard:EventListener=e=>{const k=e as KeyboardEvent;if(el.tagName!=='BUTTON'&&(k.key==='Enter'||k.key===' ')){k.preventDefault();fn();}};el.addEventListener('click',click);el.addEventListener('keydown',keyboard);bindings.push([el,'click',click],[el,'keydown',keyboard]);};
  const direction=(delta:number)=>select(mode===2?Math.floor(Math.random()*config.tracks.length):index+delta);
  list.replaceChildren();config.tracks.forEach((track,i)=>{const row=document.createElement('div'),title=document.createElement('span'),artist=document.createElement('span');row.className='plist-item';title.textContent=track.title;artist.textContent=track.artist??'';artist.style.fontSize=config.multiModule?String((config.multiModule as PublicIslandPaintOptions).artistFontSize??11)+'px':'10px';row.append(title,artist);list.append(row);bind(row,()=>select(i),`播放 ${track.title}`);});
  const paint=config.multiModule as (NonNullable<typeof config.multiModule>&PublicIslandPaintOptions)|undefined;
  const insertFeedback=createPublicIslandInsertFeedback(paint?.insertFeedback??false);
  const insertComposerText=(text:string)=>{if(!replace.current)return;const input=document.getElementById('nj_chat_input_textarea');if(input instanceof HTMLTextAreaElement){const start=input.selectionStart,end=input.selectionEnd,value=input.value.slice(0,start)+text+input.value.slice(end);pendingCaret.current={input,value,caret:start+text.length};replace.current(value);setCaretRevision(n=>n+1);}else replace.current(text);};
  if(config.multiModule){
    const tabs=Array.from(root.querySelectorAll<HTMLElement>('.island-tab')),modules=Array.from(root.querySelectorAll<HTMLElement>('.island-module')),commands=root.querySelector<HTMLElement>('#cmd-list');
    const selectTab=(n:number)=>{tabs.forEach((t,i)=>{t.classList.toggle('active',i===n);t.setAttribute('aria-selected',String(i===n));});modules.forEach((m,i)=>{m.classList.toggle('active',i===n);m.style.display=i===n?'flex':'none';m.inert=i!==n;m.setAttribute('aria-hidden',String(i!==n));});};
    if(tabs.length===3&&modules.length===3&&commands){
      const emojiUrls=publicIslandEmojiUrls((config.multiModule as {emojis?:unknown}).emojis),emojiGrid=root.querySelector<HTMLElement>('#emoji-grid');
      if(emojiUrls&&emojiGrid){emojiGrid.replaceChildren();emojiUrls.forEach((url,index)=>{const image=document.createElement('img');image.src=url;image.className='emoji-item';image.alt='表情 '+(index+1);image.draggable=false;image.setAttribute('aria-disabled',String(!replace.current));emojiGrid.append(image);bind(image,()=>{insertComposerText(url);if(replace.current)insertFeedback.flash(image);},'填入表情 '+(index+1));});}
      tabs.forEach((t,i)=>bind(t,()=>selectTab(i),t.textContent??''));selectTab(0);commands.replaceChildren();
      for(const command of config.multiModule.commands){const row=document.createElement('div'),title=document.createElement('div'),content=document.createElement('div');row.className='cmd-item';title.className='cmd-title';content.className='cmd-content';title.textContent=command.title;content.textContent=command.content;row.append(title,content);commands.append(row);row.setAttribute('aria-disabled',String(!replace.current));bind(row,()=>{insertComposerText(command.content);if(replace.current)insertFeedback.flash(row);},`填入 ${command.title}`);}
    }
  }
  bind(mini,()=>setOpen(true),'音乐浮窗');bind(close,()=>setOpen(false),'收起音乐');bind(prev,()=>direction(-1),'上一首');bind(next,()=>direction(1),'下一首');bind(play,()=>wants||!audio.paused?cancel():start(),'播放');bind(sourceModeButton,()=>{mode=(mode+1)%3;render();},'切换播放模式');
  const onPause=()=>{if(!pending)wants=false;paused();},onEnded=()=>mode===1?select(index):direction(1),onError=()=>{wants=false;pending=false;request++;paused();status('unavailable');};
  const media:[string,EventListener][]=[['playing',playing],['pause',onPause],['ended',onEnded],['error',onError]];for(const[event,fn]of media)audio.addEventListener(event,fn);
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&opened){setOpen(false);mini.focus();}};
  // 凛锋's source island stays expanded while the player uses the chat composer.
  const outside=(e:Event)=>{
    if(config.id==='rank59-island-v4')return;
    if(opened&&host.current&&!e.composedPath().includes(host.current))setOpen(false);
  };
  document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);
  setOpen(false);select(index,false);
  return()=>{insertFeedback.dispose();active=false;request++;for(const[el,event,fn]of bindings)el.removeEventListener(event,fn);for(const[event,fn]of media)audio.removeEventListener(event,fn);document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);audio.pause();audio.removeAttribute('src');audio.load();callback.current(false);};
 },[shadow,html,config,characterId]);
 if(!config)return null;
 return <div ref={host} data-nj-island-music className="nj_floating_widget pointer-events-none fixed inset-0 z-[45]">{fontIsolation.localFontFaces&&<style data-nj-source-local-font>{fontIsolation.localFontFaces}</style>}{shadow&&createPortal(<div data-character-css="opening"><style>{css+`:host{all:initial;display:block;width:100%;height:100%}*,*::before,*::after{box-sizing:border-box}#censy-island-container{position:fixed!important;top:65px!important;left:50%!important;transform:translateX(-50%)!important;pointer-events:auto!important;max-width:calc(100vw - 24px);${config.multiModule?'line-height:'+config.lineHeight+';':''}}.island-mini-view{pointer-events:auto!important}.expanded .island-mini-view{pointer-events:none!important}button:focus-visible,[role=button]:focus-visible{outline:2px solid currentColor;outline-offset:2px}.island-mini-view:focus-visible{outline-offset:-3px}`}</style><div ref={shell}><div dangerouslySetInnerHTML={markup}/><audio preload="none"/></div></div>,shadow)}</div>;
}
/** Public static shell, original assets, native audio. No captured JS/iframe. */
export function MufyCloudMusic(props:{spec:NativeImageSidebar;characterId:string;onOpenChange:(open:boolean)=>void;onReplaceComposer?:(text:string)=>void}){
  return props.spec.cloudMusic?.layout==='island'?<MufyIslandMusic {...props}/>:<MufyCloudMusicClassic {...props}/>;
}
function MufyCloudMusicClassic({
  spec,
  characterId,
  onOpenChange,
}: {
  spec: NativeImageSidebar;
  characterId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    [shadow, setShadow] = useState<ShadowRoot | null>(null),
    callback = useRef(onOpenChange);
  callback.current = onOpenChange;
  const configKey = JSON.stringify(spec.cloudMusic),
    config = useMemo(() => {
      try {
        const parsed: unknown = JSON.parse(configKey ?? "null");
        return validNativeCloudMusic(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }, [configKey]);
  const html = useMemo(
    () =>
      DOMPurify.sanitize(spec.shellHtml, {
        ALLOWED_TAGS: [
          "div",
          "span",
          "img",
          "button",
          "audio",
          "svg",
          "path",
          "polygon",
          "polyline",
          "line",
          "rect",
        ],
        ALLOWED_ATTR: [
          "id",
          "class",
          "src",
          "alt",
          "title",
          "viewBox",
          "d",
          "fill",
          "stroke",
          "stroke-width",
          "stroke-linecap",
          "stroke-linejoin",
          "points",
          "x1",
          "x2",
          "y1",
          "y2",
          "x",
          "y",
          "width",
          "height",
          "rx",
          "type",
        ],
        ALLOW_DATA_ATTR: false,
      }),
    [spec.shellHtml],
  );
  const markup = useMemo(() => ({ __html: html }), [html]),
    css = useMemo(
      () => sanitizeAndScopeCss(spec.css, "opening").css,
      [spec.css],
    );
  useEffect(() => {
    if (host.current)
      setShadow(
        host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" }),
      );
  }, []);
  useEffect(() => {
    if (!shadow || !config) return;
    const scope = shell.current,
      wrapper = scope?.querySelector<HTMLElement>("#wrapper"),
      trigger = scope?.querySelector<HTMLElement>("#trigger"),
      panel = scope?.querySelector<HTMLElement>("#panel"),
      audio = scope?.querySelector<HTMLAudioElement>("#audio"),
      play = scope?.querySelector<HTMLElement>("#playBtn"),
      prev = scope?.querySelector<HTMLElement>("#prevBtn"),
      next = scope?.querySelector<HTMLElement>("#nextBtn"),
      power = scope?.querySelector<HTMLElement>("#powerBtn"),
      cover = scope?.querySelector<HTMLElement>("#cover"),
      bar = scope?.querySelector<HTMLElement>("#bar"),
      title = scope?.querySelector<HTMLElement>("#songTitle"),
      top = scope?.querySelector<HTMLElement>("#btn-top"),
      bottom = scope?.querySelector<HTMLElement>("#btn-bottom");
    if (
      !wrapper ||
      !trigger ||
      !panel ||
      !audio ||
      !play ||
      !prev ||
      !next ||
      !power ||
      !cover ||
      !bar ||
      !title ||
      !top ||
      !bottom
    )
      return;
    let index = 0,
      opened = false,
      active = true,
      wantsPlay = false,
      pending = false,
      playRequest = 0,
      disabled = config.initialDisabled;
    const storageKey = `nj_mufy_cloud_disabled_${characterId}_${config.id}`;
    try {
      const own = window.localStorage.getItem(storageKey);
      if (own === "true" || own === "false") disabled = own === "true";
    } catch {}
    const status = (value: string) =>
      host.current?.setAttribute("data-nj-audio-status", value);
    const powerUi = () => {
      power.classList.toggle("disabled", disabled);
      power.innerHTML = disabled ? POWER_OFF : POWER;
      power.setAttribute("aria-pressed", String(!disabled));
      power.setAttribute(
        "aria-label",
        disabled ? "自动播放已关闭" : "自动播放已开启",
      );
    };
    const playing = () => {
      pending = false;
      wantsPlay = true;
      play.innerHTML = PAUSE;
      play.setAttribute("aria-label", "暂停");
      play.setAttribute("aria-busy", "false");
      cover.style.animationPlayState = "running";
      status("playing");
    };
    const paused = (event?: Event) => {
      if (event && !pending) wantsPlay = false;
      play.innerHTML = PLAY;
      play.setAttribute(
        "aria-label",
        pending && wantsPlay ? "取消加载" : "播放",
      );
      play.setAttribute("aria-busy", String(pending && wantsPlay));
      cover.style.animationPlayState = "paused";
      status(pending && wantsPlay ? "loading" : "paused");
    };
    const cancel = () => {
      wantsPlay = false;
      pending = false;
      playRequest++;
      audio.pause();
      paused();
    };
    const start = () => {
      const request = ++playRequest;
      wantsPlay = true;
      pending = true;
      paused();
      const failed = (error: unknown) => {
        if (!active || request !== playRequest) return;
        wantsPlay = false;
        pending = false;
        paused();
        status(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "blocked"
            : error instanceof DOMException && error.name === "AbortError"
              ? "paused"
              : "unavailable",
        );
      };
      try {
        const p = audio.play();
        p?.then(() => {
          if (!active || request !== playRequest) return;
          pending = false;
          if (!audio.paused) playing();
          else paused();
        }).catch(failed);
      } catch (error) {
        failed(error);
      }
    };
    const show = () => {
      opened = !opened;
      wrapper.classList.toggle("open", opened);
      panel.inert = !opened;
      panel.setAttribute("aria-hidden", String(!opened));
      trigger.setAttribute("aria-expanded", String(opened));
      top.tabIndex = bottom.tabIndex = opened ? 0 : -1;
      top.setAttribute("aria-hidden", String(!opened));
      bottom.setAttribute("aria-hidden", String(!opened));
      callback.current(opened);
    };
    const load = (direction: number, forcePlay = false) => {
      const wasPlaying = forcePlay || wantsPlay || !audio.paused;
      cancel();
      index = (index + direction + config.tracks.length) % config.tracks.length;
      audio.src = config.tracks[index].src;
      title.textContent = config.tracks[index].title;
      bar.style.width = "0%";
      paused();
      if (wasPlaying) start();
    };
    const onPlay = () => (wantsPlay || !audio.paused ? cancel() : start()),
      onPrev = () => load(-1),
      onNext = () => load(1),
      onPower = () => {
        disabled = !disabled;
        powerUi();
        try {
          window.localStorage.setItem(storageKey, String(disabled));
        } catch {}
        if (disabled && (wantsPlay || !audio.paused)) cancel();
      };
    const onEnded = () => load(1, true);
    const onTime = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0)
        bar.style.width =
          Math.max(
            0,
            Math.min(100, (audio.currentTime / audio.duration) * 100),
          ) + "%";
    };
    const onError = () => {
      wantsPlay = false;
      pending = false;
      playRequest++;
      paused();
      status("unavailable");
    };
    const edge = (end: boolean) => {
      const messages = document.getElementById("nj_chat_messages");
      messages?.scrollTo({
        top: end ? messages.scrollHeight : 0,
        behavior: "smooth",
      });
    };
    const onTop = () => edge(false),
      onBottom = () => edge(true);
    const bindings: [HTMLElement, string, EventListener][] = [];
    const bind = (element: HTMLElement, fn: () => void) => {
      element.setAttribute("role", "button");
      element.tabIndex = 0;
      const click: EventListener = () => fn(),
        key: EventListener = (e) => {
          const event = e as KeyboardEvent;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fn();
          }
        };
      element.addEventListener("click", click);
      bindings.push([element, "click", click]);
      if (element.tagName !== "BUTTON") {
        element.addEventListener("keydown", key);
        bindings.push([element, "keydown", key]);
      }
    };
    bind(trigger, show);
    bind(play, onPlay);
    bind(prev, onPrev);
    bind(next, onNext);
    bind(power, onPower);
    bind(top, onTop);
    bind(bottom, onBottom);
    const mediaBindings: [string, EventListener][] = [
      ["play", playing],
      ["pause", paused],
      ["ended", onEnded],
      ["timeupdate", onTime],
      ["error", onError],
    ];
    for (const [event, fn] of mediaBindings) audio.addEventListener(event, fn);
    wrapper.classList.remove("open");
    panel.inert = true;
    panel.setAttribute("aria-hidden", "true");
    top.tabIndex = bottom.tabIndex = -1;
    top.setAttribute("aria-hidden", "true");
    bottom.setAttribute("aria-hidden", "true");
    title.textContent = config.tracks[0].title;
    bar.style.width = "0%";
    paused();
    powerUi();
    trigger.setAttribute("aria-label", "音乐浮窗");
    trigger.setAttribute("aria-expanded", "false");
    prev.setAttribute("aria-label", "上一首");
    next.setAttribute("aria-label", "下一首");
    if (audio.getAttribute("src") !== config.tracks[0].src)
      audio.setAttribute("src", config.tracks[0].src);
    if (!disabled) start();
    return () => {
      active = false;
      for (const [element, event, fn] of bindings)
        element.removeEventListener(event, fn);
      for (const [event, fn] of mediaBindings)
        audio.removeEventListener(event, fn);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      callback.current(false);
    };
  }, [shadow, html, config, characterId]);
  if (!config) return null;
  return (
    <div
      ref={host}
      data-nj-cloud-music
      className="nj_floating_widget pointer-events-none fixed inset-0 z-[45]"
    >
      {shadow &&
        createPortal(
          <div
            data-character-css="opening"
            style={{ fontSize: 16, lineHeight: config.lineHeight }}
          >
            <style>
              {css +
                `:host{all:initial;display:block;width:100%;height:100%}*,*::before,*::after{box-sizing:border-box}[data-character-css="opening"]{width:100%;height:100%}#wrapper{position:absolute!important;inset:0!important;width:100%;height:100%;pointer-events:none!important}.trigger-btn{pointer-events:auto!important}.panel{pointer-events:none!important}#wrapper.open .panel,#wrapper.open .nav-btn{pointer-events:auto!important}.nav-btn{pointer-events:none!important}button:focus-visible,[role=button]:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}
            </style>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inert allowlisted public shell, no author script/event/style attributes. */}
            <div ref={shell} dangerouslySetInnerHTML={markup} />
          </div>,
          shadow,
        )}
    </div>
  );
}
