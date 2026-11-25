"use client";

import { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import {dispatchHostSendRpc,type HostSendHandler} from "@/lib/opening/host-composer-send-candidate";
import { ChatHistoryContext } from "@/components/chat/chat-history-context";
import { useI18n } from "@/i18n/client";
import type { FloatingKind } from "@/lib/opening/content";
import { buildIframeSrcdoc, hasOfficialBilibiliPlayer, hasPublicOcProfile, hasPublicEngravedOpening, hasPublicAvatarLibrary, hasPublicCommandCopy, hasPublicMaskExtraction, isMufyTestBilibiliHost, standaloneOfficialBilibiliUrl } from "@/lib/regex/iframe-bridge";
import { copyTextToClipboard } from "@/lib/util/clipboard";
import { iframeProgramKey } from "@/lib/regex/iframe-incremental";
import type {ComposerFillOptions} from '@/lib/opening/composer-fill';

/**
 * Sandboxed renderer for runtime='iframe' regex rules.
 *
 * Security knobs (intentionally minimal):
 *   - sandbox="allow-scripts" — no allow-same-origin, no allow-forms,
 *     no allow-top-navigation, no allow-popups, no allow-modals.
 *     Origin is "null" inside; iframe cannot reach parent storage / DOM.
 *   - CSP via <meta> inside srcdoc forbids connect-src (no fetch/XHR
 *     exfiltration) and frame-src (no nested iframes).
 *
 * The TEST-only standalone official cross-origin Bilibili player is the sole
 * same-origin exception. It never receives the author renderer's host bridge.
 *
 * Host bridge:
 *   On 'load' we create a MessageChannel, send port2 to the iframe via
 *   `postMessage({type:'init', context})`. The iframe-side bridge
 *   established by buildIframeSrcdoc reflects RPC calls back here over
 *   port1 in `{id, method, args}` shape.
 *
 *   桥的生命周期只跟 iframe 的 'load' 走（挂载一次 + srcdoc 变化重载时），
 *   不跟 React 渲染走。历史实现把 history/character 等放进 effect 依赖，
 *   每来一条新消息 effect 重跑、把活着的 MessagePort close 掉 —— 已挂载的
 *   小剧场从第二轮对话起 Host API 全部失联。现在 RPC 读值一律走 ref
 *   （latestRef / ChatHistoryContext），effect 零依赖，桥不死。
 *
 * Host API (in-memory in v1; v1.5 will persist setComponentState to
 * chat_sessions.component_states once that migration lands):
 *   - sendMessage({text})        → invokes the passed onSendMessage handler
 *   - getHistory()               → returns history snapshot（聊天页走
 *     ChatHistoryContext 的实时 ref，预览场景落回 history prop）
 *   - getCharacter()             → returns character meta
 *   - setComponentState({state}) → ephemeral component state per ruleId
 */

export interface HostHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface HostCharacterMeta {
  id: string;
  name: string;
  avatarUrl: string | null;
  tags: string[];
  bio: string | null;
}

interface Props {
  ruleId: string;
  ruleName: string;
  srcdoc: string;
  /** Stable document for prepared Mufy reply text; not enabled for arbitrary artifacts. */
  incrementalUpdates?: boolean;
  captureGroups: string[];
  /** 对话历史快照。聊天页由 ChatHistoryContext 提供实时值（此 prop 可省），
   *  预览场景（无 Provider）继续显式传入。 */
  history?: HostHistoryEntry[];
  character: HostCharacterMeta;
  userName: string;
  onSendMessage: HostSendHandler;
  /** 把文本填进聊天输入框（不发送）—— censy 侧栏点表情/指令走这个（对齐外部组件的
   *  censyInject：填进 composer 让用户可编辑再发）。不传则该能力静默 no-op。 */
  onFillComposer?: (text: string,options?:ComposerFillOptions) => void;
  /** 固定高度(px). 传入时忽略 iframe 内部 resize 上报, 用此高度. 用于内容全是
   *  position:absolute/fixed (脱离文档流, body 高度测不到) 的小剧场 —— 高度
   *  测量必然塌缩, 只能由外部给定一个足够大的固定值. */
  fixedHeight?: number;
  /** 自适应高度模式下的最小高度。聊天正则默认保留 240px；开场组件可传较小值，
   *  避免折叠面板或纯短内容被 240px 的宿主空白强行撑高。 */
  minHeight?: number;
  /** creator CSS 的 scope id —— 挂到 iframe <body> 上，让注入 srcdoc 的
   *  scoped 皮肤 <style> 有宿主可匹配（见 BridgePayload.cssScope）。 */
  cssScope?: string;
  /** 注入 parent 垫片：救活 censy 侧栏等靠 parent.document 注入宿主页的寄生控件，
   *  让它们在 iframe 内自渲染。仅悬浮侧栏类组件传 true。见 iframe-bridge PARENT_SHIM_SCRIPT。 */
  parentShim?: boolean;
  /** Local parent alias for in-flow source documents, without floater sizing/watch. */
  inlineParentShim?: boolean;
  /** Mufy 悬浮组件的原始布局类型，用于恢复各自的开合判据与宿主尺寸。 */
  floatingKind?: FloatingKind;
  /** iframe 填满容器高度（height:100%）而非按内容 / fixedHeight。用于侧栏这类
   *  自己 `position:fixed` 定位、需要一块全高画布让内部 fixed 生效的悬浮件。 */
  fillHeight?: boolean;
  /** 注入灵动岛开合监听：上报 expanded 状态给宿主做 resize-on-toggle。见
   *  iframe-bridge ISLAND_TOGGLE_WATCH_SCRIPT。 */
  islandWatch?: boolean;
}

export const RegexIframe = memo(function RegexIframe({
  ruleId,
  ruleName,
  srcdoc,
  incrementalUpdates = false,
  captureGroups,
  history,
  character,
  userName,
  onSendMessage,
  onFillComposer,
  fixedHeight,
  minHeight = 240,
  cssScope,
  parentShim,
  inlineParentShim,
  floatingKind,
  fillHeight,
  islandWatch,
}: Props) {
  const { locale } = useI18n();
  const [testBilibiliHost,setTestBilibiliHost]=useState(false);
  useEffect(()=>{setTestBilibiliHost(isMufyTestBilibiliHost(window.location.origin));},[]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  // Component state for setComponentState — ephemeral in v1, keyed by ruleId.
  // Lives in a per-window map so it survives re-mount across the same chat
  // session but doesn't leak to other tabs.
  const stateRef = useRef<Record<string, unknown>>({});
  const lastHeightRef = useRef(minHeight);
  const ctxHistoryRef = useContext(ChatHistoryContext);

  // RPC / init 用到的宿主值全部走 ref —— bridge effect 因此可以零依赖，
  // 端口不会因 React 重渲染被误关（见文件头注释）。
  const latestRef = useRef({
    ruleId,
    ruleName,
    captureGroups,
    userName,
    history,
    character,
    onSendMessage,
    onFillComposer,
  });
  useEffect(() => {
    latestRef.current = {
      ruleId,
      ruleName,
      captureGroups,
      userName,
      history,
      character,
      onSendMessage,
      onFillComposer,
    };
  });

  const incremental = incrementalUpdates && srcdoc.includes('data-mufy-source-skin');
  const programKey = useMemo(()=>incremental?iframeProgramKey(srcdoc):srcdoc,[incremental,srcdoc]);
  const documentSnapshot=useRef({programKey,srcdoc,captureGroups});
  if(!incremental||documentSnapshot.current.programKey!==programKey){
    documentSnapshot.current={programKey,srcdoc,captureGroups};
  }
  const documentSource=incremental?documentSnapshot.current.srcdoc:srcdoc;
  const documentCaptures=incremental?documentSnapshot.current.captureGroups:captureGroups;
  useEffect(()=>{
    if(!hasPublicOcProfile(documentSource)&&!hasPublicEngravedOpening(documentSource)&&!hasPublicAvatarLibrary(documentSource)&&!hasPublicCommandCopy(documentSource)&&!hasPublicMaskExtraction(documentSource))return;
    let live=true,busy=false;
    async function onProfileCopy(event:MessageEvent){
      const frame=iframeRef.current;
      if(!frame||event.source!==frame.contentWindow)return;
      const data=event.data as {type?:unknown;id?:unknown;text?:unknown}|null;
      if(data?.type!=='nj-oc-profile-copy'||!Number.isSafeInteger(data.id)||typeof data.text!=='string'||!data.text.trim()||data.text.length>100000)return;
      // Browser activation is required in the host, not a child-supplied flag.
      if(busy||!navigator.userActivation?.isActive){frame.contentWindow?.postMessage({type:'nj-oc-profile-copy-result',id:data.id,ok:false},'*');return;}
      busy=true;
      let ok=false;try{ok=await copyTextToClipboard(data.text);}catch{}
      busy=false;
      if(live&&iframeRef.current===frame)frame.contentWindow?.postMessage({type:'nj-oc-profile-copy-result',id:data.id,ok},'*');
    }
    window.addEventListener('message',onProfileCopy);
    return()=>{live=false;window.removeEventListener('message',onProfileCopy);};
  },[documentSource]);
  const officialVideoUrl=useMemo(()=>{
    if(!testBilibiliHost||cssScope!=='opening'||!hasOfficialBilibiliPlayer(documentSource))return null;
    return standaloneOfficialBilibiliUrl(new DOMParser().parseFromString(documentSource,'text/html'));
  },[testBilibiliHost,cssScope,documentSource]);
  const wrappedSrcdoc = useMemo(
    () =>
      buildIframeSrcdoc({
        srcdoc:documentSource,
        allowBilibiliPlayer:testBilibiliHost&&cssScope==='opening'&&hasOfficialBilibiliPlayer(documentSource),
        captureGroups:documentCaptures,
        incrementalUpdates:incremental,
        cssScope,
        parentShim,
        inlineParentShim,
        floatingKind,
        islandWatch,
      }),
    [documentSource, documentCaptures, incremental, cssScope, parentShim, inlineParentShim, floatingKind, islandWatch,testBilibiliHost],
  );

  const sequence=useRef(0),liveSource=useRef(srcdoc);
  liveSource.current=srcdoc;
  useEffect(()=>{
    if(!incremental)return;
    const frame=iframeRef.current;
    function update(){frame?.contentWindow?.postMessage({type:'nj-mufy-stream-update',html:liveSource.current,sequence:++sequence.current},'*');}
    function ready(event:MessageEvent){if(event.source===frame?.contentWindow&&event.data?.type==='nj_iframe_bridge_ready')update();}
    frame?.addEventListener('load',update);window.addEventListener('message',ready);update();
    return()=>{frame?.removeEventListener('load',update);window.removeEventListener('message',ready);};
  },[incremental,srcdoc,wrappedSrcdoc]);

  useEffect(() => {
    // An official external media document never receives a message port,
    // user name, captures, history, or any app Host API.
    if(officialVideoUrl)return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    async function handleRpc(
      method: string,
      args: Record<string, unknown>,
    ): Promise<unknown> {
      const latest = latestRef.current;
      switch (method) {
        case "sendMessage": {
          const text = String(args?.text ?? "");
          return dispatchHostSendRpc(text, args?.options, latest.onSendMessage);
        }
        case "fillComposer": {
          const text = String(args?.text ?? "");
          if (!text) return null;
          latest.onFillComposer?.(text,args?.separator==='none'?{separator:'none'}:undefined);
          return null;
        }
        case "getHistory":
          return ctxHistoryRef?.current ?? latest.history ?? [];
        case "getCharacter":
          return latest.character;
        case "setComponentState": {
          stateRef.current[latest.ruleId] = args?.state;
          return null;
        }
        default:
          throw new Error(`unknown method: ${method}`);
      }
    }

    function onLoad() {
      // srcdoc 变更导致的重载会再次触发 load —— 先关掉上一代端口再握手。
      portRef.current?.close();
      const channel = new MessageChannel();
      portRef.current = channel.port1;

      channel.port1.onmessage = (ev) => {
        const { id, method, args } = ev.data as {
          id: number;
          method: string;
          args: Record<string, unknown>;
        };
        handleRpc(method, args)
          .then((result) => channel.port1.postMessage({ id, result }))
          .catch((err: Error) =>
            channel.port1.postMessage({ id, error: err.message }),
          );
      };

      const latest = latestRef.current;
      iframe?.contentWindow?.postMessage(
        {
          type: "init",
          context: {
            captureGroups: latest.captureGroups,
            locale,
            userName: latest.userName,
            ruleId: latest.ruleId,
            ruleName: latest.ruleName,
          },
        },
        "*",
        [channel.port2],
      );
    }

    function onBridgeReady(event: MessageEvent) {
      if (event.source !== iframe?.contentWindow) return;
      if (event.data?.type !== "nj_iframe_bridge_ready") return;
      onLoad();
    }

    iframe.addEventListener("load", onLoad);
    window.addEventListener("message", onBridgeReady);
    // `srcdoc` 很小的悬浮侧栏可能在 React effect 执行前就完成 load，单靠上面的
    // 监听会永久错过握手，表现为按钮能点但 host.fillComposer 没有通信端口。
    // 立即补发一次；若文档尚未就绪，随后真实 load 事件还会再完成握手。
    onLoad();
    return () => {
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", onBridgeReady);
      portRef.current?.close();
    };
    // Re-handshake identity changes without replacing srcDoc or remounting the
    // author's document. Legacy player-name bindings update on host-ready.
  }, [ctxHistoryRef, locale,officialVideoUrl,userName]);

  useEffect(() => {
    // 固定高度 / 填满高度模式: 忽略 iframe 内部 resize 上报 (内容全是 absolute/fixed,
    // 测高必塌缩), 高度由外部 fixedHeight 锁定或 fillHeight 填满容器.
    if (fixedHeight || fillHeight) return;
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number } | null;
      if (data?.type !== "resize") return;
      const next = Math.max(minHeight, Math.ceil(Number(data.height ?? 0)));
      if (!Number.isFinite(next) || next <= 0) return;
      if (Math.abs(next - lastHeightRef.current) < 4) return;
      lastHeightRef.current = next;
      iframeRef.current?.style.setProperty("height", `${next}px`);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fixedHeight, fillHeight, minHeight]);

  if(officialVideoUrl)return (
    <iframe
      title={`official-bilibili-${ruleId}`}
      src={officialVideoUrl}
      sandbox="allow-scripts allow-same-origin"
      allow="autoplay"
      className="nj_regex_iframe nj_official_video block w-full"
      style={{display:'block',width:'100%',maxWidth:500,aspectRatio:'16 / 9',height:'auto',margin:'auto',border:0,background:'transparent'}}
    />
  );

  return (
    <iframe
      key={locale}
      ref={iframeRef}
      title={`regex-${ruleId}`}
      sandbox="allow-scripts"
      // 让灵动岛 / 任何带音乐的美化进对话页就能 autoplay. 配合 srcdoc 里注入的
      // AUTOPLAY_PATCH_SCRIPT (audio.src 被赋值后自动 .play()) 使用; 不带这个
      // Permissions Policy 属性, sandbox iframe 即便有 user activation 也会被
      // 直接拒. 跟 sandbox="allow-scripts" 组合不冲突, 不开放 same-origin / forms
      // / popups 等其他能力. iOS Safari 仍可能 reject (它对 audio autoplay 极严),
      // patch 静默兜底, 作者代码的播放按钮仍可手动触发.
      allow="autoplay"
      srcDoc={wrappedSrcdoc}
      className="nj_regex_iframe block w-full"
      style={{
        height: fillHeight ? "100%" : (fixedHeight ?? minHeight),
        minHeight: fillHeight ? "100%" : (fixedHeight ?? minHeight),
        display: "block",
        background: "transparent",
        // 兜底清掉浏览器 UA 默认 iframe 边框 (Tailwind preflight 通常会零掉,
        // 不同环境不可保证, 显式声明防回归).
        border: 0,
      }}
    />
  );
});
