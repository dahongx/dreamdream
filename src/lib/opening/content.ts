import {parseYanjViewportFragment} from "./yanj-viewport";
import {decodeFloatingSourceGeometry,type FloatingSourceGeometry} from "./floating-source-geometry";
import {parsePublicNoteHeaderComponent} from "./public-note-header";
import {extractPassiveStars,type PassiveStarsSpec} from "./passive-shooting-stars";
/** Restore the measured source document boundary for these fixed canvas families.
 * Do not change general auto-height iframes or author modal permissions. */
export function mufyFixedCanvasBoundary(srcdoc:string,independentSource:boolean):string{
 if(needsMufyInlineParentShim(srcdoc,independentSource))return '';
 if(independentSource&&!/data-mufy-source-skin|data-mufy-rendered-opening/.test(srcdoc)&&/<(?:html|body)\b|\bdata-nj-doc\b/i.test(srcdoc)){
  // Exact public Mufy document setup, not a card/class-name heuristic. Keep
  // this at normal priority: later author CSS must still win the cascade.
  const baseline='html{width:100%;height:fit-content;overflow:hidden;box-sizing:border-box;}body{width:100%;min-height:100%;height:auto;margin:0;padding:0;box-sizing:border-box;}summary{color:white;}';
  const markup=srcdoc.replace(/<!--[\s\S]*?-->/g,'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
  const hasBaseline=[...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].some(m=>m[1].replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,'').toLowerCase().startsWith(baseline));
  if(hasBaseline)return '<style data-nj-mufy-source-canvas-boundary>html{overflow:hidden}body{font-family:"Noto Sans SC";color:rgb(0,0,0)}</style>';
 }
 return independentSource&&!/data-mufy-source-skin|data-mufy-rendered-opening/.test(srcdoc)&&/<(?:html|body)\b|\bdata-nj-doc\b/i.test(srcdoc)&&/html\s*\{[^}]*overflow\s*:\s*hidden\b/i.test(srcdoc)&&/class=["'][^"']*\b(?:cen-archive-desk|ct-status-board-clear|censy-multi-wrap)\b/.test(srcdoc)
  ? '<style data-nj-mufy-fixed-canvas-clip>html{overflow:hidden!important}</style>' : '';
}

/**
 * Opening-component content routing — shared by OpeningSlot (chat render) and
 * the studio form preview.
 *
 * 决策顺序（前提：opening_components 本质是"美化组件"，creator 通常用 HTML
 * 实现，少数情况下用纯文本/markdown 当开场白）：
 *
 *   1. `<artifact>...</artifact>` 整段包络    → iframe (老约定, 显式信封)
 *   2. 含聊天语义标签 (<message>/<narration>/<system>/<scenario>/<think>)
 *                                              → MessageRenderer (走聊天气泡)
 *   3. 含其他 HTML 标签 或外部栅栏          → iframe (默认美化组件)
 *      a. 把所有 ```html / ```svg / ```mermaid / ```markmap 栅栏剥成 inner
 *         (creator 从外部直接复制粘贴的常见形态)
 *      b. 整段当 srcdoc 塞进沙箱
 *   4. 纯文本 / markdown                        → MessageRenderer
 *
 * 历史背景：早期只走 case 1 + 4 —— 外部复制党全部翻车 (HTML 走 sanitize 路径,
 * DOMPurify 剥 <script>/<style>, 美化彻底哑掉, 见 commit 7b5e3b7 的 regex_rules
 * 同款修复). 加 case 3 让 opening_components.content 也兜底, 跟 regex_rules.
 * replacement 行为对齐.
 *
 * Case 2 留给"creator 用聊天语义标签直接写开场对白"的形态 (`<message>"嗯, 你
 * 来了."</message>`), 让它继续走 SEMANTIC_COMPONENTS map 渲染成 AIBubble.
 */

import { extractNativeImageSidebars, mapOutsideNativeImageSidebars, type NativeImageSidebar } from "./native-image-sidebar";
import {extractComposerPrefixes} from "./composer-prefix";

const ARTIFACT_ENVELOPE_RE = /^\s*<artifact>([\s\S]*)<\/artifact>\s*$/i;

/**
 * 「悬浮组件」信封（方案 b，兜底机制）—— creator / backfill 脚本用
 * `<floating pos="top-center" interactive="true">…</floating>` 显式把一段内容
 * 标记为悬浮件。主路径靠 {@link FLOATING_SEGMENT_RE} 自动识别 censy 灵动岛，
 * 前缀不统一的少数卡才需要这个显式信封。属性可选，缺省见 {@link parseFloatingEnvelope}。
 */
const FLOATING_ENVELOPE_RE = /<floating(\s[^>]*)?>([\s\S]*?)<\/floating>/i;

/**
 * 悬浮件自动识别 —— 命中即认为这一段是「灵动岛」类悬浮件（应挂悬浮层，不进
 * 滚动流）。信号来自实查（见 exec-plan「已查实的结构事实」）：censy 灵动岛主体
 * 的顶层容器 `island-container`（含音乐/常见问题/指令），是自包含、零 `parent.`
 * 依赖、在沙箱里能跑的活组件，唯一缺陷是被 iframe 笼住了 fixed 定位。
 *
 * 关键收窄（避免把死段/空壳提上去）：
 *  - **不**认 `cen-nav-wrapper` / `cen-ball-main` —— 那是靠 `parent.document`
 *    注入宿主页的拖动球，我们沙箱里 SecurityError、根本没渲染（见 FLOATING_EXCLUDE_RE）。
 *  - **不**单认 `top-adaptive-dock` —— 它常是灵动岛主体前面一个只含 `<style>` +
 *    空 `<div>` 开壳的 fragment（栅栏把 dock 外壳和 island body 切成两段），
 *    单独提上去是个空框。只认带 `island-container` 的那一段（真身）。
 *  - **不**把裸 `position:fixed` 当信号 —— 演绎内容（境界塔等）也可能用 fixed 做
 *    局部特效，会误伤。
 */
const FLOATING_SEGMENT_RE = /\bisland-container\b|id\s*=\s*["']island["']/i;

/**
 * censy 侧栏识别 —— `<template>` 里包着 `censy-blue-glass-sidebar`（右侧 MENU 抽屉：
 * 表情包/指令栏/排错手册）。它靠 `parent.document.body.appendChild` 注入宿主页，沙箱
 * 里本来渲染不出来 → 需 parent 垫片（PARENT_SHIM_SCRIPT）在 iframe 内自渲染。识别后
 * 提到悬浮层右侧、开 needsShim。侧栏 HTML 本身自包含（<details> 折叠、tab 切换、关闭
 * 按钮都是本地逻辑），shim 把 parent 掰回自身即可跑。
 */
const LEGACY_FLOATING_PATTERNS = [
  {
    kind: "rose-right",
    pos: "right-center",
    re: /\bft-rose-details\b|\binjected-sidebar-wrapper\b/i,
  },
  {
    kind: "ghost-right",
    pos: "right-center",
    // Do not classify a global stylesheet that merely mentions
    // `#injected-ghost-sidebar-root` as a second player. A real ghost player
    // always contains an actual HTML node; the old broad word match produced
    // an invisible duplicate iframe directly on top of the working player.
    re: /<(?:div|aside|section)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:ft-ghost-sidebar|injected-ghost-sidebar-root)\b/i,
  },
  {
    kind: "memory-left",
    pos: "left-center",
    // Only the segment that actually defines the panel/trigger is the floater.
    // Later maintenance scripts repeat the component id but contain no UI.
    re: /\bcensy-panel-[\w-]+|\bc-trig-[\w-]+/i,
  },
  {
    kind: "omni-right",
    pos: "right-center",
    re: /\bcensy-ultimate-hub-v3\b|\bCen_Omni_Wrapper\b|\bCen_Trigger_Zone\b/i,
  },
  {
    kind: "npc-left",
    pos: "left-center",
    re: /\bcen-npc-sidebar-left-v1\b|\bcen_Sx_Sidebar_L\b/i,
  },
  {
    kind: "gold-right",
    pos: "right-center",
    re: /\bcen_gold_(?:trigger|panel)\b/i,
  },
  {
    kind: "orb-right",
    pos: "right-center",
    re: /\bcensy-floatOrb-(?:payload|root)\b/i,
  },
  {
    kind: "details-right",
    pos: "right-center",
    re: /\bcensy-blue-glass-sidebar\b/i,
  },
  {
    kind: "details-right",
    pos: "right-center",
    // 余斯是等卡使用的旧版表情/指令侧栏。只认真实 HTML 节点，避免仅在
    // <style> 选择器里出现类名时把整段普通小剧场误提成悬浮件。
    re: /<(?:div|aside|section|details|button)\b[^>]*(?:class|id)\s*=\s*["'][^"']*\bemoticon-sidebar-(?:container|toggle|panel)\b/i,
  },
] as const satisfies ReadonlyArray<{
  kind: FloatingKind;
  pos: FloatingPos;
  re: RegExp;
}>;

/**
 * 悬浮件排除信号 —— 命中则这一段**不是**能用的悬浮件，绝不提到悬浮层：
 * 靠 `parent.document` / `window.parent` 注入宿主页、但**又不是**已知可救的
 * 侧栏 / 灵动岛的外部原生寄生控件（典型：cen-nav 拖动球，依赖宿主坐标做拖动，
 * shim 也难救、且拖动本就放弃）。这类段留在原路径由 OpeningSlot 的「寄生控件检测」
 * 跳过。注意：侧栏虽含 `parent.document`，但走 needsShim 复活，不在此排除
 * （见 splitOpeningSegments 里的判定顺序）。
 */
const FLOATING_EXCLUDE_RE = /parent\s*\.\s*document|window\s*\.\s*parent/i;

/** Captured public Mufy frames carry a parent-injection bookkeeping wrapper.
 * A real island node outside script/style remains self-contained UI, unlike
 * dead navigation payloads that only mention it inside JavaScript strings. */
function isWrappedIsland(html:string):boolean {
  if(!html.includes('__MUFY_ARTIFACT_BRIDGE__'))return false;
  const markup=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  return /<(?:div|section)\b[^>]*\bid\s*=\s*["']island["']/i.test(markup);
}

export type FloatingPos =
  | "top-center"
  | "top-right"
  | "top-left"
  | "right-center"
  | "left-center"
  | "bottom-center";

/**
 * 悬浮件不是一种布局。Mufy 历史卡至少存在左抽屉、右抽屉、球形控制台、
 * 全屏记忆面板和 details 侧栏；它们的宿主画布尺寸与开合判据都不同。
 * kind 只描述兼容坐标系，不改变作者 HTML/CSS 的视觉设计。
 */
export type FloatingKind =
  | "island"
  | "ornament-right"
  | "warning-top"
  | "rose-right"
  | "ghost-right"
  | "details-right"
  | "npc-left"
  | "gold-right"
  | "omni-right"
  | "memory-left"
  | "orb-right";

export interface FloatingMeta {
  /** Explicit numeric geometry; author binding is rechecked at the opaque widget boundary. */
  sourceGeometry?: FloatingSourceGeometry;
  kind: FloatingKind;
  /** 悬浮件锚点方位。默认 top-center（灵动岛惯例：顶部居中一条）。 */
  pos: FloatingPos;
  /** 是否需要点击交互（音乐播放 / 展开）。灵动岛=true。false=纯展示可全穿透。 */
  interactive: boolean;
  /** 是否需要注入 parent 垫片 —— censy 侧栏这类靠 parent.document 注入宿主页的
   *  寄生控件置 true，让它在 iframe 内自渲染。灵动岛自包含=false。 */
  needsShim?: boolean;
}

const DEFAULT_FLOATING_META: FloatingMeta = {
  kind: "island",
  pos: "top-center",
  interactive: true,
};

/** censy 侧栏的默认悬浮 meta：右侧居中、可交互、需 parent 垫片。 */
const SIDEBAR_FLOATING_META: FloatingMeta = {
  kind: "details-right",
  pos: "right-center",
  interactive: true,
  needsShim: true,
};

const VALID_POS = new Set<FloatingPos>([
  "top-center",
  "top-right",
  "top-left",
  "right-center",
  "left-center",
  "bottom-center",
]);

const VALID_KIND = new Set<FloatingKind>([
  "island",
  "ornament-right",
  "warning-top",
  "rose-right",
  "ghost-right",
  "details-right",
  "npc-left",
  "gold-right",
  "omni-right",
  "memory-left",
  "orb-right",
]);

/**
 * 从 `<floating …>` 开标签属性里解析 pos / interactive，非法值回落默认。
 * 传入的是开标签属性串（FLOATING_ENVELOPE_RE 的 group 1，形如 ` pos="…"`）。
 */
function parseFloatingMeta(attrs: string | undefined): FloatingMeta {
  if (!attrs) return { ...DEFAULT_FLOATING_META };
  const posRaw = extractAttr(`<x${attrs}>`, "pos") as FloatingPos;
  const kindRaw = extractAttr(`<x${attrs}>`, "kind") as FloatingKind;
  const interRaw = extractAttr(`<x${attrs}>`, "interactive");
  const kind = VALID_KIND.has(kindRaw) ? kindRaw : DEFAULT_FLOATING_META.kind;
  const sourceGeometry=kind==='orb-right'?decodeFloatingSourceGeometry(extractAttr(`<x${attrs}>`,'source-geometry-v1')):null;
  return {
    kind,
    ...(sourceGeometry?{sourceGeometry}:{}),
    pos: VALID_POS.has(posRaw) ? posRaw : DEFAULT_FLOATING_META.pos,
    interactive:
      interRaw === ""
        ? DEFAULT_FLOATING_META.interactive
        : interRaw !== "false",
    needsShim: kind !== "island" && kind !== "warning-top" && kind !== "ornament-right" ? true : undefined,
  };
}

function detectLegacyFloatingMeta(html: string): FloatingMeta | undefined {
  if (isViewportPinnedDetailsDrawer(html)) {
    // 抽屉自己声明了 fixed，本意就是钉在视口上；宿主 iframe 已钉在视口，
    // 只要它自成一帧就还原源站行为。开合靠 nj_sidebar 上报（需 shim 通路）。
    return { kind: "details-right", pos: "right-center", interactive: true, needsShim: true };
  }
  if (isSourceImageSidebar(html)) {
    return { ...SIDEBAR_FLOATING_META };
  }
  const match = LEGACY_FLOATING_PATTERNS.find(({ re }) => re.test(html));
  if (!match) return undefined;
  return {
    kind: match.kind,
    pos: match.pos,
    interactive: true,
    needsShim: true,
  };
}

/** Native image-trigger drawer, not a stylesheet mentioning a drawer class.
 * Recognize its actual trigger shell without greedily merging later documents.
 * The nested document payloads require a separately isolated composition path;
 * this classification alone is NOT a full-fidelity acceptance of that drawer.
 */
export function isSourceMemeLibrary(html: string): boolean {
  const markup=html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  return /<div\b[^>]*class\s*=\s*["'][^"']*\bmeme-dock-mini\b/i.test(markup)
    && /class\s*=\s*["'][^"']*\bmeme-trigger-mini\b/i.test(markup)
    && /class\s*=\s*["'][^"']*\bmeme-window-mini\b/i.test(markup);
}

export function isSourceInstructionsSidebar(html: string): boolean {
  const markup=html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  return /<details\b[^>]*class\s*=\s*["'][^"']*\bcensy-ins-trigger\b/i.test(markup)
    && /class\s*=\s*["'][^"']*\bcensy-ins-content\b/i.test(markup);
}

export function isSourceImageSidebar(html: string): boolean {
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  return (
    /<details\b[^>]*class\s*=\s*["'][^"']*\bmufy-side-r\b/i.test(markup) &&
    /<summary\b[^>]*class\s*=\s*["'][^"']*\bmufy-side-btn\b/i.test(markup) &&
    /<img\b[^>]*class\s*=\s*["'][^"']*\bmufy-side-icon\b/i.test(markup) &&
    /<div\b[^>]*class\s*=\s*["'][^"']*\bmufy-side-panel\b/i.test(markup)
  );
}

/**
 * 作者把抽屉钉在视口上（`details.sidebar-container{position:fixed;right:0}`）。
 *
 * 这类抽屉在源站是相对整页 fixed 的；迁移后它和正文共用同一个滚动 iframe，
 * `position:fixed` 只相对 iframe 视口生效 —— 正文一滚，抽屉就被带出了屏幕。
 * 唯一正确处理是把它从文档流里拆出来、挂到悬浮层（宿主 iframe 本身就钉在视口）。
 *
 * 只认**确实声明了 fixed** 的抽屉：作者写在页面流里的普通 `<details>` 折叠块
 * 必须留在原文档，提上去反而错位。
 */
export function isViewportPinnedDetailsDrawer(html: string): boolean {
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  if (
    !/<details\b[^>]*class\s*=\s*["'][^"']*\bsidebar-container\b/i.test(markup) ||
    !/<summary\b[^>]*class\s*=\s*["'][^"']*\bsidebar-toggle\b/i.test(markup)
  ) {
    return false;
  }
  return /(?:details)?\.sidebar-container\s*(?:\[[^\]]*\])?\s*\{[^}]*position\s*:\s*fixed/i.test(
    html.replace(/\/\*[\s\S]*?\*\//g, ""),
  );
}

/**
 * 检测聊天语义标签 (sanitize.ts SEMANTIC_TAGS 子集, 去掉 artifact —— artifact
 * 是包络标签, 不算"语义"). 出现 →走 MessageRenderer 路径让 SEMANTIC_COMPONENTS
 * map 接管.
 */
const SEMANTIC_TAG_RE =
  /<\/?(?:message|mes|narration|nar|system|sys|scenario|sce|think|user|usr)(?:\s[^>]*)?>/i;

/**
 * 「强 HTML 美化组件」信号: 含完整文档外壳 (<!doctype/<html/<body) 或
 * <script>/<style>. 命中 → 内容本质是 HTML 美化组件 (外部小剧场常态),
 * **绝不是**纯聊天语义开场白, 即使内部夹带零星 <think>/<user> 等语义词
 * (例: 作者 CSS 注释里手滑混进 `color: #<think></think>AEAEAE`).
 *
 * 修复: 这类内容若被 SEMANTIC_TAG_RE 误判走 MessageRenderer 内联渲染,
 * 整段 (含 <script>) 会塞进 SSR HTML → React hydration #418 → 详情页
 * 失去交互 (整页卡死、划不动). 强信号优先级高于语义标签, 强制走 iframe.
 */
const STRONG_HTML_COMPONENT_RE =
  /<!doctype\s|<html[\s>]|<body[\s>]|<script[\s>]|<style[\s>]/i;

/**
 * 检测任意 HTML 标签 或外部栅栏开头 (```html / ```svg / ```mermaid /
 * ```markmap). 命中 → 当美化组件走 iframe.
 */
const HTML_OR_FENCE_RE =
  /<[a-zA-Z][a-zA-Z0-9-]*(?:\s|>|\/)|```(?:html|svg|mermaid|markmap)\b/i;

/** This observed inline music player registers autoplay-unlock gestures on
 * parent.document. Keep those gestures in its opaque local document instead.
 * Do not enable sidebar sizing or grant access to the host document.
 */
export function needsMufyInlineParentShim(html:string, imported:boolean):boolean {
  if(!imported)return false;
  const executable=html.replace(/<(style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
  return [...executable.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].some(match=>
    /\bnew\s+CensyStellarPlayerV6\s*\(/.test(match[1])&&
    /window\s*\.\s*parent\s*\.\s*document\s*\.\s*addEventListener\s*\(\s*['"](?:click|touchstart)['"]/.test(match[1])
  );
}

/**
 * 全局剥外部栅栏壳 (```html\n…\n```) 的 pattern —— creator 把外部的栅栏
 * 信封直接粘进 opening content. 用于 {@link splitOpeningSegments} 按栅栏切段.
 * (g flag 在每次 exec 循环里靠新建 RegExp 实例隔离 lastIndex.)
 */
const LEGACY_FENCE_GLOBAL_RE =
  /```(?:html|svg|mermaid|markmap)[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```/g;

/**
 * Older Mufy exports sometimes concatenate the complete emoticon sidebar and
 * the next theater document without a code fence. Treating that whole prefix
 * as one segment moves the theater into the fixed sidebar iframe too. The
 * close-overlay anchor is the stable final node of that legacy sidebar, so it
 * is a safe boundary at which to restore the missing segment split.
 */
const LEGACY_EMOTICON_SIDEBAR_END_RE =
  /<a\b[^>]*class\s*=\s*["'][^"']*\bsidebar-close-overlay\b[^"']*["'][^>]*>\s*<\/a>/i;

/** 扫描一段 CSS 文本的**顶层**规则块，回调 (选择器, 完整块文本)。 */
function forEachTopLevelRule(
  css: string,
  visit: (selector: string, block: string, raw: string) => void,
): void {
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open < 0) return;
    const selector = css.slice(index, open);
    let depth = 0;
    let cursor = open;
    for (; cursor < css.length; cursor += 1) {
      if (css[cursor] === "{") depth += 1;
      else if (css[cursor] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) return;
    const block = css.slice(open + 1, cursor);
    visit(selector.trim(), block, css.slice(index, cursor + 1));
    index = cursor + 1;
  }
}

const DRAWER_SELECTOR_RE = /sidebar-container|sidebar-toggle|emoji-library|emoji-item/i;

/**
 * 把抽屉自己的样式规则抽出来。抽屉要搬到独立 iframe，但它的 CSS 和正文共用
 * 同一批 `<style>` 块 —— 整块搬走会让正文掉样式，整块留下会让抽屉裸奔。
 * 只搬选择器命中抽屉的那几条（含包住它们的 @media / @supports），
 * 作者的其他全局规则（滚动条主题、body 背景）留在原文档。
 */
function extractDrawerCss(piece: string): string {
  const kept: string[] = [];
  for (const styleMatch of piece.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    const css = styleMatch[1].replace(/\/\*[\s\S]*?\*\//g, "");
    forEachTopLevelRule(css, (selector, _block, raw) => {
      if (selector.startsWith("@")) {
        if (!/^@(?:media|supports)\b/i.test(selector)) return;
        // 条件块内再挑一层，命中任何一条就整块搬走。
        const inner: string[] = [];
        forEachTopLevelRule(_block, (s2, _b2, raw2) => {
          if (DRAWER_SELECTOR_RE.test(s2)) inner.push(raw2);
        });
        if (inner.length) kept.push(`${selector}{${inner.join("")}}`);
        return;
      }
      if (DRAWER_SELECTOR_RE.test(selector)) kept.push(raw);
    });
  }
  return kept.join("\n");
}

/** 找到 `<details>` 的开标签下标与配对闭合标签的结束下标（支持嵌套）。 */
function findDetailsSpan(html: string, openIndex: number): [number, number] | null {
  const tagRe = /<(\/?)details\b[^>]*>/gi;
  tagRe.lastIndex = openIndex;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    if (match[1] === "/") {
      depth -= 1;
      if (depth === 0) return [openIndex, match.index + match[0].length];
    } else if (!/\/\s*>$/.test(match[0])) {
      depth += 1;
    }
  }
  return null;
}

/**
 * 把钉在视口上的 `<details class="sidebar-container">` 抽屉从正文里拆出来。
 * 源站在整页铺开的上下文里 `position:fixed` 才成立；迁移进滚动 iframe 之后
 * 它只相对 iframe 视口 fixed，正文一滚就被带出屏幕。拆成独立段后由悬浮层承接，
 * 宿主 iframe 本身钉在视口，抽屉才真正不动。
 */
function splitViewportPinnedDrawer(piece: string): [string, string] | null {
  if (!isViewportPinnedDetailsDrawer(piece)) return null;
  const open = /<details\b[^>]*class\s*=\s*["'][^"']*\bsidebar-container\b/i.exec(piece);
  if (!open) return null;
  const span = findDetailsSpan(piece, open.index);
  if (!span) return null;
  const drawerMarkup = piece.slice(span[0], span[1]);
  const rest = (piece.slice(0, span[0]) + piece.slice(span[1])).trim();
  const drawerCss = extractDrawerCss(piece);
  const drawer = `${drawerCss ? `<style data-mufy-drawer-css>\n${drawerCss}\n</style>\n` : ""}${drawerMarkup}`;
  return [drawer, rest];
}

function splitEmbeddedLegacySidebar(piece: string): string[] {
  // 视口固定的抽屉优先拆：它和正文共处一份文档时，fixed 只会相对滚动容器。
  const drawer = splitViewportPinnedDrawer(piece);
  if (drawer) return drawer[1] ? drawer : [drawer[0]];
  if (
    !/<(?:div|aside|section|button)\b[^>]*(?:class|id)\s*=\s*["'][^"']*\bemoticon-sidebar-(?:container|toggle|panel)\b/i.test(
      piece,
    )
  ) {
    return [piece];
  }
  const end = LEGACY_EMOTICON_SIDEBAR_END_RE.exec(piece);
  if (!end || end.index === undefined) return [piece];
  const boundary = end.index + end[0].length;
  const sidebar = piece.slice(0, boundary);
  const remainder = piece.slice(boundary);
  return remainder.trim() ? [sidebar, remainder] : [piece];
}

/**
 * 完整 HTML 文档判据: 段内含 <!doctype / <html / <body 任一 → 这段是一个
 * 各自独立的完整文档 (外部多场景小剧场的形态), 必须自成一个 iframe; 否则是
 * "片段" (<style>+<div> 散片, 贺韫式), 连续片段合并到一个 iframe 才能让 style
 * 作用到 div.
 */
const FULL_DOCUMENT_RE = /<!doctype\s|<html[\s>]|<body[\s>]/i;

export interface OpeningSegment {
  kind: "fragment" | "document";
  html: string;
  /** 悬浮件元数据 —— 命中 <floating> 信封或 FLOATING_SEGMENT_RE 时置位。
   *  非 null → 这一段是灵动岛类悬浮件，应挂悬浮层而非滚动流。 */
  floating?: FloatingMeta;
}

/**
 * 把 opening content 按 ```html|svg|mermaid|markmap 栅栏 (及栅栏外文本) 切成
 * 有序段, 逐段判 fragment/document, 再把"连续片段"合并. 这是修"多完整文档塞
 * 一个 iframe 导致塌缩"的核心 —— 让每个完整文档段后面各自渲染成独立 iframe.
 *
 * 切段: 维护 lastIndex 遍历全局栅栏正则, 交替产出"栅栏外文本"与"栅栏内 inner",
 * 尾部剩余文本作最后一段. 每段 trim, 空段丢弃.
 *
 * 不闭合栅栏 (```html 无结尾 ```): 非贪婪正则不匹配 → 字面内容连同 ```html 当作
 * 普通文本进片段段, 整体 fall back 为单 fragment, 绝不抛错 / 不产出畸形.
 */
function splitOpeningSegments(content: string): OpeningSegment[] {
  // 新建实例隔离 lastIndex (避免共享全局正则的可重入问题)
  const re = new RegExp(LEGACY_FENCE_GLOBAL_RE.source, "g");
  const raw: string[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null = re.exec(content);
  while (m !== null) {
    // 栅栏外文本 (上一段尾 → 本次匹配头)
    raw.push(content.slice(lastIndex, m.index));
    // 栅栏内 inner
    raw.push(m[1]);
    lastIndex = re.lastIndex;
    m = re.exec(content);
  }
  // 尾部剩余 (含不闭合栅栏的字面内容)
  raw.push(content.slice(lastIndex));

  // Mufy 旧导出可能漏掉侧栏与下一段演绎之间的栅栏，先恢复这个边界。
  const separated = raw.flatMap(splitEmbeddedLegacySidebar);

  // trim + 丢空段 + 分类 + 悬浮识别
  const classified: OpeningSegment[] = [];
  for (const piece of separated) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    // Exact finite inert metadata is a standalone inline program boundary, not author CSS to classify as floating.
    if(parseYanjViewportFragment(trimmed)){classified.push({kind:"document",html:trimmed});continue;}
    // 悬浮识别，判定顺序（先特殊后一般）：
    //  1. 显式 <floating> 信封（creator 明说了就信）
    //  2. censy 侧栏 → 右侧悬浮 + parent 垫片复活（含 parent.document 但可救，
    //     必须在 EXCLUDE 之前判）
    //  3. 灵动岛主体（自包含，不需 shim），但排除 parent 注入的死段（拖动球等）
    const env = FLOATING_ENVELOPE_RE.exec(trimmed);
    const html = env ? env[2].trim() : trimmed;
    let floating: FloatingMeta | undefined;
    if (env) {
      floating = parseFloatingMeta(env[1]);
    } else {
      floating = detectLegacyFloatingMeta(html);
    }
    if (!floating && /\bcensy-blue-glass-sidebar\b/i.test(html)) {
      floating = { ...SIDEBAR_FLOATING_META };
    } else if (!floating && isWrappedIsland(html)) {
      // Existing opaque-origin local shim, never access to the host document.
      floating = { ...DEFAULT_FLOATING_META, needsShim:true };
    } else if (
      !floating &&
      FLOATING_SEGMENT_RE.test(html) &&
      !FLOATING_EXCLUDE_RE.test(html)
    ) {
      floating = { ...DEFAULT_FLOATING_META };
    }
    if (!html) continue;
    // Mufy sometimes exports memory-panel maintenance scripts (sync/delete)
    // as later fenced blocks. They must execute in the same iframe/document as
    // the panel, otherwise parent.document points at an empty sandbox.
    if (
      !floating &&
      /\bcensy_mem_(?:db|hashes)|\bDB_KEY_(?:GHOST|DEL)\b/i.test(html)
    ) {
      const memory = [...classified]
        .reverse()
        .find((segment) => segment.floating?.kind === "memory-left");
      if (memory) {
        memory.html = `${memory.html}\n${html}`;
        continue;
      }
    }
    classified.push({
      kind: FULL_DOCUMENT_RE.test(html) ? "document" : "fragment",
      html,
      floating,
    });
  }

  // 合并连续 fragment（悬浮段不与普通段合并，各自独立挂悬浮层），
  // document 各自独立。
  const merged: OpeningSegment[] = [];
  for (const seg of classified) {
    const prev = merged[merged.length - 1];
    if (
      seg.kind === "fragment" &&
      !seg.floating &&
      prev?.kind === "fragment" &&
      !prev.floating
    ) {
      prev.html = `${prev.html}\n${seg.html}`;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/** 删一个 HTML 开标签上的内联 style / class 属性, 返回属性值 (无则 ""). */
function extractAttr(openTag: string, attr: string): string {
  const m = new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(
    openTag,
  );
  return m ? (m[2] ?? m[3] ?? "") : "";
}

/**
 * 把一个"各自完整的 HTML 文档"扁平化成可安全塞进 iframe (buildIframeSrcdoc 会
 * 再包一层 <!doctype><html><head>{平台 CSP+去框 reset+高度脚本}</head><body>)
 * 的裸 body 级片段. 目标: 消除嵌套 doctype/html/body (浏览器对多 body 解析错乱
 * → 塌缩), 同时保留作者的 <style>/@font-face/<body> 内联布局意图.
 *
 *  - 提取 <head> 内容 (保留 <style>/<link>/<meta>, 但剔除作者自带的 CSP meta,
 *    避免与平台 CSP 双 meta 冲突).
 *  - 提取 <body> 内容; 把 <body> 开标签上的 style/class 迁到包裹 <div data-nj-doc>
 *    —— 江淮卡的布局 (display:flex 等) 若写在 <body> 内联上, 丢了就还会塌. 迁到
 *    div 上既保留布局, 又不再受平台 reset 对 body 的 height/overflow 强制.
 *  - body 内 <style> 在所有浏览器都生效 (HTML5 允许 body 内 style).
 *
 * 降级: 提取不到 <body> (只有 head / 畸形) → 全删 doctype/html/head/body 标签
 * 留 inner, 保证永不产出嵌套文档级标签 (最坏退化为平铺, 不塌缩).
 */
export function flattenDocument(html: string): string {
  const CSP_META_RE =
    /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy[\s\S]*?>/gi;

  const headInner = (/<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? "")
    .replace(CSP_META_RE, "")
    .trim();

  const bodyMatch = /<body([^>]*)>([\s\S]*?)<\/body>/i.exec(html);
  if (!bodyMatch) {
    // 降级: 剥所有文档级外壳标签, 留 inner
    return html
      .replace(/<!doctype[^>]*>/gi, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?head[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "")
      .replace(CSP_META_RE, "")
      .trim();
  }

  const bodyOpenAttrs = bodyMatch[1];
  const bodyInner = bodyMatch[2];
  const style = extractAttr(bodyOpenAttrs, "style");
  const cls = extractAttr(bodyOpenAttrs, "class");
  const wrapperAttrs = [
    "data-nj-doc",
    cls ? `class="${cls}"` : "",
    style ? `style="${style}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const head = headInner ? `${headInner}\n` : "";
  return `${head}<div ${wrapperAttrs}>${bodyInner}</div>${bodyLayoutOnWrapper(html)}`;
}

/**
 * 作者的 `body{display:flex;justify-content:center}` 在扁平化之后必然失效：
 * 正文内容已经不是 body 的直接子节点，中间隔了一层 `<div data-nj-doc>`，
 * flex 作用不到组件上（音乐播放器就是这么贴在左边、宽度按 90% 算错的）。
 *
 * 把 body 上这几个**布局**声明原样搬到包装元素，层级才对得上。只搬布局，
 * 不搬 body 的背景/字体 —— 那些平台 reset 另有约定。
 */
function bodyLayoutOnWrapper(html: string): string {
  const layoutProps = [
    "display",
    "justify-content",
    "align-items",
    "flex-direction",
    "flex-wrap",
    "gap",
  ];
  const decls: string[] = [];
  for (const styleMatch of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    const css = styleMatch[1].replace(/\/\*[\s\S]*?\*\//g, "");
    forEachTopLevelRule(css, (selector, block) => {
      // 只认裸 body；`.foo body` 这类后代选择器搬过来会误伤。
      if (!/^(?:[^{}@]*,\s*)?body\s*(?:,\s*[^{}]*)?$/i.test(selector)) return;
      if (!/display\s*:\s*(?:flex|grid|inline-flex)\b/i.test(block)) return;
      for (const prop of layoutProps) {
        const found = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i").exec(block);
        if (found) decls.push(`${prop}:${found[1].trim()}`);
      }
    });
  }
  if (!decls.length) return "";
  const unique = [...new Set(decls)].join(";");
  return `<style data-mufy-author-body-layout>body>div[data-nj-doc]{${unique}}</style>`;
}

export type OpeningContentRoute =
  | { kind: "iframe"; srcdoc: string }
  | { kind: "iframe-multi"; srcdocs: string[] }
  | { kind: "html"; html: string };

/** 把一个 segment 映射成 iframe srcdoc (document 段扁平化, fragment 段原样). */
function segmentToSrcdoc(seg: OpeningSegment): string {
  return seg.kind === "document" ? flattenDocument(seg.html) : seg.html;
}

export function routeOpeningContent(content: string): OpeningContentRoute {
  // 1. 显式 <artifact> 包络: 解信封后扔 iframe
  const m = ARTIFACT_ENVELOPE_RE.exec(content);
  if (m) return { kind: "iframe", srcdoc: m[1] };

  // 2. 聊天语义标签: 走 MessageRenderer 让 SEMANTIC_COMPONENTS 接管.
  //    但强 HTML 美化信号 (<!doctype/<html/<body/<script/<style) 优先 ——
  //    这类内容是 HTML 美化组件 (外部小剧场), 即使内部夹带零星语义标签词
  //    (如作者 CSS 注释手滑混进的 <think></think>) 也必须走 iframe, 否则
  //    内联渲染含 <script> 的巨型 HTML 会触发 React hydration #418, 详情页
  //    整页卡死. 见 STRONG_HTML_COMPONENT_RE 注释.
  if (
    SEMANTIC_TAG_RE.test(content) &&
    !STRONG_HTML_COMPONENT_RE.test(content)
  ) {
    return { kind: "html", html: content };
  }

  // 3. 含其他 HTML 标签 / 外部栅栏: 当美化组件. 按栅栏切段:
  //    - 全片段 / 单段        → 合并塞一个 iframe (= 旧行为, 贺韫式不回归)
  //    - 多段且含完整文档      → 每段各自一个 iframe (修江淮式多文档塌缩)
  if (HTML_OR_FENCE_RE.test(content)) {
    const segments = splitOpeningSegments(content);
    if (segments.length <= 1) {
      const only = segments[0];
      return {
        kind: "iframe",
        srcdoc: only ? segmentToSrcdoc(only) : content,
      };
    }
    return {
      kind: "iframe-multi",
      srcdocs: segments.map(segmentToSrcdoc),
    };
  }

  // 4. 纯文本 / markdown: MessageRenderer
  return { kind: "html", html: content };
}

export interface FloatingSrcdoc {
  passiveStars?: PassiveStarsSpec;
  /** 稳定 key（componentId + 段序号）。 */
  key: string;
  /** 已扁平化、可直接塞进悬浮 iframe 的 srcdoc。 */
  srcdoc: string;
  meta: FloatingMeta;
  nativeImageSidebar?: NativeImageSidebar;
}

export interface SplitOpeningRoute {
  /** 非悬浮内容的渲染路由 —— 与改动前 routeOpeningContent 的产物**逐字节一致**
   *  （同一批 segment、同一个 segmentToSrcdoc），保证演绎内容渲染零回归。
   *  null = 该组件整体都是悬浮件，OpeningSlot 不渲染任何内联内容。 */
  inline: OpeningContentRoute | null;
  /** 提到悬浮层的灵动岛段。 */
  floating: FloatingSrcdoc[];
}

/**
 * 判断一个已拆分的开场 iframe 是否真的包含可见内容。
 *
 * Mufy 导出常在完整文档后再跟一个只含全局 `<style>` 的围栏。样式已由美化包
 * 注入；为这种尾段单独创建 iframe 只会产生空白。脚本若没有创建任何可见节点，
 * 独处于自己的沙箱 iframe 中也无法影响前一个文档，因此同样不应占位。
 */
export function hasRenderableOpeningBody(srcdoc: string, importedMufyCapture = false): boolean {
  const withoutInertBlocks = srcdoc
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .trim();
  if (!withoutInertBlocks) return false;

  // Public DOM captures can leave Mufy's empty preview wrappers between full
  // documents. They are structure only; rendering them creates a 1px iframe
  // plus the opening-slot gap. Keep arbitrary empty authored divs, which can
  // still carry CSS artwork, and recognize only this exact capture wrapper.
  // Splitting full documents out of an imported component can leave its
  // adaptation marker in another segment and unmatched wrapper boundaries.
  // Provenance comes from the original component, never generic class names.
  if ((srcdoc.includes('data-mufy-adaptation') || importedMufyCapture) &&
      /class=["']w-\[100%\] py-2["']/.test(withoutInertBlocks)) {
    const unwrapped = withoutInertBlocks
      .replace(/<div\s+class=["'](?:w-full|w-\[100%\] py-2)["']\s*>/g, '')
      .replace(/<\/?div\s*>/g, '')
      .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '')
      .trim();
    if (!unwrapped) return false;
  }

  const visibleText = withoutInertBlocks.replace(/<[^>]+>/g, "").trim();
  if (visibleText) return true;

  return /<(?:img|svg|canvas|video|audio|details|summary|div|section|article|button|input|textarea|select)\b/i.test(
    withoutInertBlocks,
  );
}

/**
 * 把一个开场组件的 content 一次性拆成「内联路由」（留滚动流/演绎室）与「悬浮段」
 * （提悬浮层）。**只分段一次**，按 segment 的 floating 标记分流，绝不重建字符串
 * 再重新解析 —— 重解析不幂等，会打乱演绎内容的 iframe 结构（塌缩成小框内滚动）。
 *
 * 内联路由完全复刻 routeOpeningContent 的 case 1/2/4 与 case 3 分段逻辑，唯一
 * 差别是 case 3 里把 floating 段挑走。非悬浮段的 srcdoc 由同一个 segmentToSrcdoc
 * 产出，因此 OpeningSlot 侧的高度 / ADAPT_CSS / 塌缩处理全部与改动前一致。
 */
export function routeOpeningContentSplit(
  content: string,
  componentId: string,
): SplitOpeningRoute {
  if(parsePublicNoteHeaderComponent(content).metadataOnly)return {inline:null,floating:[]};
  const passive=extractPassiveStars(content);
  if(passive.specs.length){
    const remaining=passive.rest.trim()?routeOpeningContentSplit(passive.rest,componentId):{inline:null,floating:[]};
    return {inline:remaining.inline,floating:[...remaining.floating,...passive.specs.map(spec=>({key:componentId+'-passive-stars-'+spec.id,srcdoc:'',meta:{kind:'ornament-right' as const,pos:'top-left' as const,interactive:false},passiveStars:spec}))]};
  }
  const prefix=extractComposerPrefixes(content);
  if(prefix.specs.length)return prefix.rest.trim()?routeOpeningContentSplit(prefix.rest,componentId):{inline:null,floating:[]};
  const native = extractNativeImageSidebars(content);
  if (native.sidebars.length) {
    const remaining = native.rest.trim() ? routeOpeningContentSplit(native.rest, componentId) : { inline: null, floating: [] };
    return { inline: remaining.inline, floating: [...remaining.floating, ...native.sidebars.map((spec, index) => ({key: `${componentId}-native-sidebar-${index}`, srcdoc: "", meta: {...SIDEBAR_FLOATING_META}, nativeImageSidebar: spec}))] };
  }
  // case 1/2/4：artifact 包络 / 语义标签 / 纯文本 —— 不含栅栏多段，无悬浮件，
  // 直接复用 routeOpeningContent，floating 为空。
  if (
    ARTIFACT_ENVELOPE_RE.test(content) ||
    (SEMANTIC_TAG_RE.test(content) &&
      !STRONG_HTML_COMPONENT_RE.test(content)) ||
    !HTML_OR_FENCE_RE.test(content)
  ) {
    return { inline: routeOpeningContent(content), floating: [] };
  }

  // case 3：按栅栏分段，floating 段挑到悬浮层，其余段按原逻辑组 iframe 路由。
  const segments = splitOpeningSegments(content);
  const floating: FloatingSrcdoc[] = [];
  const inlineSegs: OpeningSegment[] = [];
  segments.forEach((seg, i) => {
    if (seg.floating) {
      floating.push({
        key: `${componentId}-f${i}`,
        srcdoc: segmentToSrcdoc(seg),
        meta: seg.floating,
      });
    } else {
      inlineSegs.push(seg);
    }
  });

  let inline: OpeningContentRoute | null;
  if (inlineSegs.length === 0) {
    inline = null;
  } else if (inlineSegs.length === 1) {
    inline = { kind: "iframe", srcdoc: segmentToSrcdoc(inlineSegs[0]) };
  } else {
    inline = { kind: "iframe-multi", srcdocs: inlineSegs.map(segmentToSrcdoc) };
  }
  return { inline, floating };
}

/**
 * 模板变量 token 正则。匹配 {{ token }}，支持所有 Unicode 字母、组合附加符、
 * 数字与下划线，因此繁中、日文假名和泰文槽位名都能稳定提取。
 * `g` 用于全局扫描/替换，调用方按需 clone lastIndex。
 */
const TOKEN_RE = /\{\{\s*([\p{L}\p{M}\p{N}_]+)\s*\}\}/gu;

/** 自动填充的保留字（不算「待角色填」的槽位）。 */
const RESERVED_TOKENS = new Set(["char", "user"]);

/**
 * 扫描开场组件 content，提取创作者挖的「槽位名」——即 {{xxx}} 里排除保留字
 * char/user 之后剩下的 token。去重、保序（按首次出现顺序）。这些槽位由每个角色
 * 在编辑页各自手填。
 */
export function extractOpeningSlots(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // 每次调用用新 RegExp 实例，避免共享 lastIndex 带来的可重入问题。
  const re = new RegExp(TOKEN_RE.source, "gu");
  let m: RegExpExecArray | null = re.exec(content);
  while (m !== null) {
    const key = m[1];
    if (!RESERVED_TOKENS.has(key.toLowerCase()) && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
    m = re.exec(content);
  }
  return out;
}

/**
 * Replace {{char}} / {{user}} + 角色自定义槽位 in opening-component content.
 * Kept here so the client OpeningSlot can call it without pulling the server
 * prompt-builder graph into the bundle.
 *
 * - {{char}} / {{user}} → ctx.char / ctx.user（保留字，自动填）。
 * - {{自定义槽位}} → ctx.slots[槽位]（角色手填的静态值）。
 * - 未提供值的 token 保持原样（不删），便于 studio 预览看到 {{xxx}} 占位、也避免
 *   未填槽位时把标记吞掉。
 */
export function interpolateOpening(
  content: string,
  ctx: { char: string; user: string; slots?: Record<string, string> },
): string {
  const re = new RegExp(TOKEN_RE.source, "gu");
  return mapOutsideNativeImageSidebars(content, part => part.replace(re, (whole, key: string) => {
    const lower = key.toLowerCase();
    if (lower === "char") return ctx.char;
    if (lower === "user") return ctx.user;
    const slot = ctx.slots?.[key];
    return slot !== undefined ? slot : whole;
  }));
}
