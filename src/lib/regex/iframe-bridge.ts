import {winterLocalCommandCopyCompat} from "@/lib/opening/winter-local-command-copy";
/**
 * Build the iframe srcdoc content. Wraps the creator's HTML with:
 *   1. A CSP <meta http-equiv> that allows inline scripts (creator code
 *      lives here) but forbids fetch/XHR (connect-src 'none') and
 *      nested iframes (frame-src 'none').
 *   2. A bridge <script> that wires window.host = { sendMessage, getHistory,
 *      getCharacter, setComponentState, context }
 *
 * The bridge receives a MessagePort via the host's `init` postMessage,
 * then mediates RPC requests over the port.
 *
 * v1 CDN allowlist (per v1-foundation.md §4.5): tailwindcss, jsdelivr,
 * unpkg, cdnjs, google fonts.
 */

import {buildIframeIncrementalScript} from './iframe-incremental';

export interface BridgePayload {
  srcdoc: string;
  captureGroups: string[];
  /** Explicit TEST-host opt-in; only the official public player path. */
  allowBilibiliPlayer?: boolean;
  /** Prepared message canvas only; no extra sandbox privileges. */
  incrementalUpdates?: boolean;
  /** creator CSS 的 scope id。sanitizeAndScopeCss 给每条规则强制加
   *  `[data-character-css="<id>"]` 前缀，宿主属性必须挂在 iframe 文档内
   *  （通常是 <body>），否则注入 srcdoc 的皮肤 <style> 一条都匹配不上 ——
   *  这正是 2026-07 之前 opening iframe 皮肤全量 no-op 的根因。 */
  cssScope?: string;
  /** 是否注入 parent 垫片（PARENT_SHIM_SCRIPT）。仅对「外部原生寄生控件」
   *  （censy 侧栏等靠 parent.document 注入宿主页的组件）开启，让它们在 iframe 内
   *  自渲染。默认 false：不碰 parent 的正常组件走原路径，srcdoc 逐字节不变、零风险。 */
  parentShim?: boolean;
  /** Parent alias only: keeps normal in-flow height reporting, no sidebar watcher. */
  inlineParentShim?: boolean;
  floatingKind?:
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
  /** 是否注入灵动岛开合监听（ISLAND_TOGGLE_WATCH_SCRIPT），上报 expanded 状态
   *  给宿主做 resize-on-toggle（收起缩小、不挡旁边侧栏）。仅悬浮灵动岛开启。 */
  islandWatch?: boolean;
}

const CDN_WHITELIST = [
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net",
  "https://unpkg.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  "https://cdnjs.cloudflare.com",
].join(" ");

// media-src 没显式声明会回落到 default-src 'self', 而 sandbox iframe origin 为
// null —— 任何跨源 `<audio src=...>` / `<video src=...>` 都会被 CSP 直接 block,
// audio.play() 报 NotSupportedError, 表现就是「灵动岛美化的播放按钮点了没反应」.
// 顾深意小剧场里的网易云外链 (music.163.com/song/media/outer/url?id=*.mp3) 就是
// 这个坑. 允许 https + data: + blob: (作者代码可能用 URL.createObjectURL 包装
// 本地音频); 额外允许 http: —— 外部模板大面积用 `http://music.163.com/...mp3`
// 写法, 且寄情平台本身就是 HTTP 部署, http 媒体不构成 mixed-content 风险.
//
// img-src / font-src 也放开 http: —— 2026-07-05 c9b0e73 迁移把外部 CDN 上的
// 静态图搬到自建 Supabase Storage 后, 现有 40 条美化包 replacement 全都用
// http://<IP>:8000/storage/... 引背景 / 默认头像 (backfill 前的现状), 站点自己
// 是 HTTP 部署, 跟 media-src 逻辑对齐允许 http: 才不至于把小手机背景全拦掉.
// connect-src 仍然 'none', fetch/XHR 出站通路依旧关死 —— 仅放开 img/font/media
// 元素的资源拉取, 不开 exfiltration 面.
const CSP = [
  `default-src 'self' 'unsafe-inline'`,
  `connect-src 'none'`,
  `script-src 'self' 'unsafe-inline' ${CDN_WHITELIST}`,
  `style-src 'self' 'unsafe-inline' ${CDN_WHITELIST}`,
  `img-src 'self' data: https: http:`,
  `font-src 'self' data: https: http:`,
  `media-src 'self' data: blob: https: http:`,
  `frame-src 'none'`,
].join("; ");

/**
 * Storage polyfill — sandbox iframe 无 allow-same-origin 时, origin 为 null,
 * 访问 `localStorage` / `sessionStorage` 会直接抛 SecurityError (不是返回 null,
 * 是 getter 就抛). 大量外部美化组件用 localStorage 存壁纸 / 头像 / 备注等本地
 * 偏好, 一旦在渲染主循环里命中未被 try/catch 包住的 localStorage 调用, 整个渲染
 * 脚本就崩在那里 —— 典型症状是「组件外壳渲染出来了, 但内部内容空白」(小手机 case).
 *
 * 这里注入一个内存版 Storage 兜底: 只有当原生 localStorage 不可用 (抛错) 时才
 * 顶上, 让作者代码的 get/set/remove 不再抛异常. 内存版不跨会话持久化 (sandbox
 * 本就读不到真实 storage, 持久化无从谈起), 但保证渲染不中断. 必须在所有其他
 * script 和作者 srcdoc 之前执行, 所以放在 <head> 最前.
 */
const STORAGE_POLYFILL_SCRIPT = `<script>
(function(){
  function makeMemoryStorage() {
    var store = {};
    return {
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function(k, v){ store[k] = String(v); },
      removeItem: function(k){ delete store[k]; },
      clear: function(){ store = {}; },
      key: function(i){ return Object.keys(store)[i] || null; },
      get length(){ return Object.keys(store).length; },
    };
  }
  ['localStorage','sessionStorage'].forEach(function(name){
    var usable = false;
    try {
      var s = window[name];
      if (s) { var t = '__nj_probe__'; s.setItem(t, '1'); s.removeItem(t); usable = true; }
    } catch (e) { usable = false; }
    if (!usable) {
      try {
        Object.defineProperty(window, name, { value: makeMemoryStorage(), configurable: true });
      } catch (e) {}
    }
  });
})();
</script>`;

/**
 * Clipboard polyfill — sandbox iframe (无 allow-same-origin) 下
 * `navigator.clipboard` 被禁用: 对象**存在**且 writeText **是个 function**,
 * 但实际**调用** writeText() 时因缺少用户手势/权限而返回 **rejected** Promise.
 * 外部组件常把"复制到剪贴板"作为交互兜底 (如小手机的快捷指令复制), 失败时
 * 弹"出错了，请联系Fox"这类错误 toast.
 *
 * 我们在 sandbox 里既复制不了 (无权限) 也不该假装复制成功 (剪贴板里其实没东西,
 * 提示用户"已复制请粘贴"是误导). 所以这里让 writeText/readText 返回一个**永不
 * settle 的 Promise**: 作者代码的 `.then(成功提示)` 和 `.catch(失败提示)` 都不会
 * 触发, 点击复制类按钮**完全静默** —— 不弹"出错了", 也不弹"已复制请粘贴".
 *
 * 关键: 不能用"clipboard 是否存在"判断可用性 —— 它存在但调用必败. 所以**无条件
 * 强制接管**. 真正"把指令送进主聊天"是独立能力 (host.fillComposer +
 * PARENT_COMPAT_SHIM), 见 plan 第二步.
 *
 * 同 storage polyfill, 必须在作者 srcdoc 之前执行.
 */
const CLIPBOARD_POLYFILL_SCRIPT = `<script>
(function(){
  // 永不 settle 的 Promise: .then / .catch 都不触发 → 复制按钮点击完全静默.
  var stub = {
    writeText: function(){ return new Promise(function(){}); },
    readText: function(){ return new Promise(function(){}); },
  };
  // 优先整体替换 navigator.clipboard
  try {
    Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
    return;
  } catch (e) {}
  // navigator.clipboard 不可重定义时, 退而单独覆盖 writeText / readText
  try {
    if (navigator.clipboard) {
      try { navigator.clipboard.writeText = stub.writeText; } catch (e1) {
        try { Object.defineProperty(navigator.clipboard, 'writeText', { value: stub.writeText, configurable: true }); } catch (e2) {}
      }
      try { navigator.clipboard.readText = stub.readText; } catch (e3) {}
    }
  } catch (e) {}
})();
</script>`;

/**
 * Autoplay + loop / playlist patch — 进对话页就让灵动岛 / 任何美化里的音乐
 * 自动播放, 并且永远不静默 (单首循环, 多首滚动播完一轮接着下一轮).
 *
 * 作者代码常见模式: `const audio = new Audio(); audio.src = ...; audio.play()`
 * 只在按钮 click 里触发, 且经常忘了 `audio.loop = true`. 用户需求是"进对话页
 * 就开始播 + 一直有 BGM 别停", 平台层兜底: 把 HTMLMediaElement.prototype.src
 * 的 setter 包一层, 一旦有 src 被赋值就:
 *   1. 把这个元素登记到 tracked playlist (同元素重复赋 src 只登记一次)
 *   2. 异步调一次 play().catch(()=>{}) 触发 autoplay
 *   3. 在元素上挂一次性 'ended' 监听 — 单首场景重置 currentTime 并重播,
 *      多首场景跳到 tracked 列表里下一个还带 src 的元素继续播.
 * 作者代码后续的手动 play() 仍然正常工作 (重复 play() 在已 playing 状态下
 * promise 直接 resolve, 不报错).
 *
 * 为什么不直接 el.loop = true:
 *   - 多首滚动需要 'ended' 事件触发切换, 而 loop=true 时浏览器静默回绕, ended
 *     不触发, 多首场景拿不到信号.
 *   - 作者代码可能自己写了 loop 或 ended 逻辑, 我们的 ended 钩子比强行覆盖
 *     loop 属性更容易被作者代码"自然覆盖"(他们的 ended 改 src 也会被我们 src
 *     setter 捕获, 走的还是同一条路).
 *
 * 多首滚动的判定就用"截至 ended 触发那一刻 tracked 里有几个有 src 的元素":
 * 1 → 重播自己; ≥2 → 找下一个还带 src 的播. 这意味着创作者新加一首歌后,
 * 后续 ended 自动把它纳入轮播, 不需要重新加载组件.
 *
 * 浏览器 autoplay policy 两道门必须同时过:
 *   1) Permissions Policy: iframe 元素必须带 allow="autoplay" —— 由 host 侧
 *      (RegexIframe / ArtifactIframe) 在 <iframe> 标签上设置, 这里管不了.
 *   2) Autoplay Policy (user activation): 用户在父页面有过交互 (sticky
 *      activation) 即可放行音频. 走到聊天页本身就是 click 进来, 桌面 / Android
 *      Chrome 多数 OK. iOS Safari 对 audio 极严, 通常 reject —— 我们静默兜底,
 *      用户点播放按钮仍能手动触发. ended 后的循环 / 滚动 play() 在已有 user
 *      activation 上下文里, iOS 通常会放行 (用户已经"开过音").
 *
 * 必须在 polyfill 之后 / 作者 srcdoc 之前注入. patch prototype 而不是 monkey-
 * patch Audio constructor, 这样 <audio src=...> 标签元素和 new Audio() 两条路
 * 都能覆盖.
 */
const AUTOPLAY_PATCH_SCRIPT = `<script>
(function(){
  try {
    var proto = HTMLMediaElement && HTMLMediaElement.prototype;
    if (!proto) return;
    var desc = Object.getOwnPropertyDescriptor(proto, 'src');
    if (!desc || typeof desc.set !== 'function') return;

    // 已被赋过 src 的媒体元素, 按登记顺序保存, 用作单首循环 / 多首滚动 playlist.
    var tracked = [];
    function indexOf(el) {
      for (var i = 0; i < tracked.length; i++) {
        if (tracked[i] === el) return i;
      }
      return -1;
    }
    function safePlay(el) {
      try {
        var p = el.play && el.play();
        if (p && typeof p.catch === 'function') p.catch(function(){});
      } catch (e) {}
    }
    function handleEnded(el) {
      // 只统计 tracked 里"还带 src"的元素 — 作者代码 audio.src='' 主动释放后
      // 不应该再被卷进轮播.
      var withSrc = [];
      for (var i = 0; i < tracked.length; i++) {
        if (tracked[i] && tracked[i].src) withSrc.push(tracked[i]);
      }
      if (withSrc.length <= 1) {
        try { el.currentTime = 0; } catch (e) {}
        safePlay(el);
        return;
      }
      var idx = -1;
      for (var j = 0; j < withSrc.length; j++) {
        if (withSrc[j] === el) { idx = j; break; }
      }
      if (idx < 0) {
        // 当前元素已经从 playlist 撤出 (src 被清), 直接从第一个继续.
        try { withSrc[0].currentTime = 0; } catch (e) {}
        safePlay(withSrc[0]);
        return;
      }
      var nextEl = withSrc[(idx + 1) % withSrc.length];
      try { nextEl.currentTime = 0; } catch (e) {}
      safePlay(nextEl);
    }

    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: desc.enumerable,
      get: function(){ return desc.get.call(this); },
      set: function(v){
        desc.set.call(this, v);
        if (!v) return;
        var self = this;
        if (indexOf(self) < 0) {
          tracked.push(self);
          // ended 监听只挂一次; 同元素 src 反复改也复用同一个钩子.
          self.addEventListener('ended', function(){ handleEnded(self); });
        }
        // 异步触发, 让作者代码当前同步流程跑完 (setupEventListeners 等)
        Promise.resolve().then(function(){ safePlay(self); });
      }
    });
  } catch (e) {}
})();
</script>`;

/**
 * 高度上报 script — 不依赖 host bridge / port, 任何 srcdoc 都能跑.
 * 通过 ResizeObserver + load/DOMContentLoaded 钩子向 parent 上报 `{type:'resize', height}`,
 * 由 host (RegexIframe / ArtifactIframe) 侧的 window message 监听把 iframe 元素撑高.
 *
 * 必须走 postMessage 而不是直接读 `iframe.contentDocument.scrollHeight` —— sandbox
 * 不带 allow-same-origin, origin 为 null, host 直接读会触发跨源 SecurityError.
 *
 * 抽出独立 export 让 buildIframeSrcdoc / wrapBareSrcdoc 共用同一份高度协议,
 * 避免两条 iframe 通路的高度行为再次漂移 (历史上 ArtifactIframe 用过 onLoad +
 * contentDocument 直读, 因 sandbox 跨源永远抛错, 实际卡死在初始值).
 */
const RESIZE_OBSERVER_SCRIPT = `<script>
(function(){
  function ordinaryFlowHeight() {
    var root = document.documentElement, body = document.body;
    var rootScroll = root.scrollHeight || 0;
    var legacy = Math.max(rootScroll, (body && body.scrollHeight) || 0);
    var viewport = root.clientHeight || 0;
    // Only remove an observed viewport floor, never a real document overflow.
    if (!body || viewport <= 0 || rootScroll > viewport + 1) return legacy;
    // Limit the repair to the observed ordinary message scaffold. Arbitrary
    // authored viewport apps keep their established sizing contract.
    var flowRoots = Array.prototype.filter.call(body.children, function(el) {
      return !/^(STYLE|SCRIPT|TEMPLATE|LINK|META)$/.test(el.tagName);
    });
    if (flowRoots.length !== 1 || !flowRoots[0].classList.contains('react-markdown')) return legacy;
    var scrollY = window.scrollY || 0;
    function extent(node) {
      var rect = node.getBoundingClientRect();
      var style = window.getComputedStyle(node);
      var bottomMargin = Math.max(0, parseFloat(style.marginBottom) || 0);
      return Math.max(rect.height || 0, (rect.bottom || 0) + scrollY + bottomMargin);
    }
    var natural = Math.max(body.scrollHeight || 0, body.offsetHeight || 0, root.offsetHeight || 0, extent(body), extent(root));
    // An authored root-level positioned sibling may overflow the body box.
    for (var i = 0; i < root.children.length; i++) {
      var child = root.children[i];
      if (child !== body && child.tagName !== 'HEAD') natural = Math.max(natural, extent(child));
    }
    if (!(natural > 0 && natural + 1 < rootScroll)) return legacy;

    // Do not reinterpret intentionally viewport-coupled author pages. This scan
    // is reached only when a positive intrinsic box is below the old viewport.
    if (window.getComputedStyle(root).position === 'fixed' || window.getComputedStyle(body).position === 'fixed') return legacy;
    var nodes = body.querySelectorAll('*');
    if (nodes.length > 2000) return legacy;
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n], computed = window.getComputedStyle(node);
      if (computed.position === 'fixed' && computed.display !== 'none') {
        var r = node.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) return legacy;
      }
    }
    function viewportHeight(style, node) {
      if (!style) return false;
      var properties = ['height', 'min-height', 'max-height'];
      for (var p = 0; p < properties.length; p++) {
        var value = style.getPropertyValue(properties[p]);
        for (var depth = 0; depth < 4 && value.indexOf('var(') !== -1; depth++) {
          value = value.replace(/var\\(\\s*(--[-\\w]+)(?:\\s*,\\s*([^)]*))?\\)/g, function(_, name, fallback) {
            return window.getComputedStyle(node).getPropertyValue(name) || fallback || '';
          });
        }
        if (/\\d(?:s|l|d)?vh\\b|\\d(?:vmin|vmax|vb)\\b/i.test(value)) return true;
        if (/\\d\\s*%/.test(value)) return true;
      }
      return false;
    }
    if (viewportHeight(root.style, root) || viewportHeight(body.style, body)) return legacy;
    for (var k = 0; k < nodes.length; k++) if (viewportHeight(nodes[k].style, nodes[k])) return legacy;
    function viewportRules(rules) {
      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        if (rule.style && rule.selectorText) {
          // Fast skip without querying the DOM for ordinary pixel/auto rules.
          var heights = rule.style.getPropertyValue('height') + rule.style.getPropertyValue('min-height') + rule.style.getPropertyValue('max-height');
          if (!/[v%]|var\\(/i.test(heights)) continue;
          var matches = document.querySelectorAll(rule.selectorText);
          for (var m = 0; m < matches.length; m++) if (viewportHeight(rule.style, matches[m])) return true;
        } else if (rule.styleSheet) {
          // A known font-only Google Fonts import has no box-layout rules.
          // Other imports must be inspectable or the outer catch keeps legacy.
          var href = new URL(rule.href, document.baseURI);
          if (href.protocol === 'https:' && href.hostname === 'fonts.googleapis.com' && /^\\/css2?$/.test(href.pathname) && !href.username && !href.password) continue;
          if (viewportRules(rule.styleSheet.cssRules)) return true;
        } else if (rule.cssRules) {
          if (rule.type === 4 && window.matchMedia && !window.matchMedia(rule.conditionText).matches) continue;
          if (viewportRules(rule.cssRules)) return true;
        }
      }
      return false;
    }
    try {
      for (var s = 0; s < document.styleSheets.length; s++) {
        if (viewportRules(document.styleSheets[s].cssRules)) return legacy;
      }
    } catch (_) { return legacy; }
    return Math.ceil(natural);
  }

  function measure() {
    try {
      // A source canvas already has flow-root body sizing. html.scrollHeight
      // includes the iframe viewport and competes with its body-only observer,
      // causing collapse/grow feedback during streamed updates.
      var h = document.querySelector('.mufy-source-canvas') && document.body
        ? Math.ceil(document.body.getBoundingClientRect().height)
        : document.body && (document.body.hasAttribute('data-nj-artifact-canvas') || document.body.hasAttribute('data-nj-opening-canvas'))
        ? Math.max(
          Math.ceil(document.body.getBoundingClientRect().height),
          document.body.scrollHeight || 0,
          document.body.offsetHeight || 0,
        )
        : ordinaryFlowHeight();
      if (h > 0) parent.postMessage({ type: 'resize', height: h }, '*');
    } catch (e) {}
  }
  function start() {
    measure();
    if (!window.ResizeObserver) return;
    var ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  // 兜底: 图片 / web font / late stylesheet 加载完后再测一次, 防止初次
  // scrollHeight 测早了偏小, iframe 卡在过短的高度上.
  window.addEventListener('load', measure);
  // Small opening frames can finish before React subscribes to resize.
  // The established host handshake must repeat the current content size.
  window.addEventListener('host-ready', measure);
  // Bare artifacts have no Host API init handshake. Only their actual parent
  // may request a fresh size after installing its resize listener.
  window.addEventListener('message', function(event) {
    if (event.source === window.parent && event.data && event.data.type === 'nj-artifact-measure') measure();
  });
})();
</script>`;

/**
 * parent 垫片（shim）—— 救活「外部原生寄生控件」（censy 侧栏 / 灵动岛拖动球 /
 * cheese 音乐控件等）。这些组件是为「无 iframe 的宿主页」写的：靠 `parent.document`
 * = 宿主页 document 把自己 `appendChild` 注入整页，靠 `parent.xxx = fn` 在宿主 window
 * 上挂全局函数、再由 `onclick="parent.xxx()"` 调用。
 *
 * 搬进寄情后，iframe 是 `allow-scripts` 无 `allow-same-origin` 沙箱，`window.parent`
 * 跨域：`parent.document` 抛 SecurityError、`parent.xxx = fn` 也写不进去 → 组件**根本
 * 没渲染**（不是没悬浮）。见 memory: floating-widgets-island。
 *
 * 本 shim 把 iframe 内的 `window.parent` 换成一个 Proxy，重定向到 **iframe 自己的**
 * window/document，让这类组件在自己的沙箱文档里自渲染、自交互：
 *   - `parent.document`            → 本 iframe 的 document（appendChild/getElementById
 *                                     /querySelector 全落在自己文档里 → 侧栏渲染出来）
 *   - `parent.xxx = fn` / 读 `parent.xxx` → 落在本 iframe 的 window（挂哪读哪同一处，
 *                                     `onclick="parent.censySwitchTab()"` 自然调得到）
 *   - `parent.postMessage`         → **透传真宿主**（平台高度上报 RESIZE_OBSERVER_SCRIPT
 *                                     依赖它，绝不能拦；否则 iframe 测不了高、塌缩）
 *   - `parent.location` 等其余      → 落在本 iframe，避免跨域抛错
 *
 * textarea 注入（`parent.document.querySelector('textarea')` 填指令到聊天输入框）:
 * 组件把内容 append 到自己文档里没有的 textarea → querySelector 返回 null → 静默不发。
 * 真正「发指令进聊天」改由 host.sendMessage 承接（下一步：给侧栏指令项接 Host API）。
 * 本 shim 先保证**渲染 + tab 切换 + 展开收起**活起来，textarea 注入降级为 no-op（不报错）。
 *
 * 安全：不放开任何沙箱能力，只是在 iframe 内把 parent 引用「掰回」自己，宿主 DOM /
 * 存储 / cookie 依旧碰不到（本来也碰不到，SecurityError）。对不碰 parent 的正常组件
 * 零影响（实查：现有正常组件 0 个用 window.parent）。必须在作者 srcdoc 之前执行。
 */
const PARENT_SHIM_SCRIPT = `<script>
(function(){
  try {
    var realParent = window.parent;
    // 透传给真宿主的方法（平台高度上报靠 parent.postMessage）。
    function realPost(){ return realParent.postMessage.apply(realParent, arguments); }
    var shim = new Proxy({}, {
      get: function(_t, prop){
        if (prop === 'postMessage') return realPost;
        if (prop === 'document') return window.document;
        if (prop === 'window' || prop === 'self' || prop === 'parent' || prop === 'top') return window;
        if (prop === 'location') return window.location;
        // 其余（含作者挂的 parent.censySwitchTab 等具名函数）都落到本 iframe window。
        var v = window[prop];
        return typeof v === 'function' ? v.bind(window) : v;
      },
      set: function(_t, prop, value){
        // parent.xxx = fn → 挂到本 iframe window，onclick="parent.xxx()" 读得到。
        window[prop] = value;
        return true;
      },
      has: function(_t, prop){ return prop in window; },
    });
    try { Object.defineProperty(window, 'parent', { value: shim, configurable: true }); } catch (e) {}
    try { Object.defineProperty(window, 'top', { value: shim, configurable: true }); } catch (e) {}
  } catch (e) {}
})();
</script>`;

/**
 * censyInject 桥接 —— censy 侧栏点表情/指令，作者代码调 `window.parent.censyInject(str)`
 * / `censyFillInputFade(str)` 想把内容填进宿主聊天输入框（找 `parent.document` 里的
 * textarea）。sandbox 里那个 textarea 找不到（parent shim 把 document 指向 iframe 自己，
 * 没有聊天输入框）→ 静默失效，就是「点表情没反应」。
 *
 * 这里在作者 srcdoc **之后** 执行，用 host.fillComposer（真正把文本填进宿主 composer，
 * 对齐外部组件预期：填进去让用户可编辑再发，不直接发送）**覆盖**掉作者那几个注入函数。因为
 * parent shim 让 `parent.censyInject` 读的是 iframe window，这里把 window 上的同名函数
 * 换成走 Host API 的版本即可。`ftCopy` 是另一批 Mufy 侧栏使用的“复制指令/表情”
 * 入口；在 sandbox 中系统剪贴板不可用，迁移到寄情后应等价为填入输入框。必须在作者
 * 定义之后执行（作者在 body 内联 script 里定义）。
 */
const INJECT_BRIDGE_SCRIPT = `<script>
(function(){
  try {
    function fill(str){
      try {
        if (str && window.host && typeof window.host.fillComposer === 'function') {
          window.host.fillComposer(String(str));
        }
      } catch (e) {}
    }
    // 覆盖已知的注入/复制入口（作者已在上文定义，这里替换实现）。
    var names = ['censyInject','censyFillInputFade','ftCopy'];
    names.forEach(function(n){ try { window[n] = fill; } catch(e){} });
  } catch (e) {}
})();
</script>`;

/**
 * 侧栏「按开合改 iframe 宽度」监听 —— 解决 iframe pointer-events 全有/全无导致的
 * **遮挡死结**：侧栏 iframe 若常驻铺满右侧一大条（可点击），会盖住底下页面的按钮
 * （如详情页「开始对话」）点不动。
 *
 * 侧栏收起时只有右边缘一个 ~32px 把手，展开才需要 ~340px 面板。这里监听侧栏
 * `<details class="censy-*sidebar">` 的 open 状态，postMessage `{type:'nj_sidebar', open}`
 * 给宿主，宿主据此把 iframe 元素**收起时缩到窄条**（只盖住把手那一小块）、**展开时
 * 放大到面板宽**（此时遮挡聊天区可接受，用户点开本就该挡）。
 *
 * 用 MutationObserver 盯 `open` 属性（<details> 开合就是加/删 open 属性）+ 初始上报。
 * 仅侧栏（parentShim）注入。
 */
function buildSidebarToggleWatchScript(
  kind: NonNullable<BridgePayload["floatingKind"]>,
): string {
  return `<script>
(function(){
  try {
    var kind = ${JSON.stringify(kind)};
    function findSidebar(){
      var selectors = {
        'rose-right': '.ft-rose-details',
        'ghost-right': '.ft-ghost-sidebar',
        'details-right': 'details.censy-ins-trigger, .meme-dock-mini, .emoticon-sidebar-container, details.censy-blue-glass-sidebar, details[class*="sidebar"], details.mufy-side-r',
        'npc-left': '#cen_Sx_Sidebar_L',
        'gold-right': '#cen_gold_panel',
        'omni-right': '#Cen_Omni_Wrapper',
        'memory-left': '[id^="c-pan-"], [class^="censy-panel-"], [class*=" censy-panel-"]',
        'orb-right': '#censy-floatOrb-root, [id^="censy-floatOrb-"]'
      };
      return document.querySelector(selectors[kind] || selectors['details-right']);
    }
    function isOpen(el){
      if (!el) return false;
      if (kind === 'rose-right') return el.hasAttribute('open');
      if (kind === 'ghost-right') return el.getAttribute('data-nj-open') === 'true' || el.matches(':hover');
      if (kind === 'details-right') {
        if (el.classList.contains('meme-dock-mini')) return el.matches(':focus-within');
        if (el.classList.contains('emoticon-sidebar-container')) {
          var active = document.activeElement;
          return !!(active && (
            active.classList.contains('emoticon-sidebar-toggle') ||
            el.contains(active)
          ));
        }
        return el.hasAttribute('open');
      }
      if (kind === 'npc-left') return el.classList.contains('active');
      if (kind === 'gold-right') return el.classList.contains('cen-open');
      if (kind === 'omni-right') return el.classList.contains('cen-active');
      if (kind === 'memory-left') return el.classList.contains('open');
      return el.classList.contains('open') || el.classList.contains('active') || el.classList.contains('expanded');
    }
    function report(){
      var el = findSidebar();
      var open = isOpen(el);
      document.documentElement.setAttribute('data-nj-floating-open', String(open));
      try { parent.postMessage({ type: 'nj_sidebar', open: open }, '*'); } catch(e){}
    }
    function attach(){
      var el = findSidebar();
      if (!el) { setTimeout(attach, 300); return; }
      report();
      if (el.getAttribute('data-nj-watch-attached') === 'true') return;
      el.setAttribute('data-nj-watch-attached', 'true');
      var mo = new MutationObserver(report);
      mo.observe(el, { attributes: true, attributeFilter: ['open', 'class', 'data-nj-open'] });
      // 点 summary / 关闭按钮后属性变化会被 MO 捕获；兜底再监听 toggle 事件。
      el.addEventListener('toggle', report);
      // The legacy emoticon drawer opens through :focus rather than a class or
      // <details open>. Mirror that focus state to the host so its iframe grows
      // from the 48px cat hit-area to the complete panel width.
      if (kind === 'details-right' && (el.classList.contains('emoticon-sidebar-container') || el.classList.contains('meme-dock-mini'))) {
        document.addEventListener('focusin', function(){ setTimeout(report, 0); });
        document.addEventListener('focusout', function(){ setTimeout(report, 0); });
        // The source drawer lived in the host document. Across an opaque iframe
        // boundary activeElement otherwise stays on its trigger after the user
        // moves to the real composer, leaving :focus-within pinned open.
        if (el.classList.contains('meme-dock-mini')) window.addEventListener('blur', function(){
          var active = document.activeElement;
          if (active && el.contains(active) && typeof active.blur === 'function') active.blur();
          report();
        });
      }
      if (kind === 'ghost-right') {
        var touchPinned = el.getAttribute('data-nj-open') === 'true';
        function setGhostOpen(open){
          el.setAttribute('data-nj-open', String(open));
          document.documentElement.setAttribute('data-nj-floating-open', String(open));
          try { parent.postMessage({ type: 'nj_sidebar', open: open }, '*'); } catch(e){}
        }
        el.addEventListener('mouseenter', function(){
          if (!touchPinned) setGhostOpen(true);
        });
        el.addEventListener('mouseleave', function(){
          if (!touchPinned) setGhostOpen(false);
        });
        // The original Mufy player opens with :hover only. Touch screens do
        // not have a stable hover state, so mirror that exact open style with
        // a tap-pinned state. Do not swallow taps on the player controls.
        el.addEventListener('pointerup', function(ev){
          if (ev.pointerType !== 'touch' && ev.pointerType !== 'pen') return;
          if (touchPinned && ev.target && ev.target.closest && ev.target.closest('.ft-btn,.ft-progress-wrap')) return;
          touchPinned = !touchPinned;
          setGhostOpen(touchPinned);
          ev.preventDefault();
        });
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else { attach(); }
    // 侧栏是异步 append 进来的（censy 注入脚本），延迟再试几次确保挂上。
    setTimeout(attach, 500);
    setTimeout(attach, 1200);

    // ── tab 切换兜底 ──────────────────────────────────────────────
    // 作者的 tab 按钮写 onclick="window.parent.censySwitchTab(...)"。shim 下这
    // 有时失灵（内联 handler 作用域 / parent 具名函数解析）。tab 切换本就是纯
    // DOM 操作（切 active class + 切 display），这里用**事件委托**在 iframe 内
    // 直接接管，不依赖作者那个可能失灵的 parent 函数。幂等、无副作用。
    document.addEventListener('click', function(ev){
      var btn = ev.target && ev.target.closest && ev.target.closest('.censy-tab-btn');
      if (!btn) return;
      var sidebar = findSidebar() || document.getElementById('censy-permanent-node');
      if (!sidebar) return;
      // 目标 tab id：优先从 onclick 属性里抠 'xxx'，否则按钮在组里的序号对应
      // emoji/cmd/faq。
      var target = '';
      var oc = btn.getAttribute('onclick') || '';
      var mm = oc.match(/censySwitchTab\\([^,]*,\\s*['"]([^'"]+)['"]/);
      if (mm) target = mm[1];
      var btns = Array.prototype.slice.call(sidebar.querySelectorAll('.censy-tab-btn'));
      if (!target) {
        var order = ['emoji','cmd','faq'];
        target = order[btns.indexOf(btn)] || 'emoji';
      }
      btns.forEach(function(b){ b.classList.remove('active'); });
      sidebar.querySelectorAll('.censy-tab-content').forEach(function(c){ c.style.display = 'none'; });
      btn.classList.add('active');
      var tab = sidebar.querySelector('#censy-tab-' + target);
      if (tab) { tab.style.display = 'block'; tab.classList.add('active'); }
    }, true);
  } catch (e) {}
})();
</script>`;
}

/**
 * 灵动岛开合监听 —— 灵动岛收起是顶部一个小药丸（~160×35），展开是大面板
 * （width:100% × ~260/480）。若 iframe 盒子常驻按展开尺寸占位，收起时那块透明
 * 大盒会挡住旁边的侧栏 tab/关闭叉（真机窄屏尤甚，「岛+侧栏」都有的卡点不到）。
 *
 * 这里监听灵动岛顶层容器（`.island-container` / `#island`）的 `expanded` class，
 * postMessage `{type:'nj_island', expanded}` 给宿主：宿主收起时把 iframe 盒子缩到
 * 药丸大小、展开时放大到面板。跟侧栏 resize-on-toggle 同源。仅灵动岛（islandWatch）注入。
 */
const ISLAND_TOGGLE_WATCH_SCRIPT = `<script>
(function(){
  try {
    function findIsland(){
      return document.querySelector('.island-container, #island');
    }
    function report(){
      var el = findIsland();
      var expanded = !!(el && el.classList && el.classList.contains('expanded'));
      try { parent.postMessage({ type: 'nj_island', expanded: expanded }, '*'); } catch(e){}
    }
    function attach(){
      var el = findIsland();
      if (!el) { setTimeout(attach, 300); return; }
      report();
      var mo = new MutationObserver(report);
      mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else { attach(); }
    setTimeout(attach, 500);
    setTimeout(attach, 1200);
  } catch (e) {}
})();
</script>`;

const BRIDGE_SCRIPT = `<script>
(function(){
  let port;
  const resolvers = new Map();
  let seq = 0;
  window.host = {
    context: { captureGroups: [], locale: 'en', userName: '' },
    sendMessage: function(text, options) { return call('sendMessage', options === undefined ? { text } : { text, options }); },
    fillComposer: function(text, options) { return call('fillComposer', options && options.separator === 'none' ? { text, separator: 'none' } : { text }); },
    getHistory: function() { return call('getHistory'); },
    getCharacter: function() { return call('getCharacter'); },
    setComponentState: function(state) { return call('setComponentState', { state }); },
  };
  function call(method, args) {
    if (!port) return Promise.reject(new Error('host bridge not ready'));
    return new Promise(function(resolve, reject){
      const id = ++seq;
      resolvers.set(id, { resolve: resolve, reject: reject });
      try { port.postMessage({ id: id, method: method, args: args || {} }); }
      catch (e) { resolvers.delete(id); reject(e); }
    });
  }
  window.addEventListener('message', function(e){
    if (e.data && e.data.type === 'init') {
      port = e.ports[0];
      if (e.data.context) window.host.context = e.data.context;
      port.onmessage = function(ev){
        const data = ev.data || {};
        const r = resolvers.get(data.id);
        if (!r) return;
        resolvers.delete(data.id);
        if (data.error) r.reject(new Error(data.error));
        else r.resolve(data.result);
      };
      window.dispatchEvent(new Event('host-ready'));
    }
  });
  // 告诉宿主子页桥已就绪。小型 srcdoc 可能在 React effect 绑定 iframe load
  // 监听前就加载完成；由子页主动握手可避免永久错过 MessageChannel 初始化。
  function announceReady(){
    try { parent.postMessage({ type: 'nj_iframe_bridge_ready' }, '*'); } catch(e){}
  }
  announceReady();
  setTimeout(announceReady, 0);
  setTimeout(announceReady, 250);
})();
</script>`;

/**
 * 平台侧统一去框 / 透底 CSS — 注入到每个 iframe srcdoc, 让外部或作者美化
 * 在嵌入语境里不会被"系统侧的卡片样式"套出明显边框. 具体地:
 *   - html/body: 清零 border/outline/box-shadow, 透明背景 (margin:0 保留
 *     避免内边距双倍)
 *   - html/body: 强制 height:auto / overflow:visible — 让 iframe 高度由实际
 *     内容撑开. 老模板常写 `body{height:100vh;overflow:auto}` 来做"一屏
 *     滚动"效果, 在嵌入语境里会导致 scrollHeight 回报偏小, host 把 iframe
 *     卡在很短的高度, 用户看到内部 body 自滚的"小框". 强制平铺.
 *
 * 移除了原先的通配符 `* { background-color: transparent !important }` ——
 * 它会破坏 iframe 内组件的背景色（如小手机聊天区的 #ebebeb 背景），且过于
 * 激进。只让 html/body 透明即可，内部组件的背景由作者 CSS 控制。
 *
 * 暴露为 export 让 RegexIframe / ArtifactIframe 共用同一份, 保证两条 iframe
 * 通路的视觉行为一致 (开场组件可能走任一条 —— 顶层 <artifact> 包络走 Regex,
 * markdown 代码块走 Artifact). 改一处全部生效.
 */
export const PLATFORM_RESET_STYLE_TAG =
  // color-scheme:dark 必须与父文档(globals.css 的 html{color-scheme:dark})
  // 一致：浏览器对 color-scheme 不匹配的嵌入 iframe 会强制不透明白色画布,
  // background:transparent 直接失效 —— 缺这一句小剧场整块变白底。
  "<style>html{color-scheme:dark}html,body{margin:0;height:auto!important;min-height:0!important;overflow:visible!important;border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;font-family:system-ui,sans-serif;color:#e2e8f0}</style>";

/** Opted-in independent source documents own their HTML overflow cascade.
 * Body remains auto-height/visible for measurement; arbitrary artifacts and
 * parent/reply skins keep the existing reset. No sandbox/CSP changes. */
export function platformResetForSrcdoc(srcdoc:string):string{
 return srcdoc.includes('<style data-nj-mufy-source-canvas-boundary>')
  ? PLATFORM_RESET_STYLE_TAG.replace('overflow:visible!important;','')+'<style>body{overflow:visible!important}</style>'
  : PLATFORM_RESET_STYLE_TAG;
}

export const PLATFORM_CSP_META = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;

export function isMufyTestBilibiliHost(origin:string):boolean {
  return origin === 'http://115.29.213.73:8091';
}

/** Only the approved official endpoint; legacy protocol-relative embeds must
 * not inherit HTTP from the test host. This never expands other frame URLs. */
export function hasOfficialBilibiliPlayer(srcdoc:string):boolean {
  return /<iframe\b[^>]*\bsrc\s*=\s*["'](?:https:)?\/\/player\.bilibili\.com\/player\.html(?:[?"'])/i.test(srcdoc);
}

export function normalizeOfficialBilibiliPlayer(srcdoc:string):string {
  return srcdoc.replace(/(<iframe\b[^>]*\bsrc\s*=\s*["'])(?:https:)?\/\/(player\.bilibili\.com\/player\.html)(?=[?"'])/gi,'$1https://$2');
}

/** Fail closed: only a standalone public video, not an arbitrary author page.
 * The inert parsed document is supplied by the browser (or a test fixture).
 * No source scripts, attributes or Host API are transferred to this frame. */
export function standaloneOfficialBilibiliUrl(doc:Document):string|null {
  const frames=doc.body.querySelectorAll('iframe');
  if(frames.length!==1||frames[0].hasAttribute('srcdoc'))return null;
  const frame=frames[0];
  for(const node of doc.body.querySelectorAll('*')){
    if(node===frame||node.closest('script,style')||['SCRIPT','STYLE'].includes(node.tagName))continue;
    if(node.tagName!=='DIV'||!node.hasAttribute('data-nj-doc'))return null;
  }
  const visible=doc.body.cloneNode(true) as HTMLElement;
  visible.querySelectorAll('script,style,iframe').forEach(node=>node.remove());
  if(visible.textContent?.trim())return null;
  const src=frame.getAttribute('src')??'';
  if(!/^(?:https:)?\/\//i.test(src))return null;
  try{
    const url=new URL(src.startsWith('//')?'https:'+src:src);
    if(url.origin!=='https://player.bilibili.com'||url.pathname!=='/player.html'||url.username||url.password)return null;
    return url.href;
  }catch{return null;}
}

/** A finite public form; not a clipboard capability for arbitrary author code. */
export function hasPublicOcProfile(srcdoc: string): boolean {
  return ['oc-generator', 'oc-output-text', 'oc-output-wrap'].every(
    id => new RegExp(`id=["']${id}["']`).test(srcdoc),
  ) && /function\s+ocCopy\s*\(/.test(srcdoc) && /function\s+ocFallbackCopy\s*\(/.test(srcdoc);
}
/** Original finite opening-copy button, never arbitrary clipboard calls. */
export function hasPublicEngravedOpening(srcdoc:string):boolean{
 return ['mufy-glass-openings','mufy-glass-content','mufy-pill-btn','mufy-engraved-text'].every(cls=>new RegExp(`class=["'][^"']*\\b${cls}\\b`).test(srcdoc))&&srcdoc.includes("btn.closest('.mufy-glass-content').querySelector('.mufy-engraved-text').innerText")&&srcdoc.includes('navigator.clipboard.writeText(text)');
}
/** Finite public avatar library, including the superseded draft-copy candidate. */
export function hasPublicAvatarLibrary(srcdoc:string):boolean{
 return /class=["'][^"']*\bcensy-avatar-wrapper\b/.test(srcdoc)&&/class=["'][^"']*\bcensy-avatar-content\b/.test(srcdoc)&&/avatar[\s\S]{0,180}library/i.test(srcdoc)&&(
  srcdoc.includes("navigator.clipboard.writeText(this.src);alert('Image Link Copied!')")||srcdoc.includes("navigator.clipboard.writeText(this.src);alert('Copied!')")||srcdoc.includes("window.host.fillComposer(this.src);alert('Copied!')")||srcdoc.includes("window.host.fillComposer(this.src);alert('已填入草稿，请确认后发送。')"));
}
/** Observed public COPY command card; not a general author clipboard API. */
export function hasPublicCommandCopy(srcdoc:string):boolean{
 return hasPublicHubCommandCopy(srcdoc)||hasPublicMemoryCommandCopy(srcdoc)||['cen_cmd_wrap_Sx','cold_tank_item','Z_CONFIG_btn','Mm_toast'].every(cls=>new RegExp(`class=["'][^"']*\\b${cls}\\b`).test(srcdoc))&&/data-command=["']/.test(srcdoc)&&srcdoc.includes('function censyCopyFn_v1(btn)')&&srcdoc.includes("parentItem.getAttribute('data-command')")&&srcdoc.includes('navigator.clipboard.writeText(fullCommand)');
}
/** The observed six-button public memory tutorial, including its legacy draft conversion. */
export function hasPublicMemoryCommandCopy(srcdoc: string): boolean {
  const hasStructure = [
    'memory-plugin-stage', 'plugin-list', 'code-row', 'cmd-text', 'copy-btn',
  ].every(cls => new RegExp(`class=["'][^"']*\\b${cls}\\b`).test(srcdoc));
  const hasCommands = ['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5', 'cmd6'].every(
    id => new RegExp(`id=["']${id}["']`).test(srcdoc),
  );
  return hasStructure && hasCommands &&
    srcdoc.includes('function copyCmd(elementId, btnElement)') &&
    srcdoc.includes('document.getElementById(elementId).innerText') &&
    (srcdoc.includes('navigator.clipboard.writeText(textToCopy)') ||
      srcdoc.includes('window.host.fillComposer(textToCopy)'));
}
/** Observed six-ID music hub; includes its superseded draft-write candidate. */
export function hasPublicHubCommandCopy(srcdoc:string):boolean{
 return ['mufy-hub-container','mufy-cmd-card','mufy-copy-btn'].every(cls=>new RegExp(`class=["'][^"']*\\b${cls}\\b`).test(srcdoc))&&['cmd1','cmd2','cmd3','cmd4','cmd5','cmd6'].every(id=>new RegExp(`id=["']${id}["']`).test(srcdoc))&&srcdoc.includes('function mufyCopyCmd(elementId, btnObj)')&&srcdoc.includes('document.getElementById(elementId).innerText')&&(srcdoc.includes('navigator.clipboard.writeText(textToCopy)')||srcdoc.includes('window.host.fillComposer(textToCopy)'));
}
/** Six-field public mask extraction form; never owner/private character data. */
export function hasPublicMaskExtraction(srcdoc:string):boolean{
 return ['censy-mask-form-v7-white','cm-form-content-v7','cm-copy-btn-v7','cm-name-v7','cm-role-v7','cm-personality-v7','cm-appearance-v7','cm-preference-v7','cm-extra-v7'].every(id=>new RegExp(`id=["']${id}["']`).test(srcdoc))&&srcdoc.includes('censyExtractDataV7')&&srcdoc.includes('temp_Cmtt.value = textToCopy;')&&srcdoc.includes('【角色档案面板】');
}

/** Source-component fallbacks, not a global theme or a change to stored cards. */
export function sourceComponentFallbacks(srcdoc: string): string {
  const ocProfile = hasPublicOcProfile(srcdoc);
  const engravedOpening=hasPublicEngravedOpening(srcdoc);
  const avatarLibrary=hasPublicAvatarLibrary(srcdoc);
  const commandCopy=hasPublicCommandCopy(srcdoc);
  const hubCommandCopy=hasPublicHubCommandCopy(srcdoc);
  const memoryCommandCopy=hasPublicMemoryCommandCopy(srcdoc);
  const maskExtraction=hasPublicMaskExtraction(srcdoc);
  const comments = /class=["'][^"']*\binteraction-area\b/.test(srcdoc) &&
    /class=["'][^"']*\bcomment-item\b/.test(srcdoc) &&
    /\.interaction-area\s*\{[^}]*background(?:-color)?\s*:\s*#f7f7f7\b/i.test(srcdoc);
  const player = ['cy-audio-deck', 'cy-audio-core', 'cy-btn-play'].every(
    id => new RegExp(`id=["']${id}["']`).test(srcdoc),
  );
  return [
    maskExtraction ? `<script data-mufy-compat="public-mask-copy">
(function(){function start(){var form=document.getElementById('censy-mask-form-v7-white'),button=form&&form.querySelector('#cm-copy-btn-v7');if(!button)return;var pending=false,request=0,timer,reset;var oldLabel=button.innerText,oldBackground=button.style.background,oldColor=button.style.color;
 function result(ok){pending=false;clearTimeout(timer);button.disabled=false;button.setAttribute('data-copy-result',ok?'copied':'failed');button.innerText=ok?'已复制完成':'复制失败，请重试';if(ok){button.style.background='var(--mask-v7-main)';button.style.color='#000';reset=setTimeout(function(){button.innerText=oldLabel;button.style.background=oldBackground;button.style.color=oldColor;},3000);}}
 window.addEventListener('message',function(event){var data=event.data;if(event.source!==window.parent||!pending||!data||data.type!=='nj-oc-profile-copy-result'||data.id!==request)return;result(data.ok===true);});
 button.addEventListener('click',function(event){
  event.preventDefault();event.stopImmediatePropagation();if(!event.isTrusted||pending)return;
  var ids=['cm-name-v7','cm-role-v7','cm-personality-v7','cm-appearance-v7','cm-preference-v7','cm-extra-v7'],labels=['姓名','职业','性格','视觉特征','所喜所恶','隐藏秘密'];
  var lines=['【角色档案面板】'];for(var i=0;i<ids.length;i++){var field=form.querySelector('#'+ids[i]);if(!field)return;lines.push('['+labels[i]+']：'+(field.value.trim()||(i===5?'无':'未录入')));}
  lines.push('','(注：这个是基础面具，可进行修改增加)');var text=lines.join(String.fromCharCode(10));if(text.length>100000)return;
  clearTimeout(reset);pending=true;request++;button.disabled=true;button.innerText='正在复制…';button.setAttribute('data-copy-result','pending');
  window.parent.postMessage({type:'nj-oc-profile-copy',id:request,text:text},'*');timer=setTimeout(function(){if(pending)result(false);},3000);
 },true);
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
</script>` : '',
    hubCommandCopy||memoryCommandCopy ? `<script data-mufy-compat="public-hub-command-copy">
(function(){function start(){var form=document.querySelector(${JSON.stringify(memoryCommandCopy?".memory-plugin-stage":".mufy-hub-container")});if(!form)return;var pending=false,awaitingAck=false,request=0,timer,button,oldHTML,originals=new WeakMap();
 function result(ok){pending=false;clearTimeout(timer);var completed=button,original=oldHTML;completed.disabled=false;completed.setAttribute('data-copy-result',ok?'copied':'failed');completed.innerHTML=original.replace(${JSON.stringify(memoryCommandCopy?'复制 ⋆':'COPY')},ok?${JSON.stringify(memoryCommandCopy?'已复制 ♡':'COPIED')}:${JSON.stringify(memoryCommandCopy?'失败 ✕':'COPY FAILED')});setTimeout(function(){completed.innerHTML=original;},1500);}
 window.addEventListener('message',function(event){var data=event.data;if(event.source!==window.parent||!awaitingAck||!data||data.type!=='nj-oc-profile-copy-result'||data.id!==request)return;awaitingAck=false;result(data.ok===true);});
 form.addEventListener('click',function(event){var target=event.target.closest(${JSON.stringify(memoryCommandCopy?'button.copy-btn':'button.mufy-copy-btn')});if(!target||!form.contains(target))return;var match=(target.getAttribute('onclick')||'').match(/^${memoryCommandCopy?'copyCmd':'mufyCopyCmd'}\\('([a-z0-9]+)', this\\)$/);if(!match||!/^cmd[1-6]$/.test(match[1]))return;event.preventDefault();event.stopImmediatePropagation();if(!event.isTrusted||pending)return;
 var output=document.getElementById(match[1]);if(!output||!form.contains(output)||!output.classList.contains(${JSON.stringify(memoryCommandCopy?'cmd-text':'mufy-cmd-text')}))return;var text=output.innerText||output.textContent||'';if(!text.trim()||text.length>100000)return;if(button&&awaitingAck)button.innerHTML=oldHTML;button=target;if(!originals.has(button))originals.set(button,button.innerHTML);oldHTML=originals.get(button);pending=true;awaitingAck=true;request++;button.disabled=true;button.setAttribute('data-copy-result','pending');window.parent.postMessage({type:'nj-oc-profile-copy',id:request,text:text},'*');timer=setTimeout(function(){if(!pending)return;pending=false;button.disabled=false;button.setAttribute('data-copy-result','unconfirmed');button.innerHTML=oldHTML.replace(${JSON.stringify(memoryCommandCopy?'复制 ⋆':'COPY')},${JSON.stringify(memoryCommandCopy?'请重试':'COPY RETRY')});},3000);
 },true);
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
</script>` : '',
    commandCopy&&!hubCommandCopy&&!memoryCommandCopy ? `<style data-mufy-compat="public-command-copy-box">:where(.cen_cmd_wrap_Sx){box-sizing:border-box}</style><script data-mufy-compat="public-command-copy">
(function(){function start(){var form=document.querySelector('.cen_cmd_wrap_Sx');if(!form)return;var pending=false,request=0,timer,status;
 window.addEventListener('message',function(event){var data=event.data;if(event.source!==window.parent||!pending||!data||data.type!=='nj-oc-profile-copy-result'||data.id!==request)return;pending=false;clearTimeout(timer);status.textContent=data.ok===true?'已复制':'复制失败，请手动复制公开指令';status.setAttribute('data-copy-result',data.ok===true?'copied':'failed');if(data.ok===true){status.classList.add('Cmtt_show');setTimeout(function(){status.classList.remove('Cmtt_show');},1000);}else{status.style.opacity='1';}});
 form.addEventListener('click',function(event){var button=event.target.closest('button[onclick="censyCopyFn_v1(this)"]');if(!button||!form.contains(button))return;event.preventDefault();event.stopImmediatePropagation();if(!event.isTrusted||pending)return;var item=button.closest('.cold_tank_item'),text=item&&item.getAttribute('data-command');if(!text||!text.trim()||text.length>100000)return;status=item.querySelector('.Mm_toast');if(!status)return;status.setAttribute('role','status');status.setAttribute('data-mufy-copy-status','');status.setAttribute('data-copy-result','pending');status.textContent='正在复制…';pending=true;request++;window.parent.postMessage({type:'nj-oc-profile-copy',id:request,text:text},'*');timer=setTimeout(function(){if(!pending)return;pending=false;status.textContent='复制失败，请手动复制公开指令';status.style.opacity='1';status.setAttribute('data-copy-result','failed');},3000);},true);
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
</script>` : '',
    avatarLibrary ? `<script data-mufy-compat="avatar-library-copy">
(function(){function start(){
 var form=document.querySelector('.censy-avatar-wrapper'),grid=form&&form.querySelector('.censy-avatar-content');if(!grid)return;
 var status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('data-mufy-copy-status','');status.hidden=true;grid.parentNode.appendChild(status);status.style.color=getComputedStyle(form).color;
 var pending=false,request=0,timer;
 window.addEventListener('message',function(event){var data=event.data;if(event.source!==window.parent||!pending||!data||data.type!=='nj-oc-profile-copy-result'||data.id!==request)return;pending=false;clearTimeout(timer);status.textContent=data.ok===true?'图片链接已复制':'复制失败，请手动复制图片链接';status.setAttribute('data-copy-result',data.ok===true?'copied':'failed');});
 grid.addEventListener('click',function(event){var img=event.target.closest('img.censy-avatar-img');if(!img||!grid.contains(img))return;event.preventDefault();event.stopImmediatePropagation();if(!event.isTrusted||pending)return;var text=img.getAttribute('src')||'';try{var url=new URL(text);if(url.protocol!=='https:'||url.username||url.password)return;}catch(e){return;}
 pending=true;request++;status.hidden=false;status.textContent='正在复制…';status.setAttribute('data-copy-result','pending');window.parent.postMessage({type:'nj-oc-profile-copy',id:request,text:text},'*');timer=setTimeout(function(){if(!pending)return;pending=false;status.textContent='复制失败，请手动复制图片链接';status.setAttribute('data-copy-result','failed');},3000);
 },true);
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
</script>` : '',
    // Copies a generated profile, not a chat command. The host performs a
    // write-only, source-window-checked user gesture and acknowledges completion.
    // Never reads clipboard contents or changes the sandbox/Permissions Policy.
    ocProfile||engravedOpening ? `<script data-mufy-compat="${ocProfile?'oc-profile-copy':'engraved-opening-copy'}">
(function(){function start(){
  var form=${ocProfile?"document.getElementById('oc-generator')":"document.querySelector('.mufy-glass-openings')"},output=${ocProfile?"document.getElementById('oc-output-text')":"form&&form.querySelector('.mufy-engraved-text')"};
  if(!form||!output)return;
  var button=form.querySelector(${JSON.stringify(ocProfile?'button[onclick="ocCopy()"]':'.mufy-pill-btn')});
  if(!button)return;
  var status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('data-mufy-copy-status','');status.hidden=true;button.parentNode.appendChild(status);
  ${engravedOpening?"status.style.color=getComputedStyle(button).color;status.style.fontSize=getComputedStyle(button).fontSize;":''}
  var pending=false,request=0,timer;
  window.addEventListener('message',function(event){
    var data=event.data;if(event.source!==window.parent||!pending||!data||data.type!=='nj-oc-profile-copy-result'||data.id!==request)return;
    pending=false;clearTimeout(timer);status.hidden=false;status.textContent=data.ok===true?'已复制到剪贴板':'复制失败，请手动选中文本复制';status.setAttribute('data-copy-result',data.ok===true?'copied':'failed');
    ${engravedOpening?"if(data.ok===true){var old=button.innerHTML;button.innerHTML='已复制 ✓';setTimeout(function(){button.innerHTML=old;},2000);}":''}
  });
  button.addEventListener('click',function(event){
    event.preventDefault();event.stopImmediatePropagation();
    var text=${ocProfile?"output.textContent":"output.innerText||output.textContent"}||'';status.hidden=false;
    if(!text.trim()){status.textContent=${JSON.stringify(ocProfile?'请先点击“生成档案”':'暂无可复制的开场内容')};status.setAttribute('data-copy-result','empty');return;}
    if(!event.isTrusted||pending)return;
    pending=true;request++;status.textContent='正在复制…';status.setAttribute('data-copy-result','pending');
    window.parent.postMessage({type:'nj-oc-profile-copy',id:request,text:text},'*');
    timer=setTimeout(function(){if(!pending)return;pending=false;status.textContent='复制失败，请手动选中文本复制';status.setAttribute('data-copy-result','failed');},3000);
  },true);
  form.addEventListener('click',function(event){var clear=event.target.closest('button[onclick="ocClear()"]');if(clear){pending=false;clearTimeout(timer);status.hidden=true;status.textContent='';status.removeAttribute('data-copy-result');}});
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
</script>` : '',
    // Zero specificity: any authored foreground still wins. Keep html dark so
    // Chromium does not turn the entire transparent iframe canvas opaque.
    comments ? '<style data-mufy-compat="light-comments">:where(.interaction-area){color-scheme:light;color:CanvasText}</style>' : '',
    player ? `<script data-mufy-compat="empty-cy-player">
(function(){function start(){
  var audio=document.getElementById('cy-audio-core'),btn=document.getElementById('cy-btn-play'),deck=document.getElementById('cy-audio-deck');
  if(!audio||!btn||!deck)return;
  function unavailable(){return !(audio.getAttribute('src')||'').trim()&&!audio.querySelector('source[src]:not([src=""])')||!!audio.error;}
  function sync(){if(unavailable()){
    btn.setAttribute('aria-disabled','true');btn.setAttribute('data-mufy-audio-unavailable','true');btn.title='Audio unavailable';btn.textContent='Audio unavailable';
    btn.classList.remove('active');deck.classList.remove('is-playing');
  }else if(btn.hasAttribute('data-mufy-audio-unavailable')){
    btn.removeAttribute('aria-disabled');btn.removeAttribute('data-mufy-audio-unavailable');btn.removeAttribute('title');btn.textContent='Play';
  }}
  document.addEventListener('click',function(e){if(btn.contains(e.target)&&unavailable()){e.preventDefault();e.stopImmediatePropagation();sync();}},true);
  new MutationObserver(sync).observe(audio,{attributes:true,attributeFilter:['src'],childList:true,subtree:true});
  ['error','emptied','loadedmetadata'].forEach(function(name){audio.addEventListener(name,sync);});sync();
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
</script>` : '',
  ].join('\n');
}

/**
 * 给一段裸 srcdoc 套上 doctype + CSP + 去框 reset CSS, 不挂 host bridge.
 * 用于 ArtifactIframe 这种"无需 postMessage host API"的轻量 artifact 渲染.
 */
export function wrapBareSrcdoc(srcdoc: string, options: {mufySourceDefaults?: boolean} = {}): string {
  return [
    "<!doctype html>",
    "<html><head>",
    PLATFORM_CSP_META,
    STORAGE_POLYFILL_SCRIPT,
    CLIPBOARD_POLYFILL_SCRIPT,
    AUTOPLAY_PATCH_SCRIPT,
    platformResetForSrcdoc(srcdoc),
    // Public Mufy documents inherit these platform defaults. Keep them below
    // authored CSS in cascade priority, and leave native Dearm artifacts alone.
    options.mufySourceDefaults ? '<style data-nj-mufy-document-defaults>body{font-family:"Noto Sans SC";color:rgb(0,0,0)}</style>' : '',
    sourceComponentFallbacks(srcdoc),
    RESIZE_OBSERVER_SCRIPT,
    // Bare artifacts must measure their content, not the previous iframe
    // viewport. flow-root includes child margins when folds collapse.
    '<style>body[data-nj-artifact-canvas]{display:flow-root}</style>',
    '</head><body data-nj-artifact-canvas>',
    srcdoc,
    "</body></html>",
  ].join("\n");
}

export function buildIframeSrcdoc(payload: BridgePayload): string {
  // 属性值消毒：scope id 只该是 "opening" / uuid / "sandbox" 这类受控值，
  // 防御性去掉可截断属性的字符即可。
  const scopeAttr = payload.cssScope
    ? ` data-character-css="${payload.cssScope.replace(/["'<>&]/g, "")}"`
    : "";
  return [
    "<!doctype html>",
    "<html><head>",
    payload.allowBilibiliPlayer
      ? PLATFORM_CSP_META.replace("frame-src 'none'", 'frame-src https://player.bilibili.com/player.html')
      : PLATFORM_CSP_META,
    STORAGE_POLYFILL_SCRIPT,
    CLIPBOARD_POLYFILL_SCRIPT,
    AUTOPLAY_PATCH_SCRIPT,
    // parent 垫片必须在作者 srcdoc 之前、且在平台脚本之后（平台脚本用真 parent
    // 上报高度，此时 window.parent 还没被换）。仅寄生控件开启。
    payload.parentShim || payload.inlineParentShim ? PARENT_SHIM_SCRIPT : "",
    platformResetForSrcdoc(payload.srcdoc),
    sourceComponentFallbacks(payload.srcdoc),
    payload.cssScope === 'opening' && !payload.parentShim
      ? '<style>body[data-nj-opening-canvas]{display:flow-root}</style>' : '',
    RESIZE_OBSERVER_SCRIPT,
    BRIDGE_SCRIPT,
    payload.incrementalUpdates ? buildIframeIncrementalScript(payload.srcdoc) : '',
    `</head><body${scopeAttr}${payload.cssScope === 'opening' && !payload.parentShim ? ' data-nj-opening-canvas' : ''}>`,
    payload.allowBilibiliPlayer ? normalizeOfficialBilibiliPlayer(payload.srcdoc) : payload.srcdoc,
    // censyInject 桥接 + 侧栏开合监听必须在作者 srcdoc 之后（作者先注入侧栏）——
    // 仅寄生控件开启。
    payload.parentShim || payload.inlineParentShim ? INJECT_BRIDGE_SCRIPT : "",
    payload.parentShim
      ? buildSidebarToggleWatchScript(payload.floatingKind ?? "details-right")
      : "",
    payload.islandWatch ? ISLAND_TOGGLE_WATCH_SCRIPT : "",
    payload.cssScope==='opening'&&!payload.parentShim&&!payload.inlineParentShim ? winterLocalCommandCopyCompat(payload.srcdoc) : "",
    "</body></html>",
  ].join("\n");
}
