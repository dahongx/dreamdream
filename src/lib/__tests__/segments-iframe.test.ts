import { describe, expect, test } from "bun:test";
import type { RegexRule } from "@/lib/db/schema";
import {
  buildIframeSrcdoc,
  PLATFORM_RESET_STYLE_TAG,
  wrapBareSrcdoc,
} from "@/lib/regex/iframe-bridge";
import { applyRegexToSegments } from "@/lib/regex/segments";
import { buildYearnPhoneArtifact } from "@/lib/regex/yearn-phone";

function rule(over: Partial<RegexRule>): RegexRule {
  return {
    id: "r1",
    packId: "p1",
    name: "test",
    targetText: null,
    pattern: "",
    replacement: "",
    variableMapping: [],
    outputGuidance: null,
    enabled: true,
    visible: false,
    orderIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe("applyRegexToSegments", () => {
  test("ordinary artifacts use explicit bounded root sizing without changing the default", () => {
    const small = rule({pattern:"<state>(.*?)</state>",replacement:'<artifact><html data-nj-iframe-min-height="1"><body>$1</body></html></artifact>'});
    const output=applyRegexToSegments('<state>12:30</state>',[small]);
    expect(output.segments[0]).toEqual(expect.objectContaining({type:'iframe',minHeight:1}));
    const ordinary=applyRegexToSegments('<state>12:30</state>',[{...small,replacement:'<artifact><html><body>$1</body></html></artifact>'}]);
    expect(ordinary.segments[0]).not.toHaveProperty('minHeight');
  });
  test("substitutes capture groups above nine without appending digits to group one", () => {
    const r = rule({
      pattern:
        "<x>(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)\\|(.*?)</x>",
      replacement: "<artifact><p>$1 / $10</p></artifact>",
    });
    const out = applyRegexToSegments("<x>alpha|2|3|4|5|6|7|8|9|omega</x>", [r]);
    expect(out.segments).toEqual([
      expect.objectContaining({
        type: "iframe",
        srcdoc: "<p>alpha / omega</p>",
      }),
    ]);
  });

  test("plain replacement produces a single html segment", () => {
    const r = rule({ pattern: "<env>(.*?)</env>", replacement: "[$1]" });
    const out = applyRegexToSegments("hi <env>14:30</env> bye", [r]);
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0]).toEqual({
      type: "html",
      content: "hi [14:30] bye",
    });
  });

  test("<artifact>-wrapped replacement carves out an iframe segment with the inner srcdoc", () => {
    const r = rule({
      id: "phone",
      pattern: "<phone>([\\s\\S]*?)</phone>",
      replacement: "<artifact><script>/* dearm */</script></artifact>",
    });
    const out = applyRegexToSegments("before <phone>hello</phone> after", [r]);
    expect(out.segments).toHaveLength(3);
    expect(out.segments[0]).toEqual({ type: "html", content: "before " });
    expect(out.segments[1].type).toBe("iframe");
    if (out.segments[1].type === "iframe") {
      expect(out.segments[1].ruleId).toBe("phone");
      expect(out.segments[1].captureGroups).toEqual(["hello"]);
      expect(out.segments[1].srcdoc).toBe("<script>/* dearm */</script>");
    }
    expect(out.segments[2]).toEqual({ type: "html", content: " after" });
  });

  test("disabled rules are skipped, no matchedRules", () => {
    const r = rule({
      pattern: "<env>(.*?)</env>",
      replacement: "[$1]",
      enabled: false,
    });
    const out = applyRegexToSegments("<env>x</env>", [r]);
    expect(out.matchedRules).toEqual([]);
    // Output unchanged
    expect(out.segments).toEqual([{ type: "html", content: "<env>x</env>" }]);
  });

  test("visible rule with userPrefs=false is skipped", () => {
    const r = rule({
      pattern: "<env>(.*?)</env>",
      replacement: "[$1]",
      visible: true,
    });
    const userPrefs = new Map<string, boolean>([[r.id, false]]);
    const out = applyRegexToSegments("<env>x</env>", [r], { userPrefs });
    expect(out.segments[0]).toEqual({ type: "html", content: "<env>x</env>" });
  });

  test("enabled=false beats a stale visible+pref entry (segments)", () => {
    // Mirrors the same invariant tested in regex.test.ts for applyRegex:
    // disabled wins, no matter what the per-user pref says.
    const r = rule({
      pattern: "<env>(.*?)</env>",
      replacement: "[$1]",
      enabled: false,
      visible: true,
    });
    const userPrefs = new Map<string, boolean>([[r.id, true]]);
    const out = applyRegexToSegments("<env>x</env>", [r], { userPrefs });
    expect(out.segments[0]).toEqual({ type: "html", content: "<env>x</env>" });
    expect(out.matchedRules).toEqual([]);
  });

  test("two non-overlapping <artifact> matches produce two iframe segments", () => {
    const r = rule({
      pattern: "<p>(.*?)</p>",
      replacement: "<artifact><script>x</script></artifact>",
    });
    const out = applyRegexToSegments("<p>a</p>::<p>b</p>", [r]);
    const iframeSegments = out.segments.filter((s) => s.type === "iframe");
    expect(iframeSegments).toHaveLength(2);
    expect(out.matchedRules[0].count).toBe(2);
  });

  test("replacement that *contains* <artifact> inline (not whole) stays as html", () => {
    // Auto-routing only fires when the replacement is *exclusively* an
    // artifact envelope. Mixed content keeps flowing through MessageRenderer.
    const r = rule({
      pattern: "<x>(.*?)</x>",
      replacement: "prefix <artifact>x</artifact> suffix",
    });
    const out = applyRegexToSegments("<x>hi</x>", [r]);
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0]).toEqual({
      type: "html",
      content: "prefix <artifact>x</artifact> suffix",
    });
  });

  test("yearn-phone artifact is auto-routed to an iframe segment end-to-end", () => {
    // buildYearnPhoneArtifact() must be a valid envelope on its own — this
    // is the contract the official pack and the template both rely on now
    // that the runtime field is gone.
    const r = rule({
      id: "yearn-phone",
      pattern: "<phone>([\\s\\S]*?)</phone>",
      replacement: buildYearnPhoneArtifact(),
    });
    const out = applyRegexToSegments(
      "intro\n<phone>[wechat]\nuser: hi</phone>\nouttro",
      [r],
    );
    const iframeSegs = out.segments.filter((s) => s.type === "iframe");
    expect(iframeSegs).toHaveLength(1);
    if (iframeSegs[0].type === "iframe") {
      // captureGroup carries the <phone>...</phone> body for the bridge
      expect(iframeSegs[0].captureGroups[0]).toContain("[wechat]");
      // srcdoc is the inner body (sans envelope), ready for buildIframeSrcdoc
      expect(iframeSegs[0].srcdoc).toContain("nj_phone_frame");
      expect(iframeSegs[0].srcdoc.startsWith("<artifact>")).toBe(false);
    }
  });
});

describe("Mufy floating component state watchers", () => {
  test("uses component-specific open state for omni and memory panels", () => {
    const omni = buildIframeSrcdoc({
      srcdoc: "<div id='Cen_Omni_Wrapper'></div>",
      captureGroups: [],
      parentShim: true,
      floatingKind: "omni-right",
    });
    expect(omni).toContain("#Cen_Omni_Wrapper");
    expect(omni).toContain("cen-active");

    const memory = buildIframeSrcdoc({
      srcdoc: "<aside class='censy-panel-X'></aside>",
      captureGroups: [],
      parentShim: true,
      floatingKind: "memory-left",
    });
    expect(memory).toContain("censy-panel-");
    expect(memory).toContain("data-nj-floating-open");
  });

  test("adds a touch toggle for Mufy's hover-only ghost player", () => {
    const player = buildIframeSrcdoc({
      srcdoc: "<div class='ft-ghost-sidebar'></div>",
      captureGroups: [],
      parentShim: true,
      floatingKind: "ghost-right",
    });
    expect(player).toContain("data-nj-open");
    expect(player).toContain("pointerup");
    expect(player).toContain("touchPinned");
    expect(player).toContain("ft-progress-wrap");
  });

  test("reports the focus-open legacy emoticon drawer to its host", () => {
    const src = buildIframeSrcdoc({
      srcdoc:
        '<button class="emoticon-sidebar-toggle"></button><div class="emoticon-sidebar-container"></div>',
      captureGroups: [],
      parentShim: true,
      floatingKind: "details-right",
    });
    expect(src).toContain(".emoticon-sidebar-container");
    expect(src).toContain("document.addEventListener('focusin'");
    expect(src).toContain(
      "active.classList.contains('emoticon-sidebar-toggle')",
    );
  });
});

describe("buildIframeSrcdoc", () => {
  test("includes CSP meta tag", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>hi</div>",
      captureGroups: [],
    });
    expect(src).toContain('http-equiv="Content-Security-Policy"');
    expect(src).toContain("connect-src 'none'");
    expect(src).toContain("frame-src 'none'");
  });

  test("includes the host bridge script (window.host) before body", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>hi</div>",
      captureGroups: [],
    });
    expect(src).toContain("window.host");
    expect(src).toContain("sendMessage");
    expect(src).toContain("getHistory");
    expect(src).toContain("setComponentState");
    expect(src).toContain("nj_iframe_bridge_ready");
    // bridge in <head>, body content follows
    expect(src.indexOf("window.host")).toBeLessThan(src.indexOf("<div>hi"));
  });

  test("creator HTML is rendered inside <body>", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<button>click</button>",
      captureGroups: [],
    });
    expect(src).toContain("<button>click</button>");
  });

  test("CDN whitelist includes the 5 standard hosts", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "",
      captureGroups: [],
    });
    expect(src).toContain("cdn.tailwindcss.com");
    expect(src).toContain("cdn.jsdelivr.net");
    expect(src).toContain("unpkg.com");
    expect(src).toContain("fonts.googleapis.com");
    expect(src).toContain("cdnjs.cloudflare.com");
  });

  test("includes the resize observer script so height auto-grows", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>x</div>",
      captureGroups: [],
    });
    // 高度上报协议: child 通过 postMessage {type:'resize', height} 通知 host
    expect(src).toContain("type: 'resize'");
    expect(src).toContain("ResizeObserver");
    expect(src).toContain("scrollHeight");
    // 高度脚本要在 head, 不在 body 之前的 srcdoc 内容里
    expect(src.indexOf("ResizeObserver")).toBeLessThan(src.indexOf("<div>x"));
  });

  test("includes storage + clipboard polyfills before the creator body", () => {
    // sandbox (无 allow-same-origin) 下 localStorage / navigator.clipboard 会抛错,
    // 外部组件命中未保护的调用就崩 (空白) 或弹"出错了"toast. 垫片必须在作者
    // srcdoc 之前执行才能兜底.
    const src = buildIframeSrcdoc({
      srcdoc: "<div id='creator'>x</div>",
      captureGroups: [],
    });
    expect(src).toContain("localStorage");
    expect(src).toContain("sessionStorage");
    expect(src).toContain("clipboard");
    const bodyIdx = src.indexOf("<div id='creator'");
    expect(src.indexOf("localStorage")).toBeLessThan(bodyIdx);
    expect(src.indexOf("clipboard")).toBeLessThan(bodyIdx);
  });

  test("cssScope puts a data-character-css host attr on <body>", () => {
    // sanitizeAndScopeCss 给皮肤规则强制加 [data-character-css="<id>"] 前缀;
    // 宿主属性必须存在于 iframe 文档内, 否则注入的皮肤 <style> 全量 no-op
    // (2026-07 修复的历史 bug — 回归护栏).
    const src = buildIframeSrcdoc({
      srcdoc: "<div>hi</div>",
      captureGroups: [],
      cssScope: "opening",
    });
    expect(src).toContain('<body data-character-css="opening" data-nj-opening-canvas>');
  });

  test("cssScope omitted → plain <body> (chat 规则 iframe 行为不变)", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>hi</div>",
      captureGroups: [],
    });
    expect(src).toContain("<body>");
    expect(src).not.toContain("data-character-css");
  });

  test("cssScope value is attribute-sanitized", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "",
      captureGroups: [],
      cssScope: 'x"><script>alert(1)</script>',
    });
    expect(src).toContain('<body data-character-css="xscriptalert(1)/script">');
  });

  test("wrapBareSrcdoc (no host bridge) still posts resize height", () => {
    // ArtifactIframe 通路: 没有 host bridge, 但高度协议必须同样工作 ——
    // 否则 sandbox 跨源让 host 读不了 contentDocument, iframe 卡死初始高.
    const src = wrapBareSrcdoc("<p>hi</p>");
    expect(src).toContain("type: 'resize'");
    expect(src).toContain("ResizeObserver");
    // 不应混入 host bridge (window.host)
    expect(src).not.toContain("window.host");
  });

  test("wrapBareSrcdoc also carries storage + clipboard polyfills", () => {
    // bare 路径同样可能渲染依赖 localStorage 的外部组件, 垫片不能缺.
    const src = wrapBareSrcdoc("<div id='bare'>x</div>");
    expect(src).toContain("localStorage");
    expect(src).toContain("clipboard");
    expect(src.indexOf("localStorage")).toBeLessThan(
      src.indexOf("<div id='bare'"),
    );
  });

  test("platform reset forces html/body to auto height", () => {
    // 防回归: 创作者写 body{height:100vh} 不会再把 iframe 卡在视口高
    expect(PLATFORM_RESET_STYLE_TAG).toContain("height:auto!important");
    expect(PLATFORM_RESET_STYLE_TAG).toContain("overflow:visible!important");
    expect(PLATFORM_RESET_STYLE_TAG).toContain("min-height:0!important");
    // color-scheme 必须与父文档 (globals.css html{color-scheme:dark}) 匹配:
    // 不匹配时浏览器强制 iframe 不透明白色画布, 透明背景失效, 小剧场整块
    // 变白 (2026-07 实测回归). 两条 iframe 通路共用此 reset, 一条断言双保.
    expect(PLATFORM_RESET_STYLE_TAG).toContain("color-scheme:dark");
  });

  test("Dearm phone renderer includes clickable desktop apps", () => {
    const src = buildYearnPhoneArtifact();
    expect(src.startsWith("<artifact>")).toBe(true);
    expect(src.endsWith("</artifact>")).toBe(true);
    expect(src).toContain("data-app=");
    expect(src).toContain('id: "wechat"');
    expect(src).toContain('id: "wallet"');
    expect(src).toContain('id: "notes"');
    expect(src).toContain('id: "weibo"');
    expect(src).toContain("nj_phone_frame");
    expect(src).toContain("nj_phone_wallet_card");
    expect(src).toContain("nj_phone_bubble--user");
    expect(src).toContain("parsePayload");
  });
});

describe("buildIframeSrcdoc — parent 垫片（救活 censy 侧栏等寄生控件）", () => {
  test("默认不注入 shim（正常组件路径不变）", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>x</div>",
      captureGroups: [],
    });
    expect(src).not.toContain("new Proxy");
  });

  test("parentShim=true 注入 Proxy 垫片，且在作者 srcdoc 之前", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div id='creator'>x</div>",
      captureGroups: [],
      parentShim: true,
    });
    expect(src).toContain("new Proxy");
    expect(src.indexOf("new Proxy")).toBeLessThan(
      src.indexOf("<div id='creator'"),
    );
  });

  test("shim 保留 parent.postMessage 透传（平台高度上报不能被拦）", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>x</div>",
      captureGroups: [],
      parentShim: true,
    });
    // shim 里显式把 postMessage 转发真宿主；平台 resize 脚本仍用 parent.postMessage
    expect(src).toContain("realParent.postMessage");
    expect(src).toContain("type: 'resize'");
  });

  test("shim 把 parent.document 重定向到 iframe 自身 document", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>x</div>",
      captureGroups: [],
      parentShim: true,
    });
    // 关键：parent.document → window.document（作者 appendChild 落到自己文档 → 渲染）
    expect(src).toContain("return window.document");
  });

  test("host.fillComposer 在 bridge 里暴露（侧栏点表情/指令填输入框）", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>x</div>",
      captureGroups: [],
    });
    expect(src).toContain("fillComposer");
  });

  test("parentShim 时 censyInject 桥接在作者 srcdoc 之后覆盖", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div id='creator'>作者代码定义 censyInject</div>",
      captureGroups: [],
      parentShim: true,
    });
    expect(src).toContain("censyInject");
    expect(src).toContain("censyFillInputFade");
    expect(src).toContain("ftCopy");
    // 桥接覆盖必须在作者 srcdoc 之后（作者先定义，我们后覆盖成 host.fillComposer）
    expect(src.lastIndexOf("censyInject")).toBeGreaterThan(
      src.indexOf("<div id='creator'"),
    );
  });

  test("不开 parentShim 时无 censyInject 桥接（正常组件零影响）", () => {
    const src = buildIframeSrcdoc({
      srcdoc: "<div>x</div>",
      captureGroups: [],
    });
    expect(src).not.toContain("censyInject");
  });
});
