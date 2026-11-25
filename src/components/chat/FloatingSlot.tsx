"use client";
import {knownOrbGeometry,KNOWN_ORB_LOCAL_CSS,knownOrbVisibilityScript,acceptKnownOrbHidden,orbInstanceToken} from "@/lib/opening/known-orb-runtime";
import {floatingSourceGeometryStyle,type FloatingSourceViewport} from "@/lib/opening/floating-source-geometry";
import {MufyHeartOrbOS} from "./MufyHeartOrbOS";
import {MufyHeartNavOrbOS} from "./MufyHeartNavOrbOS";
import {MufyCensyGhostMusic} from "./MufyCensyGhostMusic";
import {MufyPassiveShootingStars} from "./MufyPassiveShootingStars";
import {parsePublicHostWarningContract} from "@/lib/import/mufy-public-host-warning-candidate";
import {MufyPublicWarningCandidate} from "./MufyPublicWarningCandidate";
import type {HostSendHandler} from "@/lib/opening/host-composer-send-candidate";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  type HostCharacterMeta,
  type HostHistoryEntry,
  RegexIframe,
} from "@/components/regex/RegexIframe";
import {
  type FloatingKind,
  type FloatingPos,
  type FloatingSrcdoc,
  interpolateOpening,
  isSourceImageSidebar,
  isSourceMemeLibrary,
  isSourceInstructionsSidebar,
  routeOpeningContentSplit,
} from "@/lib/opening/content";
import type { OpeningComponentWithSlots } from "@/lib/opening/queries";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { MufyNativeImageSidebar } from "./MufyNativeImageSidebar";
import {MufyGhostInstructions} from "./MufyGhostInstructions";
import {MufyFoxToolkit} from "./MufyFoxToolkit";
import {MufyCloudMusic} from "./MufyCloudMusic";
import {MufyImageIsland} from "./MufyImageIsland";
import {MufyCommandDrawer} from "./MufyCommandDrawer";

/**
 * 悬浮件插槽 —— 把开场组件里的「灵动岛」段从滚动流拎出来，挂到 FloatingLayer
 * 提供的悬浮画布上，达成「浮在页面固定位置、不随内容滚动」的效果，
 * 同时保留 iframe 沙箱安全隔离。
 *
 * 设计要点（见 docs/exec-plans/active/floating-widgets.md 卡点 1/2）：
 *  - 悬浮由 **iframe 宿主元素** 的 absolute 定位达成，不靠组件内部 fixed —— 组件
 *    内部 `position:fixed` 只相对 iframe 视口，塞进滚动流时逃不出去。这里注入
 *    NEUTRALIZE_FIXED_CSS 把灵动岛顶层容器的 fixed 打回 static，让它在 iframe 内
 *    正常流式布局、由 RESIZE 协议自然撑高；iframe 元素本身负责「浮在哪」。
 *  - iframe 不铺满悬浮层，只占锚点方位一块（宽度取内容常见宽 ~360px，高度由
 *    resize 上报），`pointer-events:auto` 收回自己那块点击；悬浮层其余区域
 *    `pointer-events:none` 事件穿透到底下聊天区。这样灵动岛能点播放/展开，又不
 *    把整个聊天区盖死。
 *
 * selector 契约：`#nj_floating_slot` + `.nj_floating_widget`。
 */

interface Props {
  components: OpeningComponentWithSlots[];
  history?: HostHistoryEntry[];
  character: HostCharacterMeta;
  userName: string;
  globalCss?: string;
  onSendMessage: HostSendHandler;
  /** censy 侧栏点表情/指令填进输入框（不发送）。详情页预览可省。 */
  onFillComposer?: (text: string) => void;
  /** Native selection-aware actions replace the complete draft, never append it twice. */
  onReplaceComposer?: (text: string) => void;
}

/**
 * 中和灵动岛内部的 position:fixed —— 让顶层悬浮容器在 iframe 内变成正常流式块，
 * 这样 RESIZE_OBSERVER_SCRIPT 能测到真实高度、iframe 元素撑到内容大小；悬浮
 * 定位交给外层 iframe 元素（见组件头注释）。只作用到灵动岛专属容器，不动内部
 * 卡片布局。
 */
const NEUTRALIZE_FIXED_CSS = `<style>
  html,body{width:100%!important;height:auto!important;overflow:visible!important;margin:0!important;padding:0!important}
  .top-adaptive-dock,#island,.island-container,#cen-nav-wrapper{
    position:static!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;
    transform:none!important;margin:0 auto!important;z-index:auto!important;
  }
</style>`;

// Source dimensions, not platform skin: the host owns the viewport anchor;
// inside the opaque frame the author's drawer must start at its local origin.
// Keep its original image, glass, decorations and native <details> interaction.
const SOURCE_IMAGE_SIDEBAR_COORDINATES = `<style>
body[data-character-css="opening"] details.mufy-side-r{top:0!important;right:0!important;margin:0!important}
body[data-character-css="opening"] .mufy-side-btn{width:60px!important;height:60px!important}
body[data-character-css="opening"] .mufy-side-icon{width:48px!important;height:48px!important;object-fit:cover!important}
body[data-character-css="opening"] .mufy-side-panel{width:min(320px,calc(100vw - 6px))!important;height:min(380px,100vh)!important;top:0!important;right:6px!important}
</style>`;

const SOURCE_MEME_LIBRARY_COORDINATES = `<style>
body[data-character-css="opening"] .meme-dock-mini{top:0!important;right:0!important}
body[data-character-css="opening"] .meme-window-mini{width:min(280px,calc(100vw - 60px))!important;max-width:none!important;height:100vh!important;max-height:none!important}
</style>`;

const SOURCE_INSTRUCTIONS_COORDINATES = `<style>
body[data-character-css="opening"] .censy-ins-container{top:0!important;right:0!important}
body[data-character-css="opening"] .censy-ins-trigger>summary{box-sizing:border-box!important;width:44px!important;height:44px!important}
body[data-character-css="opening"] .censy-ins-content{box-sizing:border-box!important;width:min(300px,calc(100vw - 60px))!important;max-height:100vh!important}
</style>`;

const LEGACY_FLOATING_ADAPT_CSS: Record<
  Exclude<FloatingKind, "island" | "warning-top">,
  string
> = {
  "ornament-right": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}body[data-character-css="opening"] .censy-hanging-ornament{position:absolute!important;top:0!important;right:20px!important}</style>`,
  "rose-right": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}.ft-rose-details{top:0!important;right:0!important}.ft-rose-content{max-height:min(400px,calc(82vh - 45px))!important}</style>`,
  "ghost-right": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}body[data-character-css="opening"] .ft-ghost-sidebar{top:0!important;right:0!important;bottom:auto!important;box-sizing:border-box!important}body[data-character-css="opening"] .ft-ghost-sidebar *{box-sizing:border-box!important}.ft-ghost-sidebar[data-nj-open="true"]{width:180px!important;background:rgba(255,255,255,.15)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;border-color:rgba(255,255,255,.4)!important}.ft-ghost-sidebar[data-nj-open="true"] .ft-sidebar-indicator{opacity:0!important}.ft-ghost-sidebar[data-nj-open="true"] .ft-player-ui{opacity:1!important}</style>`,
  "details-right": `<style>
html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}
details.censy-blue-glass-sidebar,details[class*="sidebar"]{margin-left:auto!important}
/* Legacy Mufy emoticon drawers were positioned against the full page. Inside
   the fixed host iframe their original right:15px/right:10px offsets clip the
   cat and the panel border. Pin both to the iframe edge instead. */
.emoticon-sidebar-toggle{right:0!important;top:50%!important}
.emoticon-sidebar-container{top:0!important;right:-100%!important;width:100%!important;height:100%!important;padding:4px!important;box-sizing:border-box!important}
.emoticon-sidebar-toggle:focus~.emoticon-sidebar-container,.emoticon-sidebar-container:focus-within{right:0!important}
.emoticon-panel{width:100%!important;height:min(480px,calc(100% - 8px))!important;max-height:none!important}
</style>`,
  "npc-left": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}#cen_Sx_Sidebar_L{top:0!important;left:-300px!important;height:100%!important}#cen_Sx_Sidebar_L.active{left:0!important}</style>`,
  "gold-right": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}#cen_gold_trigger,#cen_gold_panel{top:50%!important}</style>`,
  "omni-right": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}#Cen_Omni_Wrapper{top:0!important}</style>`,
  "memory-left": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}html:not([data-nj-floating-open="true"]) [class^="c-trig-"],html:not([data-nj-floating-open="true"]) [class*=" c-trig-"]{top:50%!important}</style>`,
  "orb-right": `<style>html,body{width:100%!important;height:100%!important;overflow:visible!important;margin:0!important;padding:0!important}</style>`,
};

/** 锚点方位 → 悬浮 iframe 容器的定位 class（相对铺满视口的 #nj_floating_layer）。
 *  top-* 从全局顶栏（--topbar-height:64px）下方 8px 起，避免盖住站点导航/返回；
 *  灵动岛惯例是顶部居中一条。bottom-* 避开移动端底栏（--bottombar-height）。 */
const TOP_OFFSET = "top-[calc(var(--topbar-height)+8px)]";
const POS_CLASS: Record<FloatingPos, string> = {
  "top-center": `${TOP_OFFSET} left-1/2 -translate-x-1/2`,
  "top-right": `${TOP_OFFSET} right-3`,
  "top-left": `${TOP_OFFSET} left-3`,
  "right-center": "top-1/2 right-0 -translate-y-1/2",
  "left-center": "top-1/2 left-0 -translate-y-1/2",
  "bottom-center":
    "bottom-[calc(var(--bottombar-height)+env(safe-area-inset-bottom)+8px)] left-1/2 -translate-x-1/2 md:bottom-3",
};

export const FloatingSlot = memo(function FloatingSlot({
  components,
  history,
  character,
  userName,
  globalCss,
  onSendMessage,
  onFillComposer,
  onReplaceComposer,
}: Props) {
  if (components.length === 0) return null;

  const ctx = { char: character.name, user: userName };
  const sanitizedCss = globalCss
    ? sanitizeAndScopeCss(globalCss, "opening").css
    : "";
  const skinTag = sanitizedCss ? `<style>${sanitizedCss}</style>` : "";

  // 收集所有组件里的悬浮段。
  const widgets: Array<{ compId: string; w: FloatingSrcdoc }> = [];
  for (const c of components) {
    const content = interpolateOpening(c.content, {
      ...ctx,
      slots: c.slotValues,
    });
    const { floating } = routeOpeningContentSplit(content, c.id);
    for (const w of floating) widgets.push({ compId: c.id, w });
  }

  return (
    <FloatingWidgets
      widgets={widgets}
      skinTag={skinTag}
      history={history}
      character={character}
      userName={userName}
      onSendMessage={onSendMessage}
      onFillComposer={onFillComposer}
      onReplaceComposer={onReplaceComposer}
    />
  );
});

interface WidgetsProps {
  widgets: Array<{ compId: string; w: FloatingSrcdoc }>;
  skinTag: string;
  history?: HostHistoryEntry[];
  character: HostCharacterMeta;
  userName: string;
  onSendMessage: HostSendHandler;
  onFillComposer?: (text: string) => void;
  onReplaceComposer?: (text: string) => void;
}

/**
 * 悬浮件集合 —— 在这一层统一持有「侧栏是否展开」状态，让灵动岛在侧栏展开时
 * **整个隐藏**，彻底消除两者的透明盒子重叠（这是「岛+侧栏都有的卡侧栏 tab
 * 点不到」的根治：不管屏宽/像素怎么算，同一时刻只有一个悬浮件占位可点）。
 */
function FloatingWidgets({
  widgets,
  skinTag,
  history,
  character,
  userName,
  onSendMessage,
  onFillComposer,
  onReplaceComposer,
}: WidgetsProps) {
  const [openSidebarKeys, setOpenSidebarKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const setSidebarOpen = useCallback((key: string, open: boolean) => {
    setOpenSidebarKeys((previous) => {
      const next = new Set(previous);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const sidebarOpen = openSidebarKeys.size > 0;
  if (widgets.length === 0) return null;
  return (
    <div id="nj_floating_slot" className="nj_floating_slot contents">
      {widgets.map(({ w }) => (
        w.passiveStars ? <MufyPassiveShootingStars key={w.key} spec={w.passiveStars}/> :
        (w.nativeImageSidebar?.variant==='page-controls'||w.nativeImageSidebar?.variant==='halo-toolkit') ? null :
        w.nativeImageSidebar?.variant==='heart-orb-nav-v441' ? <MufyHeartNavOrbOS key={w.key} spec={w.nativeImageSidebar} onFillComposer={onFillComposer} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar?.variant==='heart-orb-os-v42' ? <MufyHeartOrbOS key={w.key} spec={w.nativeImageSidebar} onFillComposer={onFillComposer} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar?.variant==='censy-ghost-music-v4' ? <MufyCensyGhostMusic key={w.key} spec={w.nativeImageSidebar} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar?.variant==='command-drawer' ? <MufyCommandDrawer key={w.key} spec={w.nativeImageSidebar} characterId={character.id} onFillComposer={onFillComposer} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar?.variant==='fox-toolkit' && w.nativeImageSidebar.foxToolkit ? <MufyFoxToolkit key={w.key} data={w.nativeImageSidebar.foxToolkit} characterId={character.id} onReplaceComposer={onReplaceComposer} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar?.variant==='cloud-music' ? <MufyCloudMusic key={w.key} spec={w.nativeImageSidebar} characterId={character.id} onReplaceComposer={onReplaceComposer} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar?.variant==='image-island' ? <MufyImageIsland key={w.key} spec={w.nativeImageSidebar} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar?.variant==='ghost-focus-left' ? <MufyGhostInstructions key={w.key} widgetKey={w.key} spec={w.nativeImageSidebar} onOpenChange={open=>setSidebarOpen(w.key,open)}/> :
        w.nativeImageSidebar ? <MufyNativeImageSidebar key={w.key} widgetKey={w.key} spec={w.nativeImageSidebar} character={character} history={history} userName={userName} onSendMessage={onSendMessage} onFillComposer={onFillComposer} onOpenChange={(open) => setSidebarOpen(w.key, open)} /> :
        <FloatingWidget
          key={w.key}
          w={w}
          skinTag={skinTag}
          history={history}
          character={character}
          userName={userName}
          onSendMessage={onSendMessage}
          onFillComposer={onFillComposer}
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={(open) => setSidebarOpen(w.key, open)}
        />
      ))}
    </div>
  );
}

interface WidgetProps {
  w: FloatingSrcdoc;
  skinTag: string;
  history?: HostHistoryEntry[];
  character: HostCharacterMeta;
  userName: string;
  onSendMessage: HostSendHandler;
  onFillComposer?: (text: string) => void;
  /** 侧栏当前是否展开（集合层统一状态）。灵动岛据此在侧栏展开时隐藏，避免重叠。 */
  sidebarOpen: boolean;
  /** 侧栏 widget 用它上报自己的开合，抬到集合层。 */
  onSidebarOpenChange: (open: boolean) => void;
}

/**
 * 单个悬浮件。侧栏（needsShim）特殊处理**遮挡死结**：iframe pointer-events 全有/
 * 全无，若侧栏 iframe 常驻铺满右侧一大条可点击区，会盖住底下页面按钮（详情页
 * 「开始对话」）点不动。方案：监听侧栏内部上报的 `nj_sidebar` 开合消息 ——
 *  - 收起：iframe 缩到右边缘窄条（≈48px），只盖住 MENU 把手那一小块，其余可点。
 *  - 展开：放大到面板宽（340px），此时遮挡聊天区可接受（用户点开本就该挡）。
 */
function FloatingWidget({
  w,
  skinTag,
  history,
  character,
  userName,
  onSendMessage,
  onFillComposer,
  sidebarOpen,
  onSidebarOpenChange,
}: WidgetProps) {
  const floatingKind = w.meta.kind;
  const sourceGeometry=knownOrbGeometry(floatingKind,w.meta.sourceGeometry,w.srcdoc);
  const orbInstanceId=useId();
  const orbToken=sourceGeometry?orbInstanceToken(orbInstanceId,w.srcdoc):'';
  const [orbViewport,setOrbViewport]=useState<FloatingSourceViewport|undefined>(undefined);
  useEffect(()=>{if(!sourceGeometry)return;const update=()=>setOrbViewport({width:window.innerWidth,height:window.innerHeight});update();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[!!sourceGeometry]);
  const isBanner = floatingKind === "warning-top";
  const sourceWarning=isBanner?parsePublicHostWarningContract(w.srcdoc):null;
  const isSourceWarning=sourceWarning!==null;
  const isIsland = floatingKind === "island";
  const isSidebar = !isIsland && !isBanner;
  const isImageSidebar = floatingKind === "details-right" && isSourceImageSidebar(w.srcdoc);
  const isMemeLibrary = floatingKind === "details-right" && isSourceMemeLibrary(w.srcdoc);
  const isInstructions = floatingKind === "details-right" && isSourceInstructionsSidebar(w.srcdoc);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Banners belong to the chat column, unlike viewport-anchored side widgets.
  // Measure the real header so creator skins and desktop sidebars are respected.
  // Keep the already accepted mobile positioning unchanged.
  useEffect(() => {
    if (!isBanner || dismissed) return;
    const container = containerRef.current;
    const chat = document.getElementById("nj_chat_app");
    const header = document.getElementById("nj_chat_header");
    if (!container || !chat || !header) return;
    const update = () => {
      if (window.innerWidth < 768) {
        container.style.removeProperty("left");
        container.style.removeProperty("top");
        container.style.removeProperty("width");
        if(isSourceWarning)container.style.removeProperty("max-width");
        return;
      }
      const bounds = chat.getBoundingClientRect();
      container.style.left = `${bounds.left + bounds.width / 2}px`;
      container.style.top = `${header.getBoundingClientRect().bottom + 8}px`;
      if(isSourceWarning){
        container.style.removeProperty("width");
        container.style.maxWidth=`${bounds.width*.9}px`;
      }else container.style.width = `${Math.min(600, bounds.width * 0.9)}px`;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(chat);
    observer.observe(header);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isBanner, dismissed, isSourceWarning]);

  // 监听悬浮件内部上报的开合状态（侧栏 nj_sidebar / 灵动岛 nj_island）。
  // 侧栏：把开合抬到集合层（onSidebarOpenChange），让灵动岛据此隐藏，消除重叠。
  // 灵动岛：自己 resize-on-toggle（收起缩小）。只认来自本 widget iframe 的消息。
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const iframe = containerRef.current?.querySelector("iframe");
      if (sourceGeometry && acceptKnownOrbHidden(iframe?.contentWindow,e.source,e.data,orbToken)) { setDismissed(true); onSidebarOpenChange(false); return; }
      if (iframe && e.source !== iframe.contentWindow) return;
      const d = e.data as {
        type?: string;
        open?: boolean;
        expanded?: boolean;
      } | null;
      if (isSidebar && d?.type === "nj_sidebar") {
        setOpen(!!d.open);
        onSidebarOpenChange(!!d.open);
      }
      if (isIsland && d?.type === "nj_island") setOpen(!!d.expanded);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isSidebar, isIsland, onSidebarOpenChange, !!sourceGeometry, orbToken]);

  // Mufy's ghost player is a 12px :hover handle. A 12px iframe is too narrow
  // to be a dependable touch target, and iframe pointer events do not bubble
  // to React. Keep an invisible 32px host hit-area while collapsed, then let
  // the author's original 180px player receive all events after it opens.
  useEffect(() => {
    if (floatingKind !== "ghost-right" || !open) return;
    function closeFromOutside(event: PointerEvent) {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        setOpen(false);
        onSidebarOpenChange(false);
      }
    }
    document.addEventListener("pointerdown", closeFromOutside, true);
    return () =>
      document.removeEventListener("pointerdown", closeFromOutside, true);
  }, [floatingKind, open, onSidebarOpenChange]);

  // 灵动岛保持创作者设计的原始大小/状态（不裁、不缩、不隐藏）。侧栏与灵动岛是
  // 两个独立浮层，靠 z-index + pointer-events 层叠共存：
  //  - 侧栏展开时：侧栏在上层（z 更高）接管点击；灵动岛这层设 pointer-events:none
  //    让点击**穿透**过去 → 侧栏 tab/关闭叉照常能点，同时灵动岛仍**可见**（不消失、
  //    不变形），只是暂时不可交互（用户在用侧栏，符合预期）。侧栏收起后灵动岛恢复交互。
  //  - 这才是根治：问题从来是「谁在上层接点击」，用层叠解决，不动灵动岛尺寸。
  const islandClickThrough = isIsland && sidebarOpen;

  let containerClass: string;
  if (isBanner) {
    containerClass = isSourceWarning
      ? `nj_floating_widget nj_floating_banner pointer-events-auto fixed z-40 h-[28px] w-fit max-w-[90vw] ${POS_CLASS[w.meta.pos]}`
      : `nj_floating_widget nj_floating_banner pointer-events-auto fixed z-40 h-[54px] w-[min(600px,90vw)] overflow-hidden ${POS_CLASS[w.meta.pos]}`;
  } else if (isSidebar) {
    // 收起 / 展开都用**同一垂直锚点**（右边缘、垂直居中），只变宽高 —— 避免在
    // inset-y-0(全高) ↔ top-1/2(中部) 之间跳导致「从上往下滑」的突兀动画。
    // 收起：≈48×160 小把手（罩住内部 top:45% 把手），不挡「开始对话」等。
    // 展开：面板尺寸（内部面板 480px 高、scale(0.8)≈384，给 88vh 容纳）。
    // 只 transition 宽度（高度直接跳，不做上下滑动画）。z 高于灵动岛。
    const classes: Record<
      Exclude<FloatingKind, "island" | "warning-top">,
      string
    > = {
      "ornament-right": "right-3 top-[60px] w-[125px] h-[150px]",
      "rose-right": `right-0 top-[20%] ${
        open ? "h-[min(445px,82vh)] w-[min(245px,92vw)]" : "h-[36px] w-[28px]"
      }`,
      "ghost-right": `right-0 top-[40%] h-[160px] ${
        open ? "w-[180px]" : "w-[32px]"
      }`,
      "details-right": isInstructions ? `right-5 top-[150px] ${open ? "w-[min(360px,calc(100vw-20px))] h-[min(500px,calc(100dvh-150px))]" : "w-11 h-11"}` : isMemeLibrary ? `right-0 top-[25vh] ${open ? "w-[min(340px,100vw)] h-[min(500px,75dvh)]" : "w-12 h-12"}` : isImageSidebar ? `right-0 top-[8vh] ${
        open ? "h-[min(380px,84dvh)] w-[min(326px,100vw)]" : "h-[60px] w-[61px]"
      }` : `right-0 top-1/2 -translate-y-1/2 ${
        open ? "h-[min(500px,88dvh)] w-[min(348px,92vw)]" : "h-[160px] w-[48px]"
      }`,
      "npc-left": `left-0 top-[15%] ${
        open ? "h-[70vh] w-[min(336px,100vw)]" : "h-[100px] w-[36px]"
      }`,
      "gold-right": `right-0 top-1/2 -translate-y-1/2 ${
        open ? "h-[380px] w-[min(280px,100vw)]" : "h-[80px] w-[28px]"
      }`,
      "omni-right": `right-0 top-[10vh] ${
        open ? "h-[500px] w-[min(355px,100vw)]" : "h-[75px] w-[75px]"
      }`,
      "memory-left": open
        ? "left-0 top-1/2 -translate-y-1/2 h-[min(620px,100dvh)] w-[min(430px,100vw)]"
        : "right-0 top-[40%] -translate-y-1/2 h-[120px] w-[30px]",
      "orb-right": `right-0 top-1/2 -translate-y-1/2 ${
        open ? "h-[520px] w-[min(360px,100vw)]" : "h-[72px] w-[72px]"
      }`,
    };
    containerClass = `nj_floating_widget nj_floating_sidebar ${floatingKind === "ornament-right" ? "pointer-events-none" : "pointer-events-auto"} fixed z-[45] overflow-visible transition-[width] duration-200 ${classes[floatingKind]}`;
  } else {
    // 灵动岛：
    //  - 收起：缩成顶部居中小胶囊(200×72)+overflow-hidden，裁掉内部 opacity:0 但
    //    仍占位的展开面板 → 透明盒子不会长高盖住右侧侧栏 tab/关闭叉（老 bug 根治）。
    //  - 展开：**高度跟随创作者设定**（各卡 180~380px 不一，绝不能一刀切固定值，
    //    否则矮的空白、高的截断——谢寻 380px 被 300px 截断就是这么来的）。展开态
    //    不锁高、不 overflow-hidden，由 iframe 的 resize 上报把容器撑到内容真实高度。
    //    展开时遮挡聊天区可接受（用户主动点开），侧栏展开时本层 pointer-events:none 穿透。
    const islandExpanded = open;
    containerClass = `nj_floating_widget nj_floating_island fixed z-40 transition-[width] duration-200 ${POS_CLASS[w.meta.pos]} ${
      islandClickThrough ? "pointer-events-none" : "pointer-events-auto"
    } ${
      islandExpanded
        ? "h-auto w-[min(320px,86vw)]"
        : "h-[72px] w-[200px] overflow-hidden"
    }`;
  }
  // 展开态灵动岛：不用 fillHeight，让 RegexIframe 的 resize 逻辑按内容真实高度撑开
  // → 高度跟随创作者。收起态 + 侧栏用 fillHeight 填满受控小盒。
  const islandExpandedFill = isIsland && open;
  const ghostHostOpenCss =
    floatingKind === "ghost-right" && open
      ? `<style>body[data-character-css="opening"] .ft-ghost-sidebar{width:180px!important;background:rgba(255,255,255,.15)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;border-color:rgba(255,255,255,.4)!important}body[data-character-css="opening"] .ft-ghost-sidebar .ft-sidebar-indicator{opacity:0!important}body[data-character-css="opening"] .ft-ghost-sidebar .ft-player-ui{opacity:1!important}</style><script>document.addEventListener('DOMContentLoaded',function(){var el=document.querySelector('.ft-ghost-sidebar');if(el)el.setAttribute('data-nj-open','true')})</script>`
      : "";
  const injectedCss = isSidebar
    ? `${LEGACY_FLOATING_ADAPT_CSS[floatingKind]}${ghostHostOpenCss}${skinTag}${isImageSidebar ? SOURCE_IMAGE_SIDEBAR_COORDINATES : ""}${isMemeLibrary ? SOURCE_MEME_LIBRARY_COORDINATES : ""}${isInstructions ? SOURCE_INSTRUCTIONS_COORDINATES : ""}`
    : `${NEUTRALIZE_FIXED_CSS}${skinTag}`;

  if ((isBanner || sourceGeometry) && dismissed) return null;
  if(sourceWarning)return <div ref={containerRef} className={containerClass}>
    <MufyPublicWarningCandidate contract={sourceWarning} onDismiss={()=>setDismissed(true)}/>
  </div>;

  return (
    <div ref={containerRef} className={containerClass} style={sourceGeometry?floatingSourceGeometryStyle(sourceGeometry,open,orbViewport):undefined}>
      <RegexIframe
        ruleId={`floating-${w.key}`}
        ruleName="floating"
        srcdoc={`${injectedCss}\n${w.srcdoc}${sourceGeometry?KNOWN_ORB_LOCAL_CSS+knownOrbVisibilityScript(orbToken):""}`}
        captureGroups={[]}
        history={history}
        character={character}
        userName={userName}
        onSendMessage={onSendMessage}
        onFillComposer={onFillComposer}
        cssScope="opening"
        parentShim={w.meta.needsShim}
        floatingKind={floatingKind}
        // 侧栏：始终 fillHeight 填满受控盒。灵动岛：仅**收起态** fillHeight（填满 72px
        // 小胶囊、不长高挡侧栏）；**展开态不 fillHeight**，走 resize 按创作者内容高度
        // 撑开（各卡 180~380px 自适应，不截断不空白）。
        fillHeight={isBanner || isSidebar || (isIsland && !islandExpandedFill)}
        islandWatch={isIsland}
      />
      {isBanner && (
        <button
          type="button"
          aria-label="关闭提示"
          className="absolute inset-y-0 right-0 z-10 flex w-11 cursor-pointer items-center justify-center bg-transparent text-lg text-white/55 transition hover:text-white"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      )}
      {floatingKind === "ghost-right" && !open && (
        <button
          type="button"
          aria-label="展开播放器侧栏"
          className="absolute inset-y-0 right-0 z-10 w-8 cursor-pointer bg-transparent"
          onClick={() => {
            setOpen(true);
            onSidebarOpenChange(true);
          }}
        />
      )}
    </div>
  );
}
