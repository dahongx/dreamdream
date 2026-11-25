"use client";
import type {HostSendHandler} from "@/lib/opening/host-composer-send-candidate";

import { memo } from "react";
import {
  type HostCharacterMeta,
  type HostHistoryEntry,
  RegexIframe,
} from "@/components/regex/RegexIframe";
import {
  hasRenderableOpeningBody,
  interpolateOpening,
  needsMufyInlineParentShim,
  mufyFixedCanvasBoundary,
  routeOpeningContentSplit,
} from "@/lib/opening/content";
import type { OpeningComponentWithSlots } from "@/lib/opening/queries";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { MessageRenderer } from "./MessageRenderer";
import { hasMufyAdaptedComponent } from "@/lib/import/mufy-native-table";
import { openingComponentPresentation } from "@/lib/import/mufy-component-presentation";
import {MufyComposerCompanion} from './MufyComposerCompanion';
import {parseFullscreenStory} from '@/lib/opening/fullscreen-story';
import {MufyFullscreenStory} from './MufyFullscreenStory';
import {parsePublicMap} from '@/lib/opening/public-map';
import {MufyPublicMap} from './MufyPublicMap';
import {parseYanjViewportFragment} from '@/lib/opening/yanj-viewport';
import {MufyYanjViewport} from './MufyYanjViewport';

/**
 * Standalone opening slot — renders a character's opening components once,
 * above the message stream. Decoupled from the message pipeline: content
 * comes from the components themselves (not model output), so it never
 * changes across conversation turns.
 *
 * Routing mirrors the regex segment pipeline: `<artifact>…</artifact>` →
 * sandboxed RegexIframe (no capture groups), else sanitize HTML via
 * MessageRenderer. {{char}} / {{user}} are interpolated client-side.
 *
 * selector contract: `#nj_opening_slot`.
 */

interface Props {
  components: OpeningComponentWithSlots[];
  /** iframe Host API 的对话历史。聊天页由 ChatHistoryContext 提供实时值
   *  （此 prop 可省），预览场景继续显式传入。 */
  history?: HostHistoryEntry[];
  character: HostCharacterMeta;
  userName: string;
  globalCss?: string;
  onSendMessage: HostSendHandler;
  /** Draft only: copying an opening command must never send a model request. */
  onFillComposer?: (text: string) => void;
}

// memo：开场组件内容与对话轮次无关（见文件头注释），但它挂在消息列表顶部，
// 不 memo 的话流式每个 chunk 都重跑 sanitizeAndScopeCss + srcdoc 拼接。
export const OpeningSlot = memo(function OpeningSlot({
  components,
  history,
  character,
  userName,
  globalCss,
  onSendMessage,
  onFillComposer,
}: Props) {
  if (components.length === 0) return null;

  const ctx = { char: character.name, user: userName };

  // 每个 iframe 是独立 document, globalCss (皮肤) 要注入到每个 srcdoc.
  // 必须先 sanitize: 清理注释、scope 隔离、安全检查。
  const sanitizedCss = globalCss
    ? sanitizeAndScopeCss(globalCss, "opening").css
    : "";

  // 白让尘式小剧场适配: 作者把人物卡/境界塔/文案用 display:flex(默认 row) 横排,
  // 且塔(scene-container) 用固定高度. 在寄情详情页(宽 iframe)里横向摊开、各块挤压.
  // 注入覆盖 CSS 强制竖排 + 全宽 + 去固定高度让内容撑开, 还原「从上到下铺开」.
  // 只对含 censy-role-wrapper 的卡(白让尘式)生效, 不影响其他卡.
  const ADAPT_CSS = `<style>
  html,body{width:100%!important;height:auto!important;overflow:visible!important}
  /* 顶层容器: 横排 flex 改竖排, 子块全宽依次往下排. 高度 auto 让各子块(立绘卡
     540px / scene-container 600px 等固定高度块)在 column 流里堆叠求和撑开. */
  .censy-role-wrapper{flex-direction:column!important;align-items:center!important;width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important}
  .censy-role-wrapper>*{flex:none!important;margin-left:auto!important;margin-right:auto!important}
  /* 塔容器: 保留作者固定高度(塔靠 absolute 在其中布局, 改 auto 会塌缩),
     只去掉可能的滚动裁切, 让塔身完整显示. */
  .scene-container{overflow:visible!important;margin:0 auto!important}
  </style>`;
  // 这张卡是否是白让尘式(含 censy-role-wrapper). 是则: ① 注入适配 CSS
  // ② iframe 之间去间距(无框感, 连成一体).
  const isCensyReel = components.some((c) =>
    c.content.includes("censy-role-wrapper"),
  );
  const withGlobalCss = (srcdoc: string, independentSource: boolean, sourceCanvas: boolean) => {
    const adapt = srcdoc.includes("censy-role-wrapper") ? ADAPT_CSS : "";
    // Measured public standalone Mufy documents default to this family. The
    // Dearm iframe reset must not silently replace it with system-ui. This is
    // a low-priority document default, before author CSS, not a global font
    // override or a font download. Parent-injected fragments keep their own
    // host inheritance; reply canvases keep their existing skin contract.
    const sourceFont = independentSource && !sourceCanvas && /<(?:html|body)\b|\bdata-nj-doc\b/i.test(srcdoc) &&
      !srcdoc.includes('data-mufy-source-skin') && !srcdoc.includes('data-mufy-rendered-opening')
      ? '<style data-nj-mufy-document-font>body{font-family:"Noto Sans SC"}</style>' : '';
    // This known tabs fragment originally lived in Mufy's border-box parent,
    // not an independent document. Restore only its measured inherited box
    // model before author CSS; do not reset standalone source iframe layouts.
    const parentBox = independentSource && !/<(?:html|body)\b|\bdata-nj-doc\b/i.test(srcdoc) &&
      srcdoc.includes('class="censy-gf-tabs"') && srcdoc.includes('class="censy-gf-details"')
      ? '<style data-nj-mufy-parent-box>.censy-gf-tabs,.censy-gf-tabs *,.censy-gf-tabs *::before,.censy-gf-tabs *::after{box-sizing:border-box}</style>' : '';
    return `${adapt}${sourceFont}${parentBox}${mufyFixedCanvasBoundary(srcdoc,independentSource && !sourceCanvas)}${openingComponentPresentation(srcdoc, sanitizedCss, independentSource)}`;
  };

  return (
    <div
      id="nj_opening_slot"
      className={
        isCensyReel
          ? "nj_opening_slot flex flex-col"
          : "nj_opening_slot flex flex-col gap-[var(--space-md)]"
      }
    >
      <MufyComposerCompanion contents={components.map(component=>component.content)} />
      {components.map((c) => {
        const interpolated = interpolateOpening(c.content, {
          ...ctx,
          slots: c.slotValues,
        });
        // 悬浮段（灵动岛）从内联流里剔除 —— 它们改由 FloatingSlot 挂悬浮层。
        // inline 为 null 说明整个组件都是悬浮件，这里不渲染任何东西。非悬浮段的
        // route 与改动前 routeOpeningContent 逐字节一致（见 routeOpeningContentSplit）。
        const { inline: route } = routeOpeningContentSplit(interpolated, c.id);
        if (route === null) return null;
        if (route.kind === "html") {
          return <MessageRenderer key={c.id} source={route.html} />;
        }
        // 多完整文档小剧场: 每段各自一个 iframe, 垂直堆叠 (多场景形态)
        const srcdocs =
          route.kind === "iframe" ? [route.srcdoc] : route.srcdocs;
        return srcdocs.map((srcdoc, i) => {
          const yanjViewport=parseYanjViewportFragment(srcdoc);
          if(yanjViewport)return <MufyYanjViewport key={`${c.id}-${i}`} widgetKey={`${c.id}-${i}`} spec={yanjViewport}/>;
          const publicMap=parsePublicMap(srcdoc);
          if(publicMap)return <MufyPublicMap key={`${c.id}-${i}`} widgetKey={`${c.id}-${i}`} spec={publicMap}/>;
          const fullscreenStory=parseFullscreenStory(srcdoc);
          if(fullscreenStory)return <MufyFullscreenStory key={`${c.id}-${i}`} widgetKey={`${c.id}-${i}`} spec={fullscreenStory}/>;
          // Style/script-only migration fragments have no visible body. Letting
          // RegexIframe render them would reserve its default height and leave
          // a large blank block below the opening.
          if (!hasRenderableOpeningBody(srcdoc, hasMufyAdaptedComponent([c]))) return null;
          // 白让尘式卡: 跳过「空段」—— ① 寄生悬浮控件 (parent.document 全局注入,
          // 寄情沙箱里失效, 渲染空白框); ② 畸形碎片 (如孤立 </div>). 它们各占一个
          // 空 iframe, 夹在真内容上下造成大段空白. 只对白让尘式生效.
          if (isCensyReel) {
            const visible = srcdoc
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, "")
              .trim();
            const isParasitic =
              /parent\s*\.\s*document/.test(srcdoc) && visible.length < 80;
            const isFragment = srcdoc.trim().length < 30;
            if (isParasitic || isFragment) return null;
          }
          // 内容全是 position:absolute/fixed (脱离文档流), iframe 高度测量必塌缩
          // (body.scrollHeight=0) → 框内滚动. 改用固定高度: 含 censy-role-wrapper
          // (立绘卡 540 + 境界塔容器 600 竖排叠加) 给 1500px; 灵动岛等小段给 340px.
          const fixedHeight = isCensyReel
            ? srcdoc.includes("censy-role-wrapper")
              ? 1500
              : 340
            : undefined;
          return (
            <RegexIframe
              key={`${c.id}-${i}`}
              ruleId={`opening-${c.id}-${i}`}
              ruleName={c.name}
              srcdoc={withGlobalCss(srcdoc, hasMufyAdaptedComponent([c]), /data-mufy-source-skin|data-mufy-rendered-opening/.test(c.content))}
              captureGroups={[]}
              history={history}
              character={character}
              userName={userName}
              onSendMessage={onSendMessage}
              onFillComposer={onFillComposer}
              inlineParentShim={needsMufyInlineParentShim(srcdoc, hasMufyAdaptedComponent([c]))}
              fixedHeight={fixedHeight}
              minHeight={1}
              // 皮肤 <style> 的规则都带 [data-character-css="opening"] 前缀，
              // 宿主属性由 buildIframeSrcdoc 挂到 iframe <body>；不传这个,
              // 注入的皮肤在 iframe 里一条都匹配不上（历史 no-op bug）。
              cssScope="opening"
            />
          );
        });
      })}
    </div>
  );
});
