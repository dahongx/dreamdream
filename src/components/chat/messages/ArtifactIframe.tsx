"use client";

import {
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useOptionalI18n } from "@/i18n/client";
import { wrapBareSrcdoc } from "@/lib/regex/iframe-bridge";

/**
 * <artifact> 标签 / ```html|svg|mermaid|markmap``` code block 的 sandbox 渲染。
 *
 * 实现要点：
 *  - 内容来自 children 的递归 textContent（协议要求 LLM 在 <artifact> 内用
 *    markdown code fence 包裹原始 HTML/SVG/Mermaid 源码 → react-markdown 解析后
 *    children 是 <pre><code>{string}</code></pre>，textContent 即原始源码）
 *  - sandbox="allow-scripts"，不开 allow-same-origin，origin 为 null。这意味着
 *    host 侧读 `iframe.contentDocument` 会触发跨源 SecurityError —— 高度必须
 *    走 postMessage 协议（由 iframe-bridge.ts 的 RESIZE_OBSERVER_SCRIPT 在
 *    child 里上报，host 侧 window 'message' 监听撑高 iframe 元素）。
 *  - 高度无上限（早期版本有 800px 写死的天花板，是 v1 最简实现遗留 bug；连同
 *    "只 onLoad 测一次 + contentDocument 跨源被吞" 一起修掉，跟 RegexIframe
 *    的高度行为对齐）。
 *
 * 跟 RegexIframe 的差异：暂不挂 postMessage host bridge（v1-foundation 模块 4
 * 的 host API 留给后续 PR 跟 regex iframe runtime 一起整合）。
 *
 * 视觉契约见 docs/contracts/chat-render-spec.md §3.8
 */
interface Props extends PropsWithChildren {
  /** 显式 srcdoc（code block handler 直接传字符串时用）。优先级高于 children。 */
  srcdoc?: string;
  /** Source-imported folds fit their contents; ordinary artifacts keep 240px. */
  minHeight?: number;
  mufySourceDefaults?: boolean;
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

const INITIAL_HEIGHT = 240;

export function ArtifactIframe({ children, srcdoc: explicitSrcdoc, minHeight = INITIAL_HEIGHT, mufySourceDefaults = false }: Props) {
  const i18n = useOptionalI18n();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastHeightRef = useRef(INITIAL_HEIGHT);
  const requestMeasurement = useCallback(() => {
    // The child may finish before this component subscribes. Ask it to repeat
    // its measurement without reading the opaque sandbox document.
    iframeRef.current?.contentWindow?.postMessage(
      { type: "nj-artifact-measure" },
      "*",
    );
  }, []);

  // 跟 RegexIframe 一致: 走 wrapBareSrcdoc 注入 doctype/CSP/平台去框 reset CSS +
  // RESIZE_OBSERVER_SCRIPT, 两条 iframe 通路的高度协议共用一份.
  const srcdoc = useMemo(
    () => wrapBareSrcdoc(explicitSrcdoc ?? extractText(children), {mufySourceDefaults}),
    [children, explicitSrcdoc, mufySourceDefaults],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // 同页可能有多个 ArtifactIframe, 用 source 把消息认领到对应 iframe
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number } | null;
      if (data?.type !== "resize") return;
      const next = Math.max(
        minHeight,
        Math.ceil(Number(data.height ?? 0)),
      );
      if (!Number.isFinite(next) || next <= 0) return;
      // 4px 节流避免 ResizeObserver 微抖动导致频繁 reflow
      if (Math.abs(next - lastHeightRef.current) < 4) return;
      lastHeightRef.current = next;
      iframeRef.current?.style.setProperty("height", `${next}px`);
    }
    window.addEventListener("message", onMessage);
    requestMeasurement();
    return () => window.removeEventListener("message", onMessage);
  }, [minHeight, requestMeasurement]);

  return (
    <iframe
      ref={iframeRef}
      onLoad={requestMeasurement}
      className="nj_artifact_iframe block w-full"
      sandbox="allow-scripts"
      // 跟 RegexIframe 对齐: 允许 audio/video autoplay (配合 srcdoc 里的
      // AUTOPLAY_PATCH_SCRIPT). 不带这个属性, sandbox iframe 任何 .play() 都
      // 会被 Permissions Policy 直接拒.
      allow="autoplay"
      srcDoc={srcdoc || undefined}
      style={{
        height: INITIAL_HEIGHT,
        minHeight,
        background: "transparent",
        // border:0 兜底浏览器 UA 默认 iframe 2px 灰边 (跟 RegexIframe 同处理).
        border: 0,
      }}
      title={i18n?.dict.chat.artifactTitle ?? "Interactive content"}
    />
  );
}
