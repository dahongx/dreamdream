import { expect,test } from 'bun:test';
import { collectMufySharedComponentStyle,withMufySharedComponentStyle } from '../import/mufy-shared-component-style';
const css='.mf-fire-widget{position:fixed}.mf-fire-panel{color:cyan;background:navy}';
const src='<style data-mufy-source-skin>.story{color:white}</style><details class="mf-fire-widget"><summary>Fire</summary><div class="mf-fire-panel">Actual quest</div></details>';
test('public source component CSS reaches only matching source message canvases',()=>{
  const catalog=collectMufySharedComponentStyle([{content:`<script>neverForward()</script><style>${css}</style>`}]);
  expect(catalog).toBe(css);
  expect(catalog).not.toContain('neverForward');
  expect(withMufySharedComponentStyle(src,catalog)).toContain(css);
  expect(withMufySharedComponentStyle(src,catalog)).toContain('Actual quest');
  expect(withMufySharedComponentStyle(src,catalog)).toContain('.mf-fire-widget{display:none!important}');
  expect(withMufySharedComponentStyle(src,catalog)).not.toContain('position:relative;top:auto;right:auto');
  expect(withMufySharedComponentStyle('<details class="mf-fire-widget"></details>',catalog)).toBe('<details class="mf-fire-widget"></details>');
  expect(withMufySharedComponentStyle('<style data-mufy-source-skin></style><p>other</p>',catalog)).not.toContain(css);
});
test('explicit reply styles and empty catalogs are not overridden',()=>{
  const authored=src+`<style>${css}</style>`;
  const result=withMufySharedComponentStyle(authored,css);
  expect(result.indexOf('data-mufy-shared-component>')).toBeLessThan(result.indexOf('data-mufy-source-skin'));
  expect(result).toContain(authored);
  expect(withMufySharedComponentStyle(src,'')).toBe(src);
});
test('mixed host themes, markup escapes and oversized blocks fail closed',()=>{
  for(const content of [`<style>body{background:black}${css}</style>`,`<style>:root{--x:1}${css}</style>`,`<style>${css}/*x*/<script>bad()</script></style>`,`<style>${css}${' '.repeat(32768)}</style>`])
    expect(collectMufySharedComponentStyle([{content}])).toBe('');
});
test('repeated public component copies are deduplicated',()=>{
  expect(collectMufySharedComponentStyle([{content:`<style>${css}</style><style>${css}</style>`}])).toBe(css);
});

test('public memory drawer skin is preserved for latest-reply viewport rendering',()=>{
 const memory='.right-stable-sidebar{position:fixed;top:50%}.right-sidebar-content{background:transparent}.system-protocol-lock{display:none}';
 expect(collectMufySharedComponentStyle([{content:`<style>${memory}</style>`}])).toBe(memory);
 expect(collectMufySharedComponentStyle([{content:`<style>body{color:red}${memory}</style>`}])).toBe('');
});
test('real public FML component has a reusable terminal skin, without reading prompts',async()=>{
  const snapshot=await Bun.file('logs/mufy-profiles/full-20261013/pilot-5/char_6e3124e6065bbcd98988/mufy-runtime-rendered-20261015.json').json();
  const catalog=collectMufySharedComponentStyle([{content:snapshot.detail.data.codeRenderContent}]);
  expect(catalog).toContain('.mf-fire-widget');
  expect(catalog).toContain('.mf-fire-panel');
  expect(catalog).toContain('.m-state-wrapper');
  expect(catalog).toContain('.m-state-fold');
  expect(catalog).toContain('#A5E0D0');
  expect(catalog).not.toContain('<script');
  expect(withMufySharedComponentStyle(src,catalog)).toContain('data-mufy-shared-component-layout');
});

test('status-only replies also inherit their creator skin, not just the fire terminal',()=>{
 const state='.m-state-wrapper{width:100%}.m-state-fold{border:1px solid cyan}';
 const catalog=collectMufySharedComponentStyle([{content:`<style>${state}</style>`}]);
 const reply='<style data-mufy-source-skin></style><details class="m-state-fold"><summary>状态</summary></details>';
 expect(withMufySharedComponentStyle(reply,catalog)).toContain(state);
});
