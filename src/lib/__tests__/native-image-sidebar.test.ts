import { expect, test } from "bun:test";
import {
  extractNativeImageSidebars,
  nativeImageSidebarEnvelope,
  safeNativeTriggerForeground,
} from "../opening/native-image-sidebar";
import {
  interpolateOpening,
  routeOpeningContentSplit,
} from "../opening/content";

const spec = {
  version: 1 as const,
  shellHtml:
    '<details class="mufy-side-r"><summary class="mufy-side-btn"><img class="mufy-side-icon"></summary><div class="mufy-side-panel"><div data-nj-native-documents></div></div></details>',
  css: ".mufy-side-r{color:inherit}",
  triggerForeground: 'rgb(242, 243, 245)',
  documents: [
    '<html><body><script>var fixture="{{user}}";</script><p>one</p></body></html>',
    "<html><body><p>two</p></body></html>",
  ],
};

test('V21 music requires its explicit shell and one opaque program',()=>{
 const player={...spec,variant:'static-music' as const,shellHtml:'<details class="static-music-sidebar"><summary class="static-music-trigger"><img alt="打开音乐播放器"></summary><div class="static-music-panel"><div data-nj-native-documents></div></div></details>',documents:[spec.documents[0]]};
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(player)).sidebars).toEqual([player]);
 expect(routeOpeningContentSplit(nativeImageSidebarEnvelope(player),'v21').inline).toBeNull();
 for(const invalid of [{...player,shellHtml:spec.shellHtml},{...player,documents:[]},{...player,documents:spec.documents}])expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(invalid)).sidebars).toHaveLength(0);
});

test('ins music envelope needs its observed shell and one opaque program',()=>{
 const ins={...spec,variant:'ins-music' as const,shellHtml:'<details class="ins-music-sidebar"><summary class="ins-trigger"></summary><div class="ins-host-panel"><div data-nj-native-documents></div></div></details>',documents:[spec.documents[0]]};
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(ins)).sidebars).toEqual([ins]);
 expect(routeOpeningContentSplit(nativeImageSidebarEnvelope(ins),'ins').inline).toBeNull();
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...ins,shellHtml:spec.shellHtml})).sidebars).toHaveLength(0);
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...ins,documents:[]})).sidebars).toHaveLength(0);
});
test("native envelope routes all independent documents once without changing other opening blocks", () => {
  const content = "<p>outside</p>" + nativeImageSidebarEnvelope(spec);
  const result = routeOpeningContentSplit(content, "test");
  expect(result.floating).toHaveLength(1);
  expect(result.floating[0].nativeImageSidebar?.documents).toEqual(
    spec.documents,
  );
  expect(result.inline).toEqual(
    routeOpeningContentSplit("<p>outside</p>", "test").inline,
  );
  expect(JSON.stringify(result.inline)).not.toContain("fixture");
});
test("inert envelope survives template closers and quoted user names", () => {
  const content = nativeImageSidebarEnvelope(spec);
  expect(content).not.toContain("<script>");
  const interpolated = interpolateOpening("<p>{{user}}</p>" + content, {
    char: "c",
    user: 'a"b',
  });
  expect(interpolated).toContain('<p>a"b</p>');
  expect(extractNativeImageSidebars(interpolated).sidebars).toEqual([spec]);
});
test("invalid or nested-frame payload is not activated or silently removed", () => {
  for (const s of [
    { ...spec, version: 2 },
    { ...spec, documents: [] },
    { ...spec, documents: [spec.documents[0], spec.documents[0]] },
    { ...spec, framePresentation: { minHeight: 99999, borderRadius: 12 } },
    { ...spec, triggerForeground:'rgb(999, 1, 1)' },
    { ...spec, triggerForeground:'white;}body{display:none}' },
    { ...spec, documents: ['<iframe src="https://example.com"></iframe>'] },
    { ...spec, documents: ["<script>__MUFY_ARTIFACT_BRIDGE__</script>"] },
  ]) {
    const raw = nativeImageSidebarEnvelope(s as typeof spec);
    expect(extractNativeImageSidebars(raw).sidebars).toHaveLength(0);
    expect(extractNativeImageSidebars(raw).rest).toBe(raw);
  }
});

test('source inherited trigger color is normalized without allowing arbitrary CSS',()=>{
 expect(safeNativeTriggerForeground('rgb(242,243,245)')).toBe('rgb(242, 243, 245)');
 for(const value of ['red','rgb(999, 1, 1)','url(https://example.com)',null])expect(safeNativeTriggerForeground(value)).toBeNull();
});

test('observed glass music shell routes one opaque document without enabling arbitrary variants',()=>{
 const music={...spec,variant:'glass-music' as const,shellHtml:'<details class="glass-music-sidebar"><summary class="glass-trigger"></summary><div class="glass-panel"><div data-nj-native-documents></div></div></details>',documents:[spec.documents[0]]};
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(music)).sidebars).toEqual([music]);
 expect(routeOpeningContentSplit(nativeImageSidebarEnvelope(music),'music').floating[0].nativeImageSidebar?.variant).toBe('glass-music');
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...music,shellHtml:spec.shellHtml})).sidebars).toHaveLength(0);
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...music,variant:'arbitrary'} as unknown as typeof music)).sidebars).toHaveLength(0);
});

test('pixel music program stays inside its observed native drawer, not duplicated inline',()=>{
 const pixel={...spec,variant:'pixel-music' as const,shellHtml:'<details class="sidebar-music-box"><summary></summary><div class="content-fixed-area"><div data-nj-native-documents></div></div></details>',documents:[spec.documents[0]]};
 const routed=routeOpeningContentSplit(nativeImageSidebarEnvelope(pixel),'pixel');
 expect(routed.floating[0].nativeImageSidebar?.variant).toBe('pixel-music');
 expect(routed.inline).toBeNull();
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...pixel,shellHtml:spec.shellHtml})).sidebars).toHaveLength(0);
});

test('focus sidebar shell has an explicit variant and one isolated program',()=>{
 const black={...spec,variant:'black-focus' as const,shellHtml:'<div><div class="midnight-black-trigger" tabindex="0"></div><div class="midnight-black-container"><div data-nj-native-documents></div></div></div>',documents:[spec.documents[0]]};
 const routed=routeOpeningContentSplit(nativeImageSidebarEnvelope(black),'black');
 expect(routed.floating[0].nativeImageSidebar?.variant).toBe('black-focus');
 expect(routed.inline).toBeNull();
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...black,shellHtml:spec.shellHtml})).sidebars).toHaveLength(0);
});

test('centered Zen player requires its own inert shell and remains a floating opaque document',()=>{
 const zen={...spec,variant:'zen-music' as const,shellHtml:'<details class="zen-music-sidebar"><summary class="zen-trigger"></summary><div class="zen-host-panel"><div data-nj-native-documents></div></div></details>',documents:[spec.documents[0]]};
 const routed=routeOpeningContentSplit(nativeImageSidebarEnvelope(zen),'zen');
 expect(routed.floating[0].nativeImageSidebar?.variant).toBe('zen-music');expect(routed.inline).toBeNull();
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope({...zen,shellHtml:spec.shellHtml})).sidebars).toHaveLength(0);
});
test('native cloud player requires a bounded public playlist and no author documents',()=>{
 const cloud={...spec,variant:'cloud-music' as const,shellHtml:'<div id="wrapper" class="cloud-music-sidebar"><div id="panel"><audio id="audio"></audio></div></div>',documents:[],cloudMusic:{id:'fixture',tracks:[{title:'Public song',src:'https://example.com/original.mp3'}],lineHeight:1.8,initialDisabled:true}};
 expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(cloud)).sidebars).toEqual([cloud]);expect(routeOpeningContentSplit(nativeImageSidebarEnvelope(cloud),'cloud').floating[0].nativeImageSidebar?.variant).toBe('cloud-music');
 for(const invalid of [{...cloud,documents:[spec.documents[0]]},{...cloud,cloudMusic:{...cloud.cloudMusic,lineHeight:999}},{...cloud,cloudMusic:{...cloud.cloudMusic,tracks:[{title:'bad',src:'javascript:alert(1)'}]}}])expect(extractNativeImageSidebars(nativeImageSidebarEnvelope(invalid)).sidebars).toHaveLength(0);
});
