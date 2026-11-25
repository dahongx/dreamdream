import { expect, test } from "bun:test";
import { adaptMufyRuntime } from "../import/mufy-runtime-adaptation";
import { routeOpeningContentSplit } from "../opening/content";

test("cloud template becomes an isolated floating player, not an omitted widget", () => {
  const source = {
    characterId: "one",
    name: "fixture",
    greeting: "<云朵播放器>正文",
    codeRenderContent:
      '```html\n<template id="censy-eternal-nano-cloud"><details class="censy-nano-sidebar"><summary>☁</summary></details></template><script>window.parent.example=1;</script>\n```',
  };
  const fixed = adaptMufyRuntime(source),
    route = routeOpeningContentSplit(fixed.component, "fixture");
  expect(fixed.opening).toBe("正文");
  expect(route.floating.length).toBe(1);
  expect(route.floating[0].meta.needsShim).toBe(true);
  expect(fixed.component).toContain("window.parent.example");
  expect(source.greeting).toContain("云朵");
});
test("settings and deck use separate anchors and observe actual open state", () => {
  const fixed = adaptMufyRuntime({
    characterId: "one",
    name: "fixture",
    codeRenderContent:
      '```html\n<template id="censy-setting-vue-permanent-v1"></template>\n```\n```html\n<template id="censy-abyss-mp3-v3-permanent"></template>\n```',
  });
  const route = routeOpeningContentSplit(fixed.component, "fixture");
  expect(route.floating.length).toBe(1);
  expect(fixed.component).toContain("MutationObserver");
  expect(fixed.repairs).toContain("shared-sidebar-hit-area");
});
test("custom actions come from visible unlocked source items and only fill composer", () => {
  const fixed = adaptMufyRuntime({
    characterId: "one",
    name: "fixture",
    greeting: "正文<定制指令组件正则>",
    items: {
      items: [
        {
          actions: [{ actionName: "继续", actionPrompt: "$continue</script>" }],
        },
        {
          isLocked: true,
          actions: [{ actionName: "锁定", actionPrompt: "secret" }],
        },
      ],
    },
  });
  expect(fixed.opening).toBe("正文");
  expect(fixed.component).toContain("host.fillComposer");
  expect(fixed.component).not.toContain("host.sendMessage");
  expect(fixed.component).not.toContain("secret");
  expect(fixed.component).not.toContain("$continue</script>");
});
test("unknown placeholder is preserved, mobile repair stays in sandbox", () => {
  const fixed = adaptMufyRuntime({
    characterId: "one",
    name: "fixture",
    greeting: "<未知组件>正文",
    codeRenderContent:
      '```html\n<style>.card{width:100%;padding:30px}</style><div class="card">正文</div>\n```',
  });
  expect(fixed.opening).toContain("未知组件");
  expect(fixed.component).toContain("box-sizing:border-box");
  expect(fixed.component).toContain("max-width:480px");
});
test("height repair reaches every document inside a shared source fence", () => {
  const fixed=adaptMufyRuntime({characterId:"one",name:"fixture",codeRenderContent:'```html\n<html><body><details>A</details></body></html><html><body><details>B</details></body></html>\n```'});
  expect(fixed.component.match(/content-height/g)?.length).toBe(3);
  expect(fixed.component).not.toContain('Math.max(document.body.scrollHeight');
  expect(fixed.component).toContain("document.addEventListener('toggle'");
});
test("raw source tail sidebar is checked in preview, not only fenced HTML", () => {
  const fixed=adaptMufyRuntime({characterId:"one",name:"fixture",codeRenderContent:'```html\n<div>Theater</div>\n```\n<div class="ghost-sidebar-container">menu</div>'});
  expect(fixed.repairs).toContain('host-sidebar-not-in-empty-preview');
  expect(fixed.component).toContain('window.host.getHistory()');
});
test("visual system content is not stripped as prompt metadata", () => {
  const fixed=adaptMufyRuntime({characterId:"one",name:"fixture",greeting:'A<system>visible</system>B'});
  expect(fixed.opening).toBe('A<sys>visible</sys>B');
});
