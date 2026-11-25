"use client";
import {winterMusicBox,WINTER_MUSIC_COORDINATES} from "@/lib/opening/winter-music-v9";
import type {HostSendHandler} from "@/lib/opening/host-composer-send-candidate";

import {censyMusicDetailsBox,CENSY_MUSIC_DETAILS_COORDINATES} from '@/lib/opening/censy-music-details';
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  RegexIframe,
  type HostCharacterMeta,
  type HostHistoryEntry,
} from "@/components/regex/RegexIframe";
import { safeNativeTriggerForeground, type NativeImageSidebar } from "@/lib/opening/native-image-sidebar";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import {mufyFixedCanvasBoundary} from '@/lib/opening/content';
import {hasPublicHubCommandCopy} from '@/lib/regex/iframe-bridge';
import {insMusicTriggerTop,insMusicDocumentPresentation} from '@/lib/opening/native-ins-presentation';
import type {ComposerFillOptions} from '@/lib/opening/composer-fill';
import {nativePlayerDocumentPresentation} from '@/lib/opening/native-player-presentation';
import {nativeSourceBoxStyle,nativeSourceBoxCss} from '@/lib/opening/native-source-box';

interface Props {
  spec: NativeImageSidebar;
  widgetKey: string;
  character: HostCharacterMeta;
  history?: HostHistoryEntry[];
  userName: string;
  onSendMessage: HostSendHandler;
  onFillComposer?: (text: string,options?:ComposerFillOptions) => void;
  onOpenChange: (open: boolean) => void;
}

// Geometry only. Authored colors, typography, image and decorations come from
// the captured source CSS; no platform chrome or token palette enters here.
const COORDINATES = `:host{all:initial;display:block;width:100%;height:100%}
[data-character-css="opening"]{width:100%;height:100%}
[data-character-css="opening"] .mufy-side-r{position:relative!important;right:0!important;top:0!important;width:100%;height:100%;margin:0!important}
[data-character-css="opening"] .mufy-side-btn{position:absolute;right:1px;top:0;width:60px;height:60px}
[data-character-css="opening"] .mufy-side-icon{width:48px;height:48px;object-fit:cover}
[data-character-css="opening"] .mufy-side-panel{position:absolute;right:6px;top:0!important;width:min(320px,calc(100vw - 6px));height:min(380px,84dvh)}
[data-character-css="opening"] .mufy-side-inner{height:100%;overflow-y:auto}
[data-character-css="opening"] .mufy-side-border-deco,[data-character-css="opening"] .mufy-snow-layer{pointer-events:none}
[data-character-css="opening"] summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}
[data-character-css="opening"] .mufy-side-r:not([open]) .mufy-side-panel{display:none!important}
[data-character-css="opening"] .mufy-side-r[open] .mufy-side-panel{display:block}
[data-nj-native-documents]>div{padding:8px 0;width:100%;box-sizing:border-box}
[data-nj-native-documents] iframe{display:block;width:100%;border:0}`;

// Source-observed music drawer: 32px trigger, 300px panel, 45px gap and
// 33px upward offset. The shell remains inert; its program stays opaque.
const MUSIC_COORDINATES = `:host{all:initial;display:block;width:100%;height:100%}
[data-character-css="opening"]{width:100%;height:100%}
[data-character-css="opening"] details.glass-music-sidebar{position:absolute!important;top:33px!important;right:0!important;margin:0!important}
[data-character-css="opening"] .glass-trigger{width:32px!important;height:32px!important;box-sizing:border-box}
[data-character-css="opening"] .glass-panel{right:45px!important;top:-33px!important;width:min(300px,calc(100vw - 57px))!important;max-height:80dvh;overflow-y:auto}
[data-character-css="opening"] summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}
[data-character-css="opening"] details:not([open]) .glass-panel{display:none!important}
[data-nj-native-documents]>div{padding:8px 0;width:100%;box-sizing:border-box}
[data-nj-native-documents] iframe{display:block;width:100%;border:0}`;

const PIXEL_MUSIC_COORDINATES = `:host{all:initial;display:block;width:100%;height:100%}
[data-character-css="opening"]{width:100%;height:100%}
[data-character-css="opening"] details.sidebar-music-box{position:absolute!important;right:0!important;top:0!important;transform:none!important;margin:0!important;box-sizing:border-box!important}
[data-character-css="opening"] details.sidebar-music-box:not([open]){width:30px;height:30px}
[data-character-css="opening"] details.sidebar-music-box[open]{width:320px!important;height:450px!important}
[data-character-css="opening"] details.sidebar-music-box>summary{box-sizing:border-box;width:30px;height:30px;pointer-events:auto}
[data-character-css="opening"] details.sidebar-music-box[open] .content-fixed-area{pointer-events:auto}
[data-character-css="opening"] details.sidebar-music-box:not([open]) .content-fixed-area{display:none!important}
[data-nj-native-documents]>div{padding:8px 0;width:100%;box-sizing:border-box}
[data-nj-native-documents] iframe{display:block;width:100%;border:0}`;

const BLACK_FOCUS_COORDINATES = `:host{all:initial;display:block;width:100%;height:100%}
[data-character-css="opening"] .midnight-black-trigger{position:fixed!important;right:10px!important;top:20%!important;width:70px!important;height:70px!important;pointer-events:auto!important;z-index:3!important}
[data-character-css="opening"] .midnight-black-container{position:fixed!important;top:32%!important;z-index:2!important;pointer-events:none!important}
[data-character-css="opening"] .close-mask-black{position:fixed!important;inset:0!important;z-index:1!important;pointer-events:auto;display:none!important}
[data-character-css="opening"][data-nj-native-focus-open="true"] .midnight-black-container{right:60px!important;opacity:1!important;pointer-events:auto!important}
[data-character-css="opening"][data-nj-native-focus-open="false"] .midnight-black-container{right:-400px!important;opacity:0!important;pointer-events:none!important}
[data-character-css="opening"][data-nj-native-focus-open="true"] .close-mask-black{display:block!important}
[data-character-css="opening"] .nj_native_terminal_label{text-align:center;font-size:12px;color:rgb(136,136,136);letter-spacing:1px;margin-bottom:15px}
[data-nj-native-documents]>div{padding:8px 0;width:100%;box-sizing:border-box}
[data-nj-native-documents] iframe{display:block;width:100%;border:0}`;

const INS_MUSIC_COORDINATES=`:host{all:initial;display:block;width:100%;height:100%}
[data-character-css="opening"]{width:100%;height:100%}
[data-character-css="opening"] .ins-music-sidebar{position:relative!important;top:0!important;right:0!important;display:flex;flex-direction:column;align-items:flex-end}
[data-character-css="opening"] .ins-trigger{display:block;list-style:none;width:70px;height:70px;cursor:pointer;pointer-events:auto}
[data-character-css="opening"] .ins-trigger::-webkit-details-marker{display:none}
[data-character-css="opening"] .ins-host-panel{width:min(260px,calc(100vw - 10px));height:380px;margin-top:0;margin-right:10px;pointer-events:auto}
[data-character-css="opening"] details:not([open]) .ins-host-panel{display:none!important}
[data-nj-native-documents]>div{width:100%;height:380px}
[data-nj-native-documents] iframe{display:block;width:100%;height:380px;border:0}`;

// Source Zen player: 46px edge trigger, 340px authored panel scaled to 85%.
// Only geometry/ownership live here; the original palette remains in its frame.
const ZEN_MUSIC_COORDINATES=`:host{all:initial;display:block;width:100%;height:100%}
.zen-trigger{position:fixed;right:20px;top:100px;width:46px;height:46px;list-style:none;cursor:pointer;pointer-events:auto}
.zen-trigger::-webkit-details-marker{display:none}
.zen-trigger img{display:block;width:100%;height:100%;object-fit:contain}
.zen-host-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(289px,calc(100vw - 24px));max-height:68dvh;overflow:auto;border-radius:31px;pointer-events:auto}
.zen-music-sidebar:not([open]) .zen-host-panel{display:none}
.zen-close{position:absolute;right:23px;top:19px;z-index:2;width:22px;height:22px;cursor:pointer;pointer-events:auto}
.zen-close img{width:100%;height:100%}
[data-nj-native-documents]>div{width:100%}
[data-nj-native-documents] iframe{display:block;width:100%;border:0}`;

// The V21 source has a 60px illustrated left trigger and a 280px panel 75px
// from it. Its authored program remains inside one opaque iframe, activated
// only when the user opens the native trigger; no host/source storage bridge.
const STATIC_MUSIC_COORDINATES=`:host{all:initial;display:block;width:100%;height:100%}
.static-music-sidebar{position:fixed;left:0;top:70px;pointer-events:none}
.static-music-trigger{display:block;width:60px;height:60px;list-style:none;cursor:pointer;pointer-events:auto;border-radius:8px}
.static-music-trigger::-webkit-details-marker{display:none}.static-music-trigger img{display:block;width:100%;height:100%;object-fit:contain}
.static-music-panel{position:absolute;left:75px;top:0;width:min(280px,calc(100vw - 83px));max-height:calc(100dvh - 86px);overflow:auto;pointer-events:auto}
.static-music-sidebar:not([open]) .static-music-panel{display:none}
.static-music-trigger:focus-visible{outline:2px solid currentColor;outline-offset:2px}
[data-nj-native-documents]>div{width:100%}[data-nj-native-documents] iframe{display:block;width:100%;border:0}`;

/** The inert drawer shell lives in a shadow root, never an author execution
 * context. Each original program remains a separate ordinary opaque iframe.
 * No nested-frame CSP exception and no author scripts/events in the host DOM. */
export function MufyNativeImageSidebar({
  spec,
  widgetKey,
  onOpenChange,
  ...frameProps
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const isCensyMusicDetails = spec.variant === 'censy-music-details';
  const isWinterMusic = spec.variant === 'winter-music-v9';
  const isMusic = spec.variant === "glass-music";
  const isPixelMusic = spec.variant === "pixel-music";
  const isBlackFocus = spec.variant === "black-focus";
  const isInsMusic = spec.variant === "ins-music";
  const isZenMusic = spec.variant === "zen-music";
  const isStaticMusic = spec.variant === "static-music";
  const shell = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const [mount, setMount] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const onOpen = useRef(onOpenChange);
  onOpen.current = onOpenChange;
  const html = useMemo(
    () =>
      DOMPurify.sanitize(spec.shellHtml, {
        ALLOWED_TAGS: ["details", "summary", "div", "span", "img"],
        ALLOWED_ATTR: [...(isCensyMusicDetails?["id"]:[]), "class", "src", "alt", "tabindex", "data-nj-native-documents"],
        ALLOW_DATA_ATTR: false,
      }),
    [spec.shellHtml,isCensyMusicDetails],
  );
  const css = useMemo(
    () => sanitizeAndScopeCss(spec.css, "opening").css,
    [spec.css],
  );
  const triggerForeground=safeNativeTriggerForeground(spec.triggerForeground);
  const markup = useMemo(() => ({ __html: html }), [html]);
  useEffect(() => {
    const node = host.current;
    if (node) setShadow(node.shadowRoot ?? node.attachShadow({ mode: "open" }));
  }, []);
  useEffect(() => {
    if (!shadow || !html) return;
    const details = shell.current?.querySelector(isWinterMusic ? 'details.censy-winter-music-sidebar' : isCensyMusicDetails ? 'details.censy-music-sidebar-box' : isStaticMusic ? 'details.static-music-sidebar' : isZenMusic ? 'details.zen-music-sidebar' : isInsMusic ? 'details.ins-music-sidebar' : isBlackFocus ? ".midnight-black-container" : isMusic ? "details.glass-music-sidebar" : isPixelMusic ? "details.sidebar-music-box" : "details.mufy-side-r");
    const trigger = shell.current?.querySelector('.midnight-black-trigger');
    const slot = shell.current?.querySelector("[data-nj-native-documents]");
    if (!details || !slot) return;
    setMount(slot);
    if(isBlackFocus){
      const node=host.current,mask=shell.current?.querySelector('.close-mask-black');
      if(!node||!trigger||!mask)return;
      // Native focus styling must not collapse when focus enters an opaque
      // child program or a reply updates its parent. Keep ownership in React;
      // the source trigger/mask and genuine outside focus remain the controls.
      const show=()=>{setOpen(true);setActivated(true);onOpen.current(true);};
      const hide=()=>{setOpen(false);onOpen.current(false);};
      const outsideFocus=(event:FocusEvent)=>{if(event.target&&!node.contains(event.target as Node))hide();};
      trigger.addEventListener('focus',show);trigger.addEventListener('click',show);
      mask.addEventListener('click',hide);document.addEventListener('focusin',outsideFocus);
      return()=>{trigger.removeEventListener('focus',show);trigger.removeEventListener('click',show);mask.removeEventListener('click',hide);document.removeEventListener('focusin',outsideFocus);onOpen.current(false);};
    }
    const report = () => {
      const next = details.hasAttribute("open");
      setOpen(next);
      if (next) setActivated(true);
      onOpen.current(next);
    };
    details.addEventListener("toggle", report);
    const close=shell.current?.querySelector('.zen-close');
    const hideZen=()=>{details.removeAttribute('open');report();};
    const closeKey=(event:Event)=>{const key=(event as KeyboardEvent).key;if(key==='Enter'||key===' '){event.preventDefault();hideZen();}};
    if(isZenMusic){close?.addEventListener('click',hideZen);close?.addEventListener('keydown',closeKey);}
    report();
    return () => {
      details.removeEventListener("toggle", report);
      close?.removeEventListener('click',hideZen);close?.removeEventListener('keydown',closeKey);
      onOpen.current(false);
    };
  }, [shadow, html, isWinterMusic, isCensyMusicDetails, isMusic, isPixelMusic, isBlackFocus, isInsMusic, isZenMusic, isStaticMusic]);
  return (
    <div
      ref={host}
      data-nj-native-image-sidebar
      data-nj-winter-music-v9={isWinterMusic ? "true" : undefined}
      data-nj-censy-music-details={isCensyMusicDetails ? "true" : undefined}
      style={isWinterMusic?winterMusicBox(open):isCensyMusicDetails?censyMusicDetailsBox(open):spec.sourceBox?nativeSourceBoxStyle(spec.sourceBox,open):isInsMusic?{top:insMusicTriggerTop(spec.css)}:undefined}
      className={isWinterMusic || isCensyMusicDetails ? 'nj_floating_widget nj_floating_sidebar pointer-events-none fixed z-[45]' : isZenMusic || isStaticMusic
        ? 'nj_floating_widget nj_floating_sidebar pointer-events-none fixed inset-0 w-screen h-screen z-[45]'
        : isInsMusic
        ? `nj_floating_widget nj_floating_sidebar pointer-events-none fixed right-0 top-[20vh] z-[45] ${open ? 'w-[min(270px,100vw)] h-[458px]' : 'w-[70px] h-[70px]'}`
        : isBlackFocus
        ? 'nj_floating_widget nj_floating_sidebar pointer-events-none fixed inset-0 w-screen h-screen z-[45]'
        : isPixelMusic
        ? `nj_floating_widget nj_floating_sidebar pointer-events-none fixed right-0 top-1/2 -translate-y-1/2 z-[45] ${open ? "w-[360px] h-[450px]" : "w-[30px] h-[30px]"}`
        : isMusic
        ? `nj_floating_widget nj_floating_sidebar pointer-events-none fixed right-3 top-[calc(15vh-33px)] z-[45] ${open ? "w-[min(345px,calc(100vw-24px))] h-[min(500px,80dvh)]" : "w-8 h-[65px]"}`
        : `nj_floating_widget nj_floating_sidebar pointer-events-auto fixed right-0 top-[8vh] z-[45] ${open ? "w-[min(326px,100vw)] h-[min(380px,84dvh)]" : "w-[61px] h-[60px]"}`}
    >
      {shadow &&
        createPortal(
          <div data-character-css="opening" data-nj-native-focus-open={isBlackFocus ? String(open) : undefined}>
            <style>
              {css +
                (isWinterMusic ? WINTER_MUSIC_COORDINATES : isCensyMusicDetails ? CENSY_MUSIC_DETAILS_COORDINATES : isStaticMusic ? STATIC_MUSIC_COORDINATES : isZenMusic ? ZEN_MUSIC_COORDINATES : isInsMusic ? INS_MUSIC_COORDINATES : isBlackFocus ? BLACK_FOCUS_COORDINATES : isPixelMusic ? PIXEL_MUSIC_COORDINATES : isMusic ? MUSIC_COORDINATES + '.glass-trigger,.glass-panel{pointer-events:auto}' : COORDINATES) +
                (spec.sourceBox ? nativeSourceBoxCss(spec.sourceBox) : '') +
                (triggerForeground ? `[data-character-css="opening"] .mufy-side-btn{color:${triggerForeground}}` : '') +
                `[data-nj-native-documents] iframe{border-radius:${spec.framePresentation?.borderRadius ?? 0}px;overflow:auto}`}
            </style>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify allowlist permits inert drawer tags only; scripts/events/styles are excluded. */}
            <div ref={shell} dangerouslySetInnerHTML={markup} />
          </div>,
          shadow,
        )}
      {activated &&
        mount &&
        createPortal(
          spec.documents.map((srcdoc, index) => (
            <div key={`${widgetKey}-${srcdoc}`}>
              <RegexIframe
                {...frameProps}
                ruleId={`native-sidebar-${widgetKey}-${index}`}
                ruleName="opening-sidebar"
                srcdoc={isWinterMusic||isCensyMusicDetails?srcdoc:mufyFixedCanvasBoundary(srcdoc,true)+(isInsMusic?insMusicDocumentPresentation(srcdoc):nativePlayerDocumentPresentation(srcdoc))}
                captureGroups={[]}
                cssScope="opening"
                fixedHeight={isWinterMusic?420:isCensyMusicDetails?480:undefined}
                minHeight={spec.framePresentation?.minHeight ?? 1}
                // This self-contained hub never uses parent DOM handlers.
                // A parent proxy would break authenticated copy-receipt identity.
                inlineParentShim={!isWinterMusic&&!isCensyMusicDetails&&!hasPublicHubCommandCopy(srcdoc)}
              />
            </div>
          )),
          mount,
        )}
    </div>
  );
}
