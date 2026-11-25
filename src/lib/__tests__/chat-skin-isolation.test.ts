import { expect, test } from "bun:test";
import { sanitizeAndScopeCss } from "../styling/whitelist";
import { closeStyleBlockAtEof } from "../styling/style-block-boundary";

test("imported controls keep paint but reserve host layout and functional labels", () => {
  const { css } = sanitizeAndScopeCss(`#mufy_header_more_btn{position:absolute;right:15px;font-size:0;color:transparent;border-color:red}
    #mufy_header_more_btn::after{content:"More";color:red}
    #mufy_chat_input_model_btn::before{content:"CORE"}
    .nj_ai_message_bubble::before{content:"chapter"}
    #mufy_chat_input_replay_btn::after{content:"";background:red}`, "test");
  const root = '[data-character-css="test"] ';
  expect(css).toContain(`${root}${'#nj_header_more_btn'.repeat(10)}::after { content: none !important; }`);
  expect(css).toContain(`${root}${'#nj_chat_input_model_btn'.repeat(10)}::before { content: none !important; }`);
  expect(css).toContain(`${root}${'#nj_header_more_btn'.repeat(10)} > svg { display: block !important; visibility: visible !important; opacity: 1 !important; }`);
  expect(css).not.toContain(`${root}${'#nj_chat_input_replay_btn'.repeat(10)} > svg`);
  expect(css).not.toContain(`${'#nj_chat_input_replay_btn'.repeat(10)}::after { content: none`);
  expect(css).toContain('content: "chapter"');
  expect(css).toContain('border-color: red');
  expect(css).toContain('position: relative !important; inset: auto !important');
  expect(css).not.toContain('display: inline-flex !important');
});

test("legacy layout guard handles responsive labels while keeping stage paint source-only", () => {
  const { css } = sanitizeAndScopeCss('@media(max-width:600px){#mufy_chat_input_replay_btn::before{content:"RETRY"!important}}', 'test');
  expect(css).toContain(`[data-character-css="test"] ${'#nj_chat_input_replay_btn'.repeat(10)}::before { content: none !important; }`);
  expect(css).toContain(':where(#nj_chat_header, #nj_chat_input_container) { background-color: transparent;');
});

test("imported toolbar unifies a neutral model surface with replay without copying layout or labels", () => {
  const { css } = sanitizeAndScopeCss(`
    #mufy_chat_input_model_btn { background: var(--button-model-bg) !important; }
    #mufy_chat_input_replay_btn { background-color: var(--replay-btn-bg) !important; color: ivory; width: 32px; }
    @media(max-width:600px){#mufy_chat_input_replay_btn:hover{background-color:maroon}}
    #mufy_chat_input_replay_btn::before {content:"RETRY"}
  `, 'test');
  const sourceModel = `[data-character-css="test"] ${'#nj_chat_input_model_btn'.repeat(10)}`;
  expect(css).toContain(`${sourceModel} {\nbackground-color: var(--replay-btn-bg) !important;\ncolor: ivory !important;`);
  expect(css).toContain(`${sourceModel}:hover {\nbackground-color: maroon !important;`);
  expect(css).toContain('#nj_chat_input_model_btn {\nbackground: var(--button-model-bg) !important\n}');
  expect(css).not.toContain(`${sourceModel} {\nwidth: 32px`);
});

test("imported scenes keep empty compatibility buttons hidden and clear standalone model skin", () => {
  const { css } = sanitizeAndScopeCss('#mufy_chat_input_model_btn{background:purple} #mufy_header_follow_btn{display:flex}', 'test');
  expect(css).toContain('[aria-hidden="true"] { display: none !important; }');
  expect(css).toContain('background: var(--surface-glass) !important; border: 1px solid var(--border-subtle) !important;');
});

test("header equivalents do not repeat a menu glyph encoded as an SVG background", () => {
  const { css } = sanitizeAndScopeCss('#nj_header_more_btn{background-image:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E");border-color:skyblue}', 'test');
  const fallback = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].find((match) => match[1].includes('#nj_review_btn') && match[2].includes('skyblue'))?.[2];
  expect(fallback).toContain('border-color: skyblue');
  expect(fallback).not.toContain('data:image/svg');
});

test("restoring hidden replay text also restores family currentColor borders", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_replay_btn{color:transparent;font-size:0;border:1px solid}', 'test');
  const family = ['nj_chat_input_replay_btn','nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher'].map(id=>`[data-character-css="test"] ${('#'+id).repeat(10)}`).join(', ');
  expect(css).toContain(`${family} { color: var(--text-primary) !important; }`);
});

test("legacy generic button paint excluding model still supplies the toolbar family", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_model_btn{background:gray} button:not([style*="linear-gradient"]):not(#nj_chat_header button):not(#nj_chat_input_model_btn){background:skyblue;border:1px solid blue}', 'test');
  expect(css).toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nbackground: skyblue !important;`);
});

test("header-only paint and rules explicitly excluding replay are not family donors", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_header button{background:purple} button:not(#nj_chat_input_replay_btn){background:red} #nj_chat_input_model_btn{background:gray}', 'test');
  expect(css).not.toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nbackground: red !important;`);
  expect(css).not.toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nbackground: purple !important;`);
});

test("legacy attribute exclusion of replay is not a donor and clears generic sibling paint", () => {
  for (const exclusion of ['[id*="nj_chat_input_replay_btn"]','[id="nj_chat_input_replay_btn"]','#nj_chat_input_replay_btn']) {
    const { css } = sanitizeAndScopeCss(`#nj_chat_header button{border-color:gold} button:not(${exclusion}):not([style*="linear-gradient"]){background:saddlebrown;border:1px solid gold}`, 'test');
    expect(css).not.toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nbackground: saddlebrown !important;`);
    for (const id of ['nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher']) {
      expect(css).toContain(`${('#'+id).repeat(10)}`);
    }
    expect(css).toContain('background: var(--surface-glass) !important; border: 1px solid var(--border-subtle) !important;');
  }
});

test("a filtered bare button selector cannot resurrect shared container paint on the model", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_box, #nj_chat_header, button{border:1px solid crimson;box-shadow:inset 0 0 8px black} button:not([id*="nj_chat_input_replay_btn"]){background:maroon}', 'test');
  expect(css).not.toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nborder: 1px solid crimson !important;`);
  expect(css).not.toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nbox-shadow: inset`);
  expect(css).toContain('box-shadow: none !important;');
});

test("without a replay paint donor the default reset includes replay itself", () => {
  const { css } = sanitizeAndScopeCss('button{background:transparent} #nj_chat_header{border-color:silver}', 'test');
  const reset=css.match(/([^{}]+)\{\s*background: var\(--surface-glass\) !important;[^}]+\}/)?.[1];
  for (const id of ['nj_chat_input_replay_btn','nj_mask_btn','nj_chat_input_model_btn','nj_currency_switcher']) {
    expect(reset).toContain(('#'+id).repeat(10));
  }
});

test("source model outer shell survives its inner label reset", () => {
  const { css } = sanitizeAndScopeCss(`
    button[class*="relative"][class*="rounded-lg"]:has(#mufy_chat_input_model_btn){border:1px solid #7A0000!important;box-shadow:0 0 12px #7A0000!important}
    #mufy_chat_input_model_btn{border:none!important;box-shadow:none!important;background:transparent!important}
    #mufy_chat_input_model_btn::before{content:"CORE"}
  `, 'test');
  expect(css).toContain('#nj_chat_input_model_btn#nj_chat_input_model_btn#nj_chat_input_model_btn {');
  expect(css).toContain('border: 1px solid #7A0000!important');
  expect(css).not.toContain(':has(#nj_chat_input_model_btn)');
  expect(css).toContain('content: "CORE"');
});

test("model shell mapping retains hover and media conditions", () => {
  const { css } = sanitizeAndScopeCss('@media(max-width:600px){button.relative:has(#mufy_chat_input_model_btn):hover{border-color:red}}', 'test');
  expect(css).toContain('@media (max-width:600px)');
  expect(css).toContain('#nj_chat_input_model_btn#nj_chat_input_model_btn#nj_chat_input_model_btn:hover');
  expect(css).toContain('border-color: red');
});

test("mask retains glow using replay border hue instead of neutral icon", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_replay_btn{border:1px solid var(--blood, rgb(120, 0, 0));color:white}', 'test');
  expect(css).toContain('--nj-mask-active-color: var(--blood, rgb(120, 0, 0))');
  expect(css).toContain('box-shadow: 0 0 6px var(--nj-mask-active-color, currentColor) !important');
});
test("explicit mask activation appearance is not overwritten by forced glow", () => {
  const { css } = sanitizeAndScopeCss('#nj_mask_btn[data-active]{box-shadow:0 0 8px gold}', 'test');
  expect(css).toContain('box-shadow: 0 0 8px gold');
  expect(css).not.toContain('outline: 2px solid');
});
test("explicit mask skin does not inherit replay border", () => {
  const { css } = sanitizeAndScopeCss('#nj_mask_btn{border-color:gold} #nj_chat_input_replay_btn{border-color:red}', 'test');
  expect(css).toContain('--nj-mask-active-color: gold');
  expect(css).not.toContain('--nj-mask-active-color: red');
});
test("header fallback copies theme without dimensions and leaves explicit controls alone", () => {
  const { css } = sanitizeAndScopeCss('#nj_header_more_btn{width:32px;border-color:red} #nj_review_btn{border-color:gold}', 'test');
  expect(css).toContain('#nj_back_button');
  expect(css.match(/#nj_review_btn \{/g)?.length).toBe(1);
  const fallback = css.match(/#nj_back_button[^{}]*\{([^}]+)\}/)?.[1];
  expect(fallback).toContain('border-color: red');
  expect(fallback).not.toContain('width');
});

test("model without a skin follows replay chrome, not its label", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_replay_btn{background:red;border:1px solid gold} #nj_chat_input_replay_btn::before{content:"REPLAY"}', "test");
  expect(css).toContain('#nj_chat_input_model_btn {\nbackground: red');
  expect(css).not.toContain('#nj_chat_input_model_btn::before');
});
test("legacy model paint follows replay across media without forcing source geometry", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_model_btn{background:blue} @media(max-width:600px){#nj_chat_input_replay_btn{background:red}}', "test");
  expect(css.match(/\] #nj_chat_input_model_btn \{/g)?.length).toBe(1);
  expect(css).toContain("background: blue");
  expect(css).toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nbackground: red !important;`);
});

test("a truncated function cannot swallow toolbar compatibility at the stylesheet tail", () => {
  const { css, warnings } = sanitizeAndScopeCss('#nj_chat_input_model_btn{background:gray} #nj_chat_input_replay_btn{background:red} .fold{color:white;background:linear-gradient(90deg,rgba(1', 'test');
  expect(warnings).toContain('malformed declaration dropped: background');
  expect(css).not.toContain('linear-gradient(90deg');
  expect(css).toContain(`${'#nj_chat_input_model_btn'.repeat(10)} {\nbackground: red !important;`);
});

test("malformed body background is discarded without losing valid declaration or host tail", () => {
  const { css } = sanitizeAndScopeCss('body{color:white;background:linear-gradient(90deg,rgba(1} #nj_chat_input_replay_btn{background:red}', 'test');
  expect(css).not.toContain('linear-gradient');
  expect(css).toContain('color: white');
  expect(css).toContain('background: red !important');
});
test("source input-descendant model contract targets actual toolbar", () => {
  const { css } = sanitizeAndScopeCss('#mufy_chat_input_box #mufy_chat_input_model_btn{background:blue}', "test");
  expect(css).toContain('#nj_chat_input_container #nj_chat_input_model_btn');
});
test("no authored skin creates no toolbar skin", () => {
  expect(sanitizeAndScopeCss('', 'test').css).toBe('');
  expect(sanitizeAndScopeCss('.nj_ai_message_bubble{color:red}', 'test').css).not.toContain('#nj_chat_input_model_btn');
});

test("color-only replay skin also reaches the model control", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_replay_btn{color:white}', 'test');
  expect(css).toContain('#nj_chat_input_model_btn {\ncolor: white');
  expect(css).not.toMatch(/\{\s*\}/);
});
test("model fallback copies chrome but never replay fixed icon width", () => {
  const { css } = sanitizeAndScopeCss('#nj_chat_input_replay_btn{width:32px;transform:rotate(5deg);background:red;color:white}', 'test');
  const block = css.match(/#nj_chat_input_model_btn\s*\{([^}]+)\}/)?.[1];
  expect(block).toContain('background: red');
  expect(block).toContain('color: white');
  expect(block).not.toContain('width:');
  expect(block).not.toContain('transform:');
});
test("stylesheet EOF cannot swallow a following root and input skin", () => {
  const first = closeStyleBlockAtEof('.old{color:red; /* unfinished');
  const second = closeStyleBlockAtEof(':root{--input-box-bg:rgba(0,0,0,.2);--backdrop-blur-radius:12px} #nj_chat_input_box{background:var(--input-box-bg)}');
  const { css } = sanitizeAndScopeCss(first + second, 'test');
  expect(css).toContain('[data-character-css="test"] {\n--input-box-bg:');
  expect(css).toContain('[data-character-css="test"] #nj_chat_input_box');
});
test("quoted braces, escapes and comments do not change valid blocks", () => {
  const css = '.a{content:"}";background:url("data:image/svg+xml,{hi}")}';
  expect(closeStyleBlockAtEof(css)).toBe(css + '\n');
});
test("recovered stylesheet still passes security restrictions", () => {
  const { css } = sanitizeAndScopeCss(closeStyleBlockAtEof('#nj_chat_header{position:fixed;pointer-events:auto;background:url(javascript:bad)'), 'test');
  expect(css).not.toContain('javascript:');
  expect(css).not.toContain('position: fixed');
  expect(css).not.toContain('pointer-events: auto');
});
