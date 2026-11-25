import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import {
  hasPublicCommandCopy,
  hasPublicMemoryCommandCopy,
  sourceComponentFallbacks,
} from "../regex/iframe-bridge";

const memory = `<div class="memory-plugin-stage"><div class="plugin-list">${
  Array.from({ length: 6 }, (_, index) => {
    const id = `cmd${index + 1}`;
    return `<div class="code-row"><code class="cmd-text" id="${id}">公开指令${index + 1}</code><button class="copy-btn" onclick="copyCmd('${id}', this)">复制 ⋆</button></div>`;
  }).join("")
}</div></div><script>function copyCmd(elementId, btnElement) {
  const textToCopy = document.getElementById(elementId).innerText;
  window.host.fillComposer(textToCopy).then(() => {});
}</script>`;

test("memory tutorial recognition requires the observed structure and six command IDs", () => {
  expect(hasPublicMemoryCommandCopy(memory)).toBe(true);
  expect(hasPublicCommandCopy(memory)).toBe(true);
  expect(hasPublicMemoryCommandCopy(memory.replaceAll("cmd6", "other"))).toBe(false);
  expect(hasPublicMemoryCommandCopy(memory.replace("memory-plugin-stage", "other"))).toBe(false);
});

test("memory copy requests the host clipboard and waits for its receipt without filling the draft", () => {
  const fallback = sourceComponentFallbacks(memory);
  expect(fallback).not.toContain("host.fillComposer");
  expect(fallback).not.toContain("readText");
  const script = fallback.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeDefined();
  const dom = new JSDOM(memory, { runScripts: "outside-only" });
  try {
    const form = dom.window.document.querySelector(".memory-plugin-stage")!;
    const button = form.querySelector<HTMLButtonElement>("button")!;
    let click: ((event: unknown) => void) | undefined;
    const originalAdd = form.addEventListener.bind(form);
    form.addEventListener = ((type, listener, options) => {
      if (type === "click") click = listener as (event: unknown) => void;
      else originalAdd(type, listener, options);
    }) as typeof form.addEventListener;
    const requests: unknown[] = [];
    dom.window.postMessage = ((message: unknown) => requests.push(message)) as typeof dom.window.postMessage;
    dom.window.eval(script!);
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
    button.click();
    expect(requests).toHaveLength(0);
    click!({ target: button, isTrusted: true, preventDefault() {}, stopImmediatePropagation() {} });
    expect(requests).toEqual([{ type: "nj-oc-profile-copy", id: 1, text: "公开指令1" }]);
    expect(button.dataset.copyResult).toBe("pending");
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      source: dom.window,
      data: { type: "nj-oc-profile-copy-result", id: 1, ok: true },
    }));
    expect(button.dataset.copyResult).toBe("copied");
    expect(button.textContent).toBe("已复制 ♡");
    const buttons = form.querySelectorAll<HTMLButtonElement>("button");
    for (let index = 1; index < buttons.length; index++) {
      const next = buttons[index];
      const id = index + 1;
      click!({ target: next, isTrusted: true, preventDefault() {}, stopImmediatePropagation() {} });
      expect(requests.at(-1)).toEqual({
        type: "nj-oc-profile-copy", id, text: `公开指令${id}`,
      });
      dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
        source: dom.window,
        data: { type: "nj-oc-profile-copy-result", id, ok: true },
      }));
      expect(next.dataset.copyResult).toBe("copied");
    }
  } finally {
    dom.window.close();
  }
});
