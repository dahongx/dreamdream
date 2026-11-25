import { describe, expect, test } from "bun:test";
import { LEGACY_SELECTOR_PREFIX } from "@/lib/import/legacy-format";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

describe("sanitizeAndScopeCss — scoping", () => {
  test("scopes nj_* class selectors", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { color: red }",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
    expect(css).toContain("color: red");
  });

  test("scopes nj_* id selectors", () => {
    const { css } = sanitizeAndScopeCss(
      "#nj_chat_header { background: black }",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] #nj_chat_header');
  });

  test("scopes nj_* with combinators", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_chat_messages > .nj_ai_message_bubble { color: gold }",
      "abc",
    );
    expect(css).toContain(
      '[data-character-css="abc"] .nj_chat_messages > .nj_ai_message_bubble',
    );
  });

  test("scopes nj_* with pseudo-class", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_chat_send_button:hover { color: gold }",
      "abc",
    );
    expect(css).toContain(
      '[data-character-css="abc"] .nj_chat_send_button:hover',
    );
  });
});

describe("replay toolbar compatibility", () => {
  test("does not copy replay labels or hidden text styling to Dearm controls", () => {
    const { css } = sanitizeAndScopeCss(
      `
        #nj_chat_input_replay_btn { background: gold; border: 1px solid red; color: transparent; font-size: 0 }
        #nj_chat_input_replay_btn::before { content: "REWIND"; color: white }
        #nj_chat_input_replay_btn span { display: none }
      `,
      "toolbar",
    );
    const maskRule = css.match(/#nj_mask_btn[^{}]*\{([^}]*)\}/)?.[1] ?? "";
    expect(maskRule).toContain("background: gold");
    expect(maskRule).toContain("border: 1px solid red");
    expect(maskRule).not.toContain("color: transparent");
    expect(maskRule).not.toContain("font-size: 0");
    expect(css).not.toContain("#nj_mask_btn::before");
    expect(css).not.toContain("#nj_mask_btn span");
  });
});

describe("sanitizeAndScopeCss — selector blocking", () => {
  test("rewrites :root / html / body to scope root (preserves CSS variables)", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      "body { background: red } html { color: blue } :root { --x: 1 } * { font: serif }",
      "abc",
    );
    // :root / html / body should be rewritten to [data-character-css="abc"]
    // body background properties are redirected to #nj_background_image
    expect(css).toContain(
      '[data-character-css="abc"] #nj_background_image {\nbackground: red\n}',
    );
    expect(css).toContain('[data-character-css="abc"] {\ncolor: blue\n}');
    expect(css).toContain('[data-character-css="abc"] {\n--x: 1\n}');
    // * is still blocked
    expect(css).not.toContain("*");
    expect(warnings.some((w) => w.includes("selector blocked: *"))).toBe(true);
  });

  test("blocks bare unsafe tags", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      "div { color: red } span { color: red } a { color: red }",
      "abc",
    );
    expect(css).toBe("");
    expect(warnings.length).toBe(3);
  });

  test("allows generic attribute selectors (scope contains damage)", () => {
    const { css } = sanitizeAndScopeCss(
      '[data-evil="x"] { color: red }',
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] [data-evil="x"]');
  });

  test("blocks self-reference attribute selector [data-character-css=...]", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      '[data-character-css="foo"] body { color: red }',
      "abc",
    );
    expect(css).toBe("");
    expect(warnings[0]).toContain("selector blocked");
  });

  test("keeps safe selectors, rewrites body in a comma list", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble, body, .nj_user_message_bubble { color: red }",
      "abc",
    );
    // All three selectors should be in the output (body rewritten to scope root)
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
    expect(css).toContain('[data-character-css="abc"]'); // body rewritten
    expect(css).toContain('[data-character-css="abc"] .nj_user_message_bubble');
    expect(css).toContain("color: red");
    expect(warnings.length).toBe(0); // no warnings for rewritten selectors
  });

  test("allows nj_* chained with another class (head retains nj_)", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble.gold { color: gold }",
      "abc",
    );
    expect(css).toContain(".nj_ai_message_bubble.gold");
  });

  test("allows non-nj_ class selectors (外部美化兼容：cyd-/cyi-/cen- 等)", () => {
    const { css } = sanitizeAndScopeCss(
      ".cyd-info { color: red } .cyi-card { padding: 8px } .bg-foo { background: #000 }",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] .cyd-info');
    expect(css).toContain('[data-character-css="abc"] .cyi-card');
    expect(css).toContain('[data-character-css="abc"] .bg-foo');
  });

  test("allows descendant from non-nj_ head (scope contains)", () => {
    const { css } = sanitizeAndScopeCss(
      ".foo .nj_ai_message_bubble { color: red }",
      "abc",
    );
    expect(css).toContain(
      '[data-character-css="abc"] .foo .nj_ai_message_bubble',
    );
  });

  test("allows generic id selectors", () => {
    const { css } = sanitizeAndScopeCss(
      "#author-card { padding: 10px }",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] #author-card');
  });

  test("allows bare pseudo-class on its own (e.g. :hover)", () => {
    const { css } = sanitizeAndScopeCss(":hover { color: blue }", "abc");
    expect(css).toContain('[data-character-css="abc"] :hover');
  });

  // #nj_chat_input_box 现在指向输入框外框 wrapper（对齐契约），创作者应能给它
  // 加背景/边框做主题化。此前它被硬拉黑（当年 id 错放在 textarea 上防双层框），
  // 现在放行。见 docs/exec-plans/active/input-box-skin.md。
  test("allows #nj_chat_input_box (输入框外框) styling — no longer blacklisted", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      "#nj_chat_input_box { background: rgba(0,0,0,.4); border: 1px solid #888; border-radius: 12px }",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] #nj_chat_input_box');
    expect(css).toContain("background: rgba(0,0,0,.4)");
    expect(css).toContain("border: 1px solid #888");
    expect(warnings.some((w) => w.includes("blocked"))).toBe(false);
  });

  test("allows #nj_chat_input_box textarea (内层输入区) styling", () => {
    const { css } = sanitizeAndScopeCss(
      "#nj_chat_input_box textarea { color: #eee; background: transparent }",
      "abc",
    );
    expect(css).toContain(
      '[data-character-css="abc"] #nj_chat_input_box textarea',
    );
    expect(css).toContain("color: #eee");
  });

  test("#nj_chat_input_box 仍受 property 级安全过滤（position:fixed 被拦）", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      "#nj_chat_input_box { position: fixed; background: red }",
      "abc",
    );
    expect(css).not.toContain("position: fixed");
    expect(css).toContain("background: red");
    expect(warnings.some((w) => w.includes("fixed"))).toBe(true);
  });

  // mask / 金银币是寄情新增元素，外部创作者 CSS 只针对 #nj_chat_input_replay_btn。
  // 镜像：命中 replay 的规则自动复制到 #nj_mask_btn / #nj_currency_switcher，跟随美化。
  test("replay 按钮规则镜像到 mask / 金银币开关", () => {
    const { css } = sanitizeAndScopeCss(
      "#nj_chat_input_replay_btn { background: gold; border: none }",
      "abc",
    );
    expect(css).toContain(
      '[data-character-css="abc"] #nj_chat_input_replay_btn',
    );
    expect(css).toContain('[data-character-css="abc"] #nj_mask_btn');
    expect(css).toContain('[data-character-css="abc"] #nj_currency_switcher');
    // 镜像的是同一条声明块
    expect(css).toContain("background: gold");
  });

  test("旧前缀的 replay 规则先转 nj_ 再镜像", () => {
    const { css } = sanitizeAndScopeCss(
      `#${LEGACY_SELECTOR_PREFIX}chat_input_replay_btn { background: teal }`,
      "abc",
    );
    expect(css).toContain("#nj_mask_btn");
    expect(css).toContain("#nj_currency_switcher");
  });

  test("不含 replay 的规则不产生镜像（currency 不被镜像）", () => {
    const { css } = sanitizeAndScopeCss(
      "#nj_chat_header { background: black }",
      "abc",
    );
    // 没有 replay 规则 → 不产生 currency 镜像（currency 只可能来自镜像）。
    // currency 是镜像的可靠判据；mask 因还兼作激活态描边，不用它判镜像。
    expect(css).not.toContain("#nj_currency_switcher");
    // 不应出现「scope + 单个 #nj_mask_btn + {」这种镜像样式块（激活态是
    // #nj_mask_btn[data-active]…，带属性和重复 id，不匹配下面这条）。
    expect(css).not.toMatch(/data-character-css="abc"\]\s+#nj_mask_btn\s*\{/);
  });

  test("有创作者 CSS 时注入 mask 激活态发光描边(currentColor,压创作者!important)", () => {
    const { css } = sanitizeAndScopeCss(
      "#nj_chat_header { background: black }",
      "abc",
    );
    expect(css).toContain("#nj_mask_btn[data-active]");
    expect(css).toContain("outline: 2px solid var(--nj-mask-active-color, currentColor)");
  });
});

describe("sanitizeAndScopeCss — safe-tag allowlist", () => {
  test("allows details summary", () => {
    const { css } = sanitizeAndScopeCss(
      "details summary { color: red }",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] details summary');
  });

  test("allows bare safe tags from list", () => {
    for (const tag of [
      "pre",
      "code",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "blockquote",
    ]) {
      const { css } = sanitizeAndScopeCss(`${tag} { color: red }`, "abc");
      expect(css).toContain(`[data-character-css="abc"] ${tag}`);
    }
  });
});

describe("sanitizeAndScopeCss — declaration blocking", () => {
  test("blocks position: fixed and sticky, keeps relative/absolute", () => {
    const { css: c1, warnings: w1 } = sanitizeAndScopeCss(
      ".nj_chat_input_container { position: fixed; top: 0 }",
      "abc",
    );
    expect(c1).not.toContain("position: fixed");
    expect(c1).toContain("top: 0");
    expect(w1.some((w) => w.includes("position"))).toBe(true);

    const { css: c2 } = sanitizeAndScopeCss(
      ".nj_chat_input_container { position: sticky }",
      "abc",
    );
    expect(c2).not.toContain("position: sticky");

    const { css: c3 } = sanitizeAndScopeCss(
      ".nj_chat_input_container { position: relative }",
      "abc",
    );
    expect(c3).toContain("position: relative");

    const { css: c4 } = sanitizeAndScopeCss(
      ".nj_chat_input_container { position: absolute }",
      "abc",
    );
    expect(c4).toContain("position: absolute");
  });

  test("blocks position: fixed !important", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      ".nj_chat_input_container { position: fixed !important }",
      "abc",
    );
    expect(css).not.toContain("position");
    expect(warnings.some((w) => w.includes("position"))).toBe(true);
  });

  test("blocks pointer-events of any value", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      ".nj_chat_input_box { pointer-events: none; color: red }",
      "abc",
    );
    expect(css).not.toContain("pointer-events");
    expect(css).toContain("color: red");
    expect(warnings.some((w) => w.includes("pointer-events"))).toBe(true);

    const { css: c2 } = sanitizeAndScopeCss(
      ".nj_chat_input_box { pointer-events: auto }",
      "abc",
    );
    expect(c2).not.toContain("pointer-events");
  });

  test("blocks cursor: none, keeps other cursor values", () => {
    const { css: c1, warnings } = sanitizeAndScopeCss(
      ".nj_chat_send_button { cursor: none }",
      "abc",
    );
    expect(c1).not.toContain("cursor");
    expect(warnings.some((w) => w.includes("cursor"))).toBe(true);

    const { css: c2 } = sanitizeAndScopeCss(
      ".nj_chat_send_button { cursor: pointer }",
      "abc",
    );
    expect(c2).toContain("cursor: pointer");
  });

  test("caps z-index above 100 down to 100", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { z-index: 9999 }",
      "abc",
    );
    expect(css).toContain("z-index: 100");
    expect(css).not.toContain("9999");
    expect(warnings.some((w) => w.includes("z-index"))).toBe(true);
  });

  test("z-index of 100 passes through unchanged", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { z-index: 100 }",
      "abc",
    );
    expect(css).toContain("z-index: 100");
  });

  test("z-index 101 gets clamped (boundary)", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { z-index: 101 }",
      "abc",
    );
    expect(css).toContain("z-index: 100");
  });

  test("z-index non-numeric (auto) passes through", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { z-index: auto }",
      "abc",
    );
    expect(css).toContain("z-index: auto");
  });

  test("blocks expression() in values", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { width: expression(alert(1)) }",
      "abc",
    );
    expect(css).not.toContain("expression");
    expect(warnings.some((w) => w.includes("expression"))).toBe(true);
  });

  test("blocks url(javascript:...)", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { background: url('javascript:alert(1)') }",
      "abc",
    );
    expect(css).not.toContain("javascript:");
    expect(warnings.some((w) => w.includes("javascript"))).toBe(true);
  });

  test("allows url(https://...) for background images", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { background: url('https://example.com/x.png') }",
      "abc",
    );
    expect(css).toContain("https://example.com/x.png");
  });

  test("data: url with embedded ; (MIME parameter) survives intact", () => {
    // 真实场景：外部导入的 CSS 用 data URL 内联 SVG 图标，MIME type 后接
    // ;charset=utf-8。朴素 split(";") 会把这条声明在 url() 内部砍成两半，
    // 重新拼接时插入 newline 进入字符串字面量，浏览器 parser 见无效字符
    // 串就放弃后续所有 rules。新版 splitDeclarations 跳过 paren / quote
    // 内的分号，URL 完整保留。
    const input = `.nj_x {
      -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3csvg viewBox='0 0 24 24'%3E%3Cpath d='M12 2v20'/%3E%3C/svg%3E") center/contain no-repeat;
      background: red;
    }`;
    const { css } = sanitizeAndScopeCss(input, "abc");
    // URL 内的 ; 不被切：output 仍是完整 url(...) 调用
    expect(css).toContain(
      "url(\"data:image/svg+xml;charset=utf-8,%3csvg viewBox='0 0 24 24'%3E%3Cpath d='M12 2v20'/%3E%3C/svg%3E\")",
    );
    // 后续声明仍能正常 sanitize
    expect(css).toContain("background: red");
  });

  test("paren / quote-aware split preserves multi-value declarations", () => {
    // 复杂背景值含 () 嵌套 + 分号在 url 内
    const input = `.foo {
      background: url("data:image/svg+xml;charset=utf-8,XX") top, linear-gradient(rgba(0,0,0,0.5), transparent);
      color: white;
    }`;
    const { css } = sanitizeAndScopeCss(input, "abc");
    expect(css).toContain("linear-gradient");
    expect(css).toContain("color: white");
  });

  test("skips declarations without colons", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { malformed; color: red }",
      "abc",
    );
    expect(css).toContain("color: red");
  });

  test("emits empty when every declaration is blocked", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_chat_input_container { position: fixed; pointer-events: none }",
      "abc",
    );
    expect(css).toBe("");
  });
});

describe("sanitizeAndScopeCss — @-rules", () => {
  test("blocks @import statements", () => {
    const { warnings } = sanitizeAndScopeCss(
      "@import url('https://evil.com/x.css'); .nj_x { color: red }",
      "abc",
    );
    expect(warnings.some((w) => w.includes("@import"))).toBe(true);
  });

  test("strips @import whose URL contains semicolons without eating the next rule", () => {
    // 回归：Google Fonts @import 的 wght 权重列表带分号（wght@0,400;0,700），
    // 旧正则遇到 URL 里第一个 `;` 就截断，残余垃圾粘到下一条规则选择器上，
    // 把紧跟其后的规则（往往是定义局部变量的作用域容器）整条吃掉（谢寻状态栏
    // 白块根因）。这里断言：@import 被干净剥掉，紧随其后的 .status-wrapper
    // 规则和它的 --status-bg 变量都存活。
    const input =
      "@import url('https://fonts.googleapis.com/css2?family=Playfair:ital,wght@0,400;0,700;1,400&display=swap');\n" +
      ".status-wrapper { --status-bg: rgba(60,50,48,0.7); color: red }";
    const { css, warnings } = sanitizeAndScopeCss(input, "abc");
    expect(warnings.some((w) => w.includes("@import"))).toBe(true);
    // 下一条规则必须完好存活
    expect(css).toContain('[data-character-css="abc"] .status-wrapper');
    expect(css).toContain("--status-bg: rgba(60,50,48,0.7)");
    // 不能有 @import 残渣泄漏成规则
    expect(css).not.toContain("wght");
    expect(css).not.toContain("googleapis");
  });

  test("blocks @font-face", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      "@font-face { font-family: evil; src: url('https://evil.com/f.woff') }",
      "abc",
    );
    expect(css).toBe("");
    expect(warnings.some((w) => w.includes("@font-face"))).toBe(true);
  });

  test("blocks @page", () => {
    const { warnings } = sanitizeAndScopeCss("@page { margin: 0 }", "abc");
    expect(warnings.some((w) => w.includes("@page"))).toBe(true);
  });

  test("blocks bodyless @-rules silently", () => {
    const { css } = sanitizeAndScopeCss(
      '@charset "UTF-8";\n.nj_ai_message_bubble { color: red }',
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
  });

  test("preserves @keyframes verbatim", () => {
    const { css } = sanitizeAndScopeCss(
      "@keyframes pulse { 0% { opacity: 0 } 100% { opacity: 1 } }",
      "abc",
    );
    expect(css).toContain("@keyframes pulse");
    expect(css).toContain("opacity: 0");
    expect(css).toContain("opacity: 1");
  });

  test("recurses into @media and scopes nested rules", () => {
    const { css } = sanitizeAndScopeCss(
      "@media (max-width: 768px) { .nj_ai_message_bubble { color: red } body { color: blue } }",
      "abc",
    );
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
    expect(css).not.toContain("body");
  });

  test("recurses into @supports", () => {
    const { css } = sanitizeAndScopeCss(
      "@supports (display: grid) { .nj_ai_message_bubble { display: grid } }",
      "abc",
    );
    expect(css).toContain("@supports (display: grid)");
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
    expect(css).toContain("display: grid");
  });
});

describe("sanitizeAndScopeCss — input normalization", () => {
  test("strips <style> tag wrappers creators paste", () => {
    const { css } = sanitizeAndScopeCss(
      "<style>.nj_ai_message_bubble { color: gold }</style>",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
    expect(css).toContain("color: gold");
    expect(css).not.toContain("<style");
  });

  test("strips ```css markdown fences the generator occasionally emits", () => {
    // The global-css generator prompt forbids fences, but the model still
    // wraps complex output in ```css ... ```. Without stripping, the opening
    // fence fuses with the first selector and the rule gets blocked.
    const { css } = sanitizeAndScopeCss(
      "```css\n.nj_ai_message_bubble { color: gold }\n```",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
    expect(css).toContain("color: gold");
    expect(css).not.toContain("`");
  });

  test("strips bare ``` fences without a language tag", () => {
    const { css } = sanitizeAndScopeCss(
      "```\n.nj_chat_header { background: black }\n```",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] .nj_chat_header');
    expect(css).toContain("background: black");
    expect(css).not.toContain("`");
  });

  test("strips CSS comments", () => {
    const { css } = sanitizeAndScopeCss(
      "/* explanatory */ .nj_ai_message_bubble { color: red /* inline */ }",
      "abc",
    );
    expect(css).not.toContain("explanatory");
    expect(css).not.toContain("inline");
    expect(css).toContain("color: red");
  });

  test("returns empty for empty input", () => {
    expect(sanitizeAndScopeCss("", "abc").css).toBe("");
    expect(sanitizeAndScopeCss("   \n  ", "abc").css).toBe("");
  });

  test("handles multiple rules in one string", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { color: red } .nj_user_message_bubble { color: blue }",
      "abc",
    );
    expect(css).toContain('[data-character-css="abc"] .nj_ai_message_bubble');
    expect(css).toContain('[data-character-css="abc"] .nj_user_message_bubble');
  });

  test("returns warnings array (never null/undefined)", () => {
    const { warnings } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { color: red }",
      "abc",
    );
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.length).toBe(0);
  });

  test("scope attribute is interpolated into every selector", () => {
    const { css } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { color: red }",
      "session-42",
    );
    expect(css).toContain('[data-character-css="session-42"]');
  });
});

describe("sanitizeAndScopeCss — render-time 外部选择器前缀 → nj_ fallback", () => {
  const P = LEGACY_SELECTOR_PREFIX;
  const WARNING = "外部选择器前缀";

  test(`class selector: ${LEGACY_SELECTOR_PREFIX}ai_message_bubble 被翻译并 scope`, () => {
    const { css } = sanitizeAndScopeCss(
      `.${P}ai_message_bubble { color: gold }`,
      "char-1",
    );
    expect(css).toContain(
      '[data-character-css="char-1"] .nj_ai_message_bubble',
    );
    expect(css).not.toContain(P);
  });

  test(`id selector: #${LEGACY_SELECTOR_PREFIX}chat_header 被翻译并 scope`, () => {
    const { css } = sanitizeAndScopeCss(
      `#${P}chat_header { background: #000 }`,
      "char-1",
    );
    expect(css).toContain('[data-character-css="char-1"] #nj_chat_header');
    expect(css).not.toContain(P);
  });

  test("混合旧前缀 + nj_ 都被 scope，不重复 / 不丢", () => {
    const { css } = sanitizeAndScopeCss(
      `.${P}message_narration { color: red } .nj_user_message_bubble { color: blue }`,
      "char-1",
    );
    expect(css).toContain(
      '[data-character-css="char-1"] .nj_message_narration',
    );
    expect(css).toContain(
      '[data-character-css="char-1"] .nj_user_message_bubble',
    );
    expect(css).not.toContain(P);
  });

  test("含旧前缀时 warnings 带提示", () => {
    const { warnings } = sanitizeAndScopeCss(
      `.${P}ai_message_bubble { color: gold }`,
      "char-1",
    );
    expect(warnings.some((w) => w.includes(WARNING))).toBe(true);
  });

  test("不含旧前缀时 warnings 不报这条", () => {
    const { warnings } = sanitizeAndScopeCss(
      ".nj_ai_message_bubble { color: gold }",
      "char-1",
    );
    expect(warnings.some((w) => w.includes(WARNING))).toBe(false);
  });

  test("@media 内的旧前缀也被翻译（递归 sanitize 沿用同一前置改名）", () => {
    const { css } = sanitizeAndScopeCss(
      `@media (min-width: 768px) { .${P}ai_message_bubble { color: red } }`,
      "char-1",
    );
    expect(css).toContain(
      '[data-character-css="char-1"] .nj_ai_message_bubble',
    );
    expect(css).not.toContain(P);
  });

  test("preserves CSS variables defined in :root by rewriting to scope root", () => {
    const { css, warnings } = sanitizeAndScopeCss(
      ":root { --primary: #f00; --secondary: #00f; } .nj_ai_message_bubble { color: var(--primary); }",
      "char-1",
    );
    // :root should be rewritten to [data-character-css="char-1"]
    expect(css).toContain('[data-character-css="char-1"] {\n--primary: #f00');
    expect(css).toContain("--secondary: #00f");
    expect(css).toContain(
      '[data-character-css="char-1"] .nj_ai_message_bubble',
    );
    expect(css).toContain("color: var(--primary)");
    expect(warnings.length).toBe(0);
  });

  test("rewrites :root with descendants", () => {
    const { css } = sanitizeAndScopeCss(
      ":root .custom-class { color: red }",
      "char-1",
    );
    expect(css).toContain('[data-character-css="char-1"] .custom-class');
  });

  test("rewrites html and body to scope root", () => {
    const { css } = sanitizeAndScopeCss(
      "html { font-size: 16px; } body { margin: 0; }",
      "char-1",
    );
    expect(css).toContain('[data-character-css="char-1"] {\nfont-size: 16px');
    expect(css).toContain('[data-character-css="char-1"] {\nmargin: 0');
  });
});
