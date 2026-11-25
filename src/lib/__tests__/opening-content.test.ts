/**
 * Unit tests for opening-component slot extraction + interpolation.
 * Covers the {{char}}/{{user}} reserved tokens plus creator-defined slots
 * ({{日记正文}} etc.) that each character fills in per-character.
 */

import { describe, expect, test } from "bun:test";
import {platformResetForSrcdoc,PLATFORM_RESET_STYLE_TAG} from '../regex/iframe-bridge';
import {
  extractOpeningSlots,
  mufyFixedCanvasBoundary,
  flattenDocument,
  hasRenderableOpeningBody,
  interpolateOpening,
  needsMufyInlineParentShim,
  isSourceImageSidebar,
  isSourceMemeLibrary,
  isSourceInstructionsSidebar,
  routeOpeningContent,
  routeOpeningContentSplit,
} from "../opening/content";

test('only observed fixed source canvas families recover source html clipping',()=>{
 const original='<html><head><style>html{width:100%;overflow:hidden}</style></head><body><div class="cen-archive-desk"></div></body></html>';
 expect(mufyFixedCanvasBoundary(original,true)).toContain('html{overflow:hidden!important}');
 expect(mufyFixedCanvasBoundary(original.replace('cen-archive-desk','ct-status-board-clear'),true)).toContain('data-nj-mufy-fixed-canvas-clip');
 expect(mufyFixedCanvasBoundary(original.replace('cen-archive-desk','censy-multi-wrap'),true)).toContain('data-nj-mufy-fixed-canvas-clip');
 for(const [html,source] of [[original,false],[original.replace('cen-archive-desk','other'),true],[original.replace('overflow:hidden','overflow:visible'),true],[original+'<style data-mufy-source-skin></style>',true],['<div class="cen-archive-desk"></div>',true]] as const)expect(mufyFixedCanvasBoundary(html,source)).toBe('');
});

test('exact source baseline owns html overflow without overriding later author CSS',()=>{
 const base='<style>html{width:100%;height:fit-content;overflow:hidden;box-sizing:border-box;}body{width:100%;min-height:100%;height:auto;margin:0;padding:0;box-sizing:border-box;}summary{color:white;}</style>';
 const doc='<html><head>'+base+'<style>html{overflow:visible}</style></head><body><div class="unknown-template">public</div></body></html>';
 const marker=mufyFixedCanvasBoundary(doc,true);
 expect(marker).toContain('data-nj-mufy-source-canvas-boundary');
 expect(marker).not.toContain('!important');
 expect(marker).toContain('font-family:"Noto Sans SC"');
 expect(marker).toContain('color:rgb(0,0,0)');
 expect(mufyFixedCanvasBoundary(doc.replace('</style><style>',''),true)).toContain('data-nj-mufy-source-canvas-boundary');
 const reset=platformResetForSrcdoc(marker+doc);
 expect(reset).toContain('height:auto!important');
 expect(reset).toContain('<style>body{overflow:visible!important}</style>');
 expect(reset.replace('<style>body{overflow:visible!important}</style>','')).not.toContain('overflow:visible!important');
 expect(platformResetForSrcdoc(doc)).toBe(PLATFORM_RESET_STYLE_TAG);
 expect(mufyFixedCanvasBoundary(doc,false)).toBe('');
 expect(mufyFixedCanvasBoundary(doc+'<style data-mufy-source-skin></style>',true)).toBe('');
 expect(mufyFixedCanvasBoundary(doc+'<style data-mufy-rendered-opening></style>',true)).toBe('');
 expect(mufyFixedCanvasBoundary('<html><body><script>'+JSON.stringify(base)+'</script></body></html>',true)).toBe('');
 expect(mufyFixedCanvasBoundary('<html><body><!--'+base+'--></body></html>',true)).toBe('');
 const parentProgram=doc.replace('</body>','<script>new CensyStellarPlayerV6();window.parent.document.addEventListener("click",()=>{});</script></body>');
 expect(needsMufyInlineParentShim(parentProgram,true)).toBe(true);
 expect(mufyFixedCanvasBoundary(parentProgram,true)).toBe('');
});

test('native instructions use their actual details shell, never style mentions',()=>{
 const html='<div class="censy-ins-container"><details class="censy-ins-trigger"><summary></summary><div class="censy-ins-content">Instructions</div></details></div>';
 expect(isSourceInstructionsSidebar(html)).toBe(true);
 expect(isSourceInstructionsSidebar('<style>'+html+'</style>')).toBe(false);
 expect(isSourceInstructionsSidebar('<script>var fake='+JSON.stringify(html)+'</script>')).toBe(false);
 expect(isSourceInstructionsSidebar(html.replace('censy-ins-content','other'))).toBe(false);
});

test('static source ornament is a separate noninteractive floating document without parent access',()=>{
 const html='<floating kind="ornament-right" pos="top-right" interactive="false"><div class="censy-hanging-ornament"><img src="https://example.com/public.png"></div></floating>';
 const routed=routeOpeningContentSplit(html,'ornament');
 expect(routed.inline).toBeNull();expect(routed.floating).toHaveLength(1);
 expect(routed.floating[0].meta).toEqual({kind:'ornament-right',pos:'top-right',interactive:false,needsShim:undefined});
});

test('meme-library viewport requires real public drawer markup, not CSS or script mentions',()=>{
 const markup='<div class="meme-dock-mini"><div class="meme-trigger-mini"></div><div class="meme-window-mini">library</div></div>';
 expect(isSourceMemeLibrary(markup)).toBe(true);
 expect(isSourceMemeLibrary('<style>'+markup+'</style>')).toBe(false);
 expect(isSourceMemeLibrary('<script>var fake='+JSON.stringify(markup)+'</script>')).toBe(false);
 expect(isSourceMemeLibrary(markup.replace('meme-window-mini','other'))).toBe(false);
 const routed=routeOpeningContentSplit('<floating kind="details-right">'+markup+'</floating>','fixture');
 expect(routed.inline).toBeNull();
 expect(routed.floating).toHaveLength(1);
 expect(routed.floating[0].meta.needsShim).toBe(true);
});

test('only the observed imported inline music player gets a local parent alias',()=>{
 const script='<script>class CensyStellarPlayerV6{};window.parent.document.addEventListener("click",unlockAudio,true);new CensyStellarPlayerV6();</script>';
 expect(needsMufyInlineParentShim(script,true)).toBe(true);
 expect(needsMufyInlineParentShim(script,false)).toBe(false);
 expect(needsMufyInlineParentShim('<style>'+script+'</style>',true)).toBe(false);
 expect(needsMufyInlineParentShim('<script>window.parent.document.body.appendChild(widget)</script>',true)).toBe(false);
 expect(needsMufyInlineParentShim(script.replace('new CensyStellarPlayerV6()','/* class not bootstrapped */'),true)).toBe(false);
});

describe("native image-trigger sidebar", () => {
  const drawer = '<details class="mufy-side-r"><summary class="mufy-side-btn"><img src="https://example.com/original.png" class="mufy-side-icon"></summary><div class="mufy-side-panel"><div class="mufy-side-inner">';
  test("recognizes the real fragment without swallowing later independent documents", () => {
    const content = `${drawer}\n\`\`\`html\n<!doctype html><html><body><div class="music">music</div></body></html>\n\`\`\`\n</div></div></details>\n\`\`\`html\n<!doctype html><html><body><div class="network">friends</div></body></html>\n\`\`\``;
    const result = routeOpeningContentSplit(content, "native-drawer");
    expect(result.floating).toHaveLength(1);
    expect(result.floating[0].meta.kind).toBe("details-right");
    expect(result.floating[0].srcdoc).toContain("original.png");
    expect(result.floating[0].srcdoc).not.toContain('class="music"');
    expect(result.floating[0].srcdoc).not.toContain('class="network"');
    expect(result.inline?.kind).toBe("iframe-multi");
    expect(JSON.stringify(result.inline)).toContain("music");
    expect(JSON.stringify(result.inline)).toContain("friends");
  });
  test("does not promote CSS mentions, script strings, or ordinary image cards", () => {
    expect(isSourceImageSidebar(drawer)).toBe(true);
    for (const content of [
      '<style>.mufy-side-r .mufy-side-btn .mufy-side-icon .mufy-side-panel{}</style><p>scene</p>',
      `<script>const html = ${JSON.stringify(drawer)};</script>`,
      '<div class="mufy-side-r"><img class="mufy-side-icon"></div>',
    ]) {
      expect(isSourceImageSidebar(content)).toBe(false);
      expect(routeOpeningContentSplit(content, "not-drawer").floating).toHaveLength(0);
    }
  });
});

describe("hasRenderableOpeningBody", () => {
  test("drops a style-only Mufy tail segment", () => {
    expect(
      hasRenderableOpeningBody(
        "<!-- global skin -->\n<style>.card{color:red}</style>",
      ),
    ).toBe(false);
  });

  test("drops a script-only isolated segment", () => {
    expect(
      hasRenderableOpeningBody("<script>window.__AWAKE_ME__=true</script>"),
    ).toBe(false);
  });

  test("keeps visible text and interactive markup", () => {
    expect(hasRenderableOpeningBody("<div>开场白选择</div>")).toBe(true);
    expect(
      hasRenderableOpeningBody("<details><summary></summary></details>"),
    ).toBe(true);
  });

  test("drops only empty imported preview wrappers and retains author artwork", () => {
    const marker = '<style data-mufy-adaptation="mobile-box-model">body{height:auto}</style>';
    const wrappers = '<div><div class="w-full"><div class="w-[100%] py-2">';
    expect(hasRenderableOpeningBody(marker + wrappers)).toBe(false);
    expect(hasRenderableOpeningBody(marker + '</div></div></div>' + wrappers)).toBe(false);
    expect(hasRenderableOpeningBody(marker + wrappers + '<img src="https://example.com/image.png">')).toBe(true);
    expect(hasRenderableOpeningBody(marker + wrappers + '<div class="author-art"></div>')).toBe(true);
    expect(hasRenderableOpeningBody('<div class="author-art"></div>')).toBe(true);
    expect(hasRenderableOpeningBody(wrappers)).toBe(true);
    // Real rank42 public DOM: the splitter leaves the adaptation marker in a
    // neighboring document, while this complete empty chain becomes a1px frame.
    expect(hasRenderableOpeningBody(wrappers + '\n\n</div></div></div>')).toBe(true);
    expect(hasRenderableOpeningBody(wrappers, true)).toBe(false);
    expect(hasRenderableOpeningBody(wrappers + '\n\n</div></div></div>', true)).toBe(false);
    expect(hasRenderableOpeningBody(wrappers + '<div class="author-art"></div></div></div></div>')).toBe(true);
    expect(hasRenderableOpeningBody('<div class="w-[100%] py-2"></div>')).toBe(true);
  });
});

describe("extractOpeningSlots", () => {
  test("returns empty for no tokens", () => {
    expect(extractOpeningSlots("plain text")).toEqual([]);
  });

  test("excludes reserved char/user tokens", () => {
    expect(extractOpeningSlots("hi {{char}} from {{user}}")).toEqual([]);
  });

  test("extracts custom slots, excluding reserved", () => {
    expect(
      extractOpeningSlots("{{char}} 写道：{{日记正文}}，日期 {{日记日期}}"),
    ).toEqual(["日记正文", "日记日期"]);
  });

  test("dedupes and preserves first-seen order", () => {
    expect(extractOpeningSlots("{{b}} {{a}} {{b}} {{a}} {{c}}")).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  test("tolerates inner whitespace", () => {
    expect(extractOpeningSlots("{{  标题  }}")).toEqual(["标题"]);
  });

  test("supports Traditional Chinese, Japanese kana, and Thai slot names", () => {
    expect(
      extractOpeningSlots("{{日記正文}} {{キャラクター紹介}} {{เนื้อหาไดอารี่}}"),
    ).toEqual(["日記正文", "キャラクター紹介", "เนื้อหาไดอารี่"]);
  });

  test("ignores reserved tokens case-insensitively", () => {
    expect(extractOpeningSlots("{{Char}} {{USER}} {{x}}")).toEqual(["x"]);
  });
});

describe("interpolateOpening", () => {
  const ctx = { char: "苏然", user: "玩家" };

  test("replaces char/user", () => {
    expect(interpolateOpening("我是{{char}}，你好{{user}}", ctx)).toBe(
      "我是苏然，你好玩家",
    );
  });

  test("replaces custom slots from slots map", () => {
    expect(
      interpolateOpening("日记：{{日记正文}}", {
        ...ctx,
        slots: { 日记正文: "今天加班到很晚" },
      }),
    ).toBe("日记：今天加班到很晚");
  });

  test("replaces Japanese and Thai custom slots", () => {
    expect(
      interpolateOpening("{{キャラクター紹介}} / {{ความรู้สึก}}", {
        ...ctx,
        slots: {
          キャラクター紹介: "夜の案内人",
          ความรู้สึก: "คิดถึง",
        },
      }),
    ).toBe("夜の案内人 / คิดถึง");
  });

  test("leaves unknown/unfilled tokens unchanged", () => {
    expect(interpolateOpening("待填：{{日记正文}}", ctx)).toBe(
      "待填：{{日记正文}}",
    );
  });

  test("char/user win over slots with same name (reserved)", () => {
    expect(
      interpolateOpening("{{char}}", {
        ...ctx,
        slots: { char: "不应生效" },
      }),
    ).toBe("苏然");
  });

  test("mixes reserved + slots + unfilled", () => {
    expect(
      interpolateOpening("{{char}}的{{标题}}：{{正文}}", {
        ...ctx,
        slots: { 标题: "值班记录" },
      }),
    ).toBe("苏然的值班记录：{{正文}}");
  });
});

describe("routeOpeningContent", () => {
  test("explicit <artifact> envelope unwraps to iframe srcdoc", () => {
    const r = routeOpeningContent("<artifact><div>hi</div></artifact>");
    expect(r.kind).toBe("iframe");
    if (r.kind === "iframe") expect(r.srcdoc).toBe("<div>hi</div>");
  });

  test("plain text routes to MessageRenderer (markdown path)", () => {
    const r = routeOpeningContent("你站在街角，雨下得很大。\n他递过来一把伞。");
    expect(r.kind).toBe("html");
  });

  test("markdown without raw HTML routes to MessageRenderer", () => {
    const r = routeOpeningContent("# 章节一\n\n**粗体** 与 _斜体_");
    expect(r.kind).toBe("html");
  });

  test("chat semantic tag (<message>) stays on MessageRenderer", () => {
    // creator 用聊天语义标签直接写开场对白, 应该走 SEMANTIC_COMPONENTS map
    const r = routeOpeningContent('<message>"嗯, 你来了。"</message>');
    expect(r.kind).toBe("html");
  });

  test("<narration> stays on MessageRenderer too", () => {
    const r = routeOpeningContent("<narration>夜很深。</narration>");
    expect(r.kind).toBe("html");
  });

  test("<user>/<usr> (post-0506cee 玩家台词标签) stays on MessageRenderer", () => {
    // 谢寻式的"开场预设玩家反应"形态: 走 UserBubbleFromTag, 不能误判为美化
    expect(
      routeOpeningContent('<user>"项链很好看, 谢谢老公。"</user>').kind,
    ).toBe("html");
    expect(routeOpeningContent("<usr>嗯。</usr>").kind).toBe("html");
  });

  test("raw HTML (external copy-paste, no envelope) routes to iframe", () => {
    // 贺韫 case: <div> 开头, 不是 <artifact> 包络 —— 不再走坏的 sanitize 路径
    const r = routeOpeningContent(
      '<div class="mag-silver-wrapper"><h3>贺韫</h3></div>',
    );
    expect(r.kind).toBe("iframe");
  });

  test("HTML 美化组件夹带零星语义标签 → 仍走 iframe (白让尘卡死回归)", () => {
    // 白让尘 case: 作者 CSS 注释手滑混进 `color: #<think></think>AEAEAE`,
    // 整个 117KB 小剧场含 <script>/<style>/<!doctype>. 旧逻辑被 <think> 命中
    // SEMANTIC_TAG_RE → 走 MessageRenderer 内联渲染 → React hydration #418 →
    // 详情页整页卡死. 强 HTML 信号必须压过语义标签, 强制走 iframe.
    const css注释含think = routeOpeningContent(
      "<style>.x{color:#<think></think>AEAEAE}</style><script>var a=1</script><div>菜单</div>",
    );
    expect(css注释含think.kind).toBe("iframe");

    const 完整文档含user = routeOpeningContent(
      "<!doctype html><html><body><div>对话</div><user>占位</user></body></html>",
    );
    expect(完整文档含user.kind).not.toBe("html");
  });

  test("standalone <style> block routes to iframe", () => {
    const r = routeOpeningContent("<style>.x{color:red}</style>");
    expect(r.kind).toBe("iframe");
  });

  test("single fence: unwrapped to inner HTML, then iframe", () => {
    // ```html\n…\n``` 整段单一栅栏: 剥栅栏后整段塞 srcdoc, 字面 ``` 不泄漏
    const r = routeOpeningContent("```html\n<div>hi</div>\n```");
    expect(r.kind).toBe("iframe");
    if (r.kind === "iframe") {
      expect(r.srcdoc).toBe("<div>hi</div>");
      expect(r.srcdoc).not.toContain("```");
    }
  });

  test("mixed: HTML body + style + fenced script all merge into one iframe", () => {
    // 贺韫真实 case 的最小复现: <div>body</div> + <style>…</style> +
    // ```html\n<template>…</template>\n``` 三段, 期望: 栅栏剥壳, 整段合并塞
    // 同一个 iframe document, 字面 ``` 不出现在 srcdoc.
    const content = [
      "<div>主块</div>",
      "",
      "<style>.x{color:red}</style>",
      "",
      "```html",
      "<template>x</template>",
      "```",
    ].join("\n");
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe");
    if (r.kind === "iframe") {
      expect(r.srcdoc).toContain("<div>主块</div>");
      expect(r.srcdoc).toContain("<style>.x{color:red}</style>");
      expect(r.srcdoc).toContain("<template>x</template>");
      expect(r.srcdoc).not.toContain("```");
    }
  });

  test("svg/mermaid/markmap fences also unwrap", () => {
    const r = routeOpeningContent("```svg\n<svg></svg>\n```");
    expect(r.kind).toBe("iframe");
    if (r.kind === "iframe") expect(r.srcdoc).toBe("<svg></svg>");
  });
});

// 完整 HTML 文档片段构造器: 各自带 doctype/html/head>style/body
function fullDoc(opts: {
  style?: string;
  bodyAttrs?: string;
  body: string;
  head?: string;
}): string {
  return [
    "```html",
    "<!DOCTYPE html>",
    '<html lang="zh-CN">',
    `<head>${opts.head ?? ""}<style>${opts.style ?? ".x{color:red}"}</style></head>`,
    `<body${opts.bodyAttrs ?? ""}>${opts.body}</body>`,
    "</html>",
    "```",
  ].join("\n");
}

describe("routeOpeningContent — 多文档小剧场 (江淮 case)", () => {
  // 类型1 回归保护: 纯片段多栅栏 → 合并成单 iframe, 不是 multi
  test("类型1: 6 个 style+div 片段栅栏 → 单 iframe (合并, 非 multi)", () => {
    const content = Array.from({ length: 6 }, (_, i) =>
      [
        "```html",
        `<style>.s${i}{color:red}</style>`,
        `<div>块${i}</div>`,
        "```",
      ].join("\n"),
    ).join("\n\n");
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe");
    if (r.kind === "iframe") {
      expect(r.srcdoc).toContain("<div>块0</div>");
      expect(r.srcdoc).toContain("<div>块5</div>");
      expect(r.srcdoc).toContain(".s3{color:red}");
      expect(r.srcdoc).not.toContain("```");
      expect(r.srcdoc).not.toContain("<!DOCTYPE");
    }
  });

  // 类型2: 多完整文档 → 每段各自一个 iframe
  test("类型2: 2 个完整文档 → iframe-multi, srcdocs.length===2", () => {
    const content = `${fullDoc({ style: ".a{}", body: "<p>场景一</p>" })}\n\n${fullDoc(
      { style: ".b{}", body: "<p>场景二</p>" },
    )}`;
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe-multi");
    if (r.kind === "iframe-multi") {
      expect(r.srcdocs.length).toBe(2);
      // 每段已扁平化: 无嵌套 doctype/html/body
      for (const s of r.srcdocs) {
        expect(s.toLowerCase()).not.toContain("<!doctype");
        expect(s.toLowerCase()).not.toContain("<html");
        expect(s.toLowerCase()).not.toContain("<body");
      }
      // 各段保留自己的 style 与 body 内容
      expect(r.srcdocs[0]).toContain(".a{}");
      expect(r.srcdocs[0]).toContain("<p>场景一</p>");
      expect(r.srcdocs[1]).toContain(".b{}");
      expect(r.srcdocs[1]).toContain("<p>场景二</p>");
    }
  });

  test("类型2: <body style> 的内联样式迁移到包裹 div", () => {
    const content = `${fullDoc({
      bodyAttrs: ' style="display:flex;flex-direction:column"',
      body: "<p>x</p>",
    })}\n\n${fullDoc({ body: "<p>y</p>" })}`;
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe-multi");
    if (r.kind === "iframe-multi") {
      expect(r.srcdocs[0]).toContain("display:flex");
      expect(r.srcdocs[0]).toContain("flex-direction:column");
      expect(r.srcdocs[0]).toContain("data-nj-doc");
    }
  });

  test("类型2: 作者自带 CSP meta 被剔除", () => {
    const content = `${fullDoc({
      head: '<meta http-equiv="Content-Security-Policy" content="default-src none">',
      body: "<p>x</p>",
    })}\n\n${fullDoc({ body: "<p>y</p>" })}`;
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe-multi");
    if (r.kind === "iframe-multi") {
      expect(r.srcdocs[0].toLowerCase()).not.toContain(
        "content-security-policy",
      );
    }
  });

  // 类型3: 片段 + 完整文档混合
  test("类型3: 3 片段 + 末 1 完整文档 → iframe-multi length===2", () => {
    const fragments = Array.from({ length: 3 }, (_, i) =>
      ["```html", `<div>片段${i}</div>`, "```"].join("\n"),
    ).join("\n\n");
    const content = `${fragments}\n\n${fullDoc({ body: "<p>档案</p>" })}`;
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe-multi");
    if (r.kind === "iframe-multi") {
      expect(r.srcdocs.length).toBe(2);
      // 片段段: 3 段合并
      expect(r.srcdocs[0]).toContain("<div>片段0</div>");
      expect(r.srcdocs[0]).toContain("<div>片段2</div>");
      // 文档段: 扁平化
      expect(r.srcdocs[1]).toContain("<p>档案</p>");
      expect(r.srcdocs[1].toLowerCase()).not.toContain("<body");
    }
  });

  test("类型3: 片段-文档-片段 → 顺序保留, length===3", () => {
    const content = [
      "```html\n<div>前</div>\n```",
      fullDoc({ body: "<p>中</p>" }),
      "```html\n<div>后</div>\n```",
    ].join("\n\n");
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe-multi");
    if (r.kind === "iframe-multi") {
      expect(r.srcdocs.length).toBe(3);
      expect(r.srcdocs[0]).toContain("<div>前</div>");
      expect(r.srcdocs[1]).toContain("<p>中</p>");
      expect(r.srcdocs[2]).toContain("<div>后</div>");
    }
  });

  // 边界
  test("边界: 单个裸完整文档 (无栅栏) → 单 iframe, 扁平化无嵌套", () => {
    const content =
      '<!DOCTYPE html><html><head><style>.z{}</style></head><body style="display:flex"><p>独</p></body></html>';
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe");
    if (r.kind === "iframe") {
      expect(r.srcdoc).toContain("<p>独</p>");
      expect(r.srcdoc).toContain(".z{}");
      expect(r.srcdoc).toContain("display:flex");
      expect(r.srcdoc.toLowerCase()).not.toContain("<body");
      expect(r.srcdoc.toLowerCase()).not.toContain("<!doctype");
    }
  });

  test("边界: 不闭合栅栏不抛错, fall back 单 iframe", () => {
    const content = "```html\n<div>没闭合</div>";
    expect(() => routeOpeningContent(content)).not.toThrow();
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe");
  });

  test("边界: 空段 (连续栅栏间空白) 不产生空 srcdoc", () => {
    const content = `${fullDoc({ body: "<p>a</p>" })}\n\n\n\n${fullDoc({
      body: "<p>b</p>",
    })}`;
    const r = routeOpeningContent(content);
    expect(r.kind).toBe("iframe-multi");
    if (r.kind === "iframe-multi") {
      expect(r.srcdocs.length).toBe(2);
      for (const s of r.srcdocs) expect(s.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("routeOpeningContentSplit — 灵动岛悬浮分流", () => {
  // 灵动岛主体片段（自包含文档，含 island-container + 音乐，零 parent.）。
  const islandDoc = [
    "```html",
    "<!DOCTYPE html><html><head><style>.island-container{position:relative}</style></head>",
    '<body><div class="island-container" id="island"><script>const audio=new Audio()</script></div></body></html>',
    "```",
  ].join("\n");

  test("识别 island-container 段为悬浮件，从内联流剔除", () => {
    const r = routeOpeningContentSplit(islandDoc, "c1");
    expect(r.floating.length).toBe(1);
    expect(r.floating[0].meta.pos).toBe("top-center");
    expect(r.floating[0].srcdoc).toContain("island-container");
    // 整个组件都是悬浮件 → 内联无内容
    expect(r.inline).toBeNull();
  });

  test("演绎内容 + 灵动岛混合：演绎留内联，岛提悬浮", () => {
    const reel = fullDoc({ style: ".char{}", body: "<p>立绘</p>" });
    const r = routeOpeningContentSplit(`${reel}\n\n${islandDoc}`, "c2");
    expect(r.floating.length).toBe(1);
    expect(r.floating[0].srcdoc).toContain("island-container");
    // 演绎段仍在内联，且不含灵动岛
    expect(r.inline).not.toBeNull();
    const inlineDocs =
      r.inline?.kind === "iframe-multi"
        ? r.inline.srcdocs
        : r.inline?.kind === "iframe"
          ? [r.inline.srcdoc]
          : [];
    expect(inlineDocs.length).toBe(1);
    expect(inlineDocs[0]).toContain("<p>立绘</p>");
    expect(inlineDocs[0]).not.toContain("island-container");
  });

  test("公开来源包装不应把真实灵动岛误判为死组件",()=>{
    const wrapped='```html\n<script>var p=window.parent; var key="__MUFY_ARTIFACT_BRIDGE__";</script><div class="island-container" id="island">Music</div>\n```';
    const result=routeOpeningContentSplit(wrapped,'wrapped-island');
    expect(result.floating).toHaveLength(1);
    expect(result.floating[0].meta).toMatchObject({kind:'island',needsShim:true});
    const scriptOnly='```html\n<script>var p=window.parent; var key="__MUFY_ARTIFACT_BRIDGE__"; const html=`<div id="island">dead</div>`;</script>\n```';
    expect(routeOpeningContentSplit(scriptOnly,'dead-payload').floating).toHaveLength(0);
  });

  test("排除 parent.document 注入的死组件（不提悬浮）", () => {
    // cen-nav 拖动球：靠 parent.document.body.appendChild 注入，沙箱里 SecurityError
    // 根本没渲染。即使含 island 字样也不能当悬浮件提上去。
    const deadInject = [
      "```html",
      "<script>if(parent.document.getElementById('x'))return;",
      'const h=`<div class="island-container">ball</div>`;',
      "parent.document.body.appendChild(h)</script>",
      "```",
    ].join("\n");
    const r = routeOpeningContentSplit(deadInject, "c3");
    expect(r.floating.length).toBe(0);
  });

  test("censy 侧栏：识别为 right-center 悬浮 + needsShim（含 parent.document 也不排除）", () => {
    // 侧栏靠 parent.document.body.appendChild 注入，需 shim 复活；不能被
    // FLOATING_EXCLUDE_RE 当死件排除。
    const sidebar = [
      "```html",
      "<template id='luludawang-censybaby'>",
      "<details class='censy-blue-glass-sidebar' id='censy-permanent-node'><summary></summary></details>",
      "</template>",
      "<script>const h=document.getElementById('luludawang-censybaby').innerHTML;",
      "window.parent.document.body.appendChild(document.createRange().createContextualFragment(h))</script>",
      "```",
    ].join("\n");
    const r = routeOpeningContentSplit(sidebar, "c-sb");
    expect(r.floating.length).toBe(1);
    expect(r.floating[0].meta.pos).toBe("right-center");
    expect(r.floating[0].meta.kind).toBe("details-right");
    expect(r.floating[0].meta.needsShim).toBe(true);
    // 侧栏从内联流剔除（不再在演绎室/消息流留坏的一份）
    expect(r.inline).toBeNull();
  });

  test("兼容旧版 NPC 左侧栏标识并启用 parent shim", () => {
    const sidebar = [
      "```html",
      "<script>const Z_CONFIG_NPC_L='cen-npc-sidebar-left-v1';",
      "const html=`<div id='cen_Sx_Sidebar_L'></div>`;",
      "window.parent.document.body.appendChild(document.createRange().createContextualFragment(html));</script>",
      "```",
    ].join("\n");
    const r = routeOpeningContentSplit(sidebar, "c-old-npc");
    expect(r.floating.length).toBe(1);
    expect(r.floating[0].meta.pos).toBe("left-center");
    expect(r.floating[0].meta.kind).toBe("npc-left");
    expect(r.floating[0].meta.needsShim).toBe(true);
    expect(r.inline).toBeNull();
  });

  test("兼容旧版风金侧栏标识并启用 parent shim", () => {
    const sidebar = [
      "```html",
      "<script>const html=`<button id='cen_gold_trigger'></button><aside id='cen_gold_panel'></aside>`;",
      "window.parent.document.body.appendChild(document.createRange().createContextualFragment(html));</script>",
      "```",
    ].join("\n");
    const r = routeOpeningContentSplit(sidebar, "c-gold");
    expect(r.floating.length).toBe(1);
    expect(r.floating[0].meta.pos).toBe("right-center");
    expect(r.floating[0].meta.kind).toBe("gold-right");
    expect(r.floating[0].meta.needsShim).toBe(true);
    expect(r.inline).toBeNull();
  });

  test("兼容旧版悬浮音乐球并启用 parent shim", () => {
    const orb = [
      "```html",
      "<template id='censy-floatOrb-payload'><div id='censy-floatOrb-root'></div></template>",
      "<script>window.parent.document.body.appendChild(document.createRange().createContextualFragment(document.getElementById('censy-floatOrb-payload').innerHTML));</script>",
      "```",
    ].join("\n");
    const r = routeOpeningContentSplit(orb, "c-orb");
    expect(r.floating.length).toBe(1);
    expect(r.floating[0].meta.pos).toBe("right-center");
    expect(r.floating[0].meta.kind).toBe("orb-right");
    expect(r.floating[0].meta.needsShim).toBe(true);
    expect(r.inline).toBeNull();
  });

  test("recognizes Mufy omni hub and memory drawer as distinct floaters", () => {
    const omni =
      "```html\n<div id='Cen_Omni_Wrapper' class='censy-ultimate-hub-v3'></div>\n```";
    const memory =
      "```html\n<div class='censy-cyber-mem-YCY1107'><button class='c-trig-YCY1107'></button><aside class='censy-panel-YCY1107'></aside></div>\n```";
    const result = routeOpeningContentSplit(
      `${omni}\n${memory}`,
      "c-multi-float",
    );
    expect(result.floating).toHaveLength(2);
    expect(result.floating.map((item) => item.meta.kind)).toEqual([
      "omni-right",
      "memory-left",
    ]);
    expect(result.floating[1].meta.pos).toBe("left-center");
  });

  test("侧栏 + 灵动岛混合：各自识别，侧栏 needsShim、岛不需", () => {
    const sidebar =
      "```html\n<template><details class='censy-blue-glass-sidebar'></details></template><script>window.parent.document.body.appendChild(x)</script>\n```";
    const island =
      "```html\n<!DOCTYPE html><html><body><div class='island-container' id='island'></div></body></html>\n```";
    const r = routeOpeningContentSplit(`${sidebar}\n\n${island}`, "c-mix");
    expect(r.floating.length).toBe(2);
    const sb = r.floating.find((f) => f.meta.needsShim);
    const isl = r.floating.find((f) => !f.meta.needsShim);
    expect(sb?.meta.pos).toBe("right-center");
    expect(isl?.meta.pos).toBe("top-center");
  });

  test("显式 <floating> 信封：解析 pos / interactive", () => {
    const content = [
      "```html",
      '<floating pos="right-center" interactive="false"><div>侧栏</div></floating>',
      "```",
    ].join("\n");
    const r = routeOpeningContentSplit(content, "c4");
    expect(r.floating.length).toBe(1);
    expect(r.floating[0].meta.pos).toBe("right-center");
    expect(r.floating[0].meta.interactive).toBe(false);
    expect(r.floating[0].srcdoc).toContain("<div>侧栏</div>");
  });

  test("显式信封保留顶部警示栏和两类沈知衡运行态侧栏类型", () => {
    const warning = routeOpeningContentSplit(
      '```html\n<floating kind="warning-top" pos="top-center" interactive="false"><div class="z-dropdown">提示</div></floating>\n```',
      "warning",
    );
    expect(warning.floating[0].meta).toEqual({
      kind: "warning-top",
      pos: "top-center",
      interactive: false,
      needsShim: undefined,
    });

    const sidebars = routeOpeningContentSplit(
      "```html\n<div id='injected-sidebar-wrapper'><details class='ft-rose-details'></details></div>\n```\n```html\n<div id='injected-ghost-sidebar-root'><div class='ft-ghost-sidebar'></div></div>\n```",
      "shen-runtime",
    );
    expect(sidebars.floating.map((item) => item.meta.kind)).toEqual([
      "rose-right",
      "ghost-right",
    ]);
    expect(sidebars.floating.every((item) => item.meta.needsShim)).toBe(true);
    expect(sidebars.inline).toBeNull();
  });

  test("CSS selector mentioning the ghost root does not create a duplicate player", () => {
    const result = routeOpeningContentSplit(
      "<style>#injected-ghost-sidebar-root{display:contents!important}</style><div class='scene-card'>正文</div>",
      "ghost-css-only",
    );
    expect(result.floating).toHaveLength(0);
    expect(result.inline).not.toBeNull();
  });

  test("识别旧版表情/指令侧栏，但不把纯 CSS 选择器误判为悬浮件", () => {
    const sidebar = [
      "<style>.emoticon-sidebar-container{position:fixed;right:-360px}</style>",
      "<div class='emoticon-sidebar-container'><button class='emoticon-sidebar-toggle'></button><aside class='emoticon-sidebar-panel'></aside></div>",
      "<script>document.querySelector('.emoticon-sidebar-toggle').onclick=()=>{}</script>",
    ].join("\n");
    const routed = routeOpeningContentSplit(sidebar, "legacy-emoticon");
    expect(routed.floating).toHaveLength(1);
    expect(routed.floating[0].meta).toEqual({
      kind: "details-right",
      pos: "right-center",
      interactive: true,
      needsShim: true,
    });
    expect(routed.inline).toBeNull();

    const cssOnly = routeOpeningContentSplit(
      "<style>.emoticon-sidebar-container{position:fixed}</style><div class='scene-card'>正文</div>",
      "legacy-emoticon-css-only",
    );
    expect(cssOnly.floating).toHaveLength(0);
    expect(cssOnly.inline).not.toBeNull();
  });

  test("旧版表情侧栏与后续演绎无栅栏时，只悬浮侧栏本身", () => {
    const content = [
      "<style>.emoticon-sidebar-container{position:fixed}</style>",
      "<button class='emoticon-sidebar-toggle'></button>",
      "<div class='emoticon-sidebar-container'></div>",
      "<a href='#' class='sidebar-close-overlay'></a>",
      "<style>.scene-card{display:block}</style><div class='scene-card'>演绎正文</div>",
    ].join("\n");
    const result = routeOpeningContentSplit(content, "legacy-emoticon-mixed");
    expect(result.floating).toHaveLength(1);
    expect(result.floating[0].srcdoc).toContain("emoticon-sidebar-toggle");
    expect(result.floating[0].srcdoc).not.toContain("演绎正文");
    expect(result.inline?.kind).toBe("iframe");
    if (result.inline?.kind === "iframe") {
      expect(result.inline.srcdoc).toContain("演绎正文");
      expect(result.inline.srcdoc).not.toContain("emoticon-sidebar-toggle");
    }
  });

  test("<floating> 非法 pos 回落默认 top-center", () => {
    const content =
      '```html\n<floating pos="nonsense"><div>x</div></floating>\n```';
    const r = routeOpeningContentSplit(content, "c5");
    expect(r.floating[0].meta.pos).toBe("top-center");
  });

  test("无灵动岛的卡：零回归 —— inline 与 routeOpeningContent 逐字节一致", () => {
    // 关键保证：不含悬浮件的内容，分流后的内联 srcdoc 必须和改动前完全相同，
    // 演绎内容渲染不受影响。
    const cases = [
      fullDoc({ style: ".a{}", body: "<p>场景一</p>" }) +
        "\n\n" +
        fullDoc({ style: ".b{}", body: "<p>场景二</p>" }),
      '<div class="mag">纯片段</div>',
      "```html\n<div>单段</div>\n```",
      "你站在街角。", // 纯文本 → html 路径
    ];
    for (const content of cases) {
      const before = routeOpeningContent(content);
      const { inline, floating } = routeOpeningContentSplit(content, "c");
      expect(floating.length).toBe(0);
      expect(inline).toEqual(before);
    }
  });
});

describe("flattenDocument", () => {
  test("保留 head 的 style 与 @font-face", () => {
    const out = flattenDocument(
      "<!DOCTYPE html><html><head><style>@font-face{font-family:X;src:url(x.ttf)}.a{color:red}</style></head><body><p>x</p></body></html>",
    );
    expect(out).toContain("@font-face");
    expect(out).toContain(".a{color:red}");
    expect(out).toContain("<p>x</p>");
  });

  test("body 内联 style/class 迁移到包裹 div", () => {
    const out = flattenDocument(
      '<html><head></head><body class="stage" style="display:flex"><p>x</p></body></html>',
    );
    expect(out).toContain('class="stage"');
    expect(out).toContain('style="display:flex"');
    expect(out).toContain("data-nj-doc");
    expect(out).toContain("<p>x</p>");
  });

  test("消除嵌套 doctype/html/body", () => {
    const out = flattenDocument(
      "<!DOCTYPE html><html><head></head><body><p>x</p></body></html>",
    );
    expect(out.toLowerCase()).not.toContain("<!doctype");
    expect(out.toLowerCase()).not.toContain("<html");
    expect(out.toLowerCase()).not.toContain("<body");
  });

  test("降级: 无 body (只有 head) → 剥壳留 inner, 无文档级标签", () => {
    const out = flattenDocument(
      "<!DOCTYPE html><html><head><style>.a{}</style></head></html>",
    );
    expect(out).toContain(".a{}");
    expect(out.toLowerCase()).not.toContain("<!doctype");
    expect(out.toLowerCase()).not.toContain("<html");
    expect(out.toLowerCase()).not.toContain("<head");
  });
});
