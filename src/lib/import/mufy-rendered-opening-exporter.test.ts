import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

interface Capture {
  html: string;
  frameCount: number;
  greetingSha256: string;
  sourceBinding: unknown;
  layoutCapture: {
    version: number;
    authoredLayout: boolean;
    warnings: string[];
  };
}

const syntheticBinding = {
  roleId: "synthetic-role",
  greetingSha256: "a".repeat(64),
  responseCode: 200,
  observedAt: new Date().toISOString(),
};
async function capture(
  html: string,
  binding: unknown = syntheticBinding,
): Promise<Capture> {
  const dom = new JSDOM(html);
  let downloaded = "";
  // The exporter remains a browser-owned function. Only this synthetic DOM is
  // evaluated here; there are no source site requests, credentials or scripts.
  const source = await Bun.file(
    "scripts/export-mufy-rendered-opening.js",
  ).text();
  const run = new Function(
    "document",
    "location",
    "HTMLTemplateElement",
    "DOMParser",
    "getComputedStyle",
    "URL",
    "Blob",
    "setTimeout",
    source + "\nreturn exportMufyRenderedOpening;",
  )(
    dom.window.document,
    { href: "https://chat.mufy.ai/chat?roleId=synthetic-role" },
    dom.window.HTMLTemplateElement,
    dom.window.DOMParser,
    (element: Element, pseudo?: string) => {
      if (!pseudo) return dom.window.getComputedStyle(element);
      const style = dom.window.document.createElement("span").style;
      style.setProperty("content", "none");
      return style;
    },
    class CaptureURL extends URL {
      static createObjectURL() {
        return "blob:synthetic";
      }
      static revokeObjectURL() {}
    },
    class CaptureBlob {
      constructor(parts: string[]) {
        downloaded = parts.join("");
      }
    },
    () => 0,
  ) as (needle: string, binding: unknown) => unknown;
  dom.window.HTMLAnchorElement.prototype.click = () => {};
  try {
    run("synthetic opening", binding);
  } catch (error) {
    dom.window.close();
    throw error;
  }
  const result = JSON.parse(downloaded) as Capture;
  dom.window.close();
  return result;
}

test("opening exporter does not freeze resolved opposite insets for absolute labels", async () => {
  const result = await capture('<style>.label{position:absolute;top:-10px;left:12px}</style><div class="react-markdown">synthetic opening<div class="label">故事之外</div></div>');
  const dom = new JSDOM(result.html);
  const label = dom.window.document.querySelector('.label') as HTMLElement;
  expect(label.style.inset).toBe('');
  expect(label.style.right).toBe('');
  expect(label.style.bottom).toBe('');
  expect(dom.window.getComputedStyle(label).left).toBe('12px');
  expect(dom.window.getComputedStyle(label).top).toBe('-10px');
  dom.window.close();
});

test("opening exporter preserves authored responsive grid and constrained scroll layout", async () => {
  const result = await capture(
    `<style>.z-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.z-scroll{height:100px;max-height:100px;overflow:auto}@media(max-width:350px){.z-grid2{grid-template-columns:1fr}}</style><div class="react-markdown"><p>synthetic opening</p><div class="z-grid2"><div class="z-scroll">A</div><div class="z-scroll">B</div></div></div>`,
  );
  const output = new JSDOM(result.html);
  const css = output.window.document.querySelector(
    "style[data-mufy-source-layout]",
  )!.textContent!;
  expect(css).toContain("grid-template-columns:1fr 1fr");
  expect(css).toContain("@media");
  expect(css).toContain("height:100px");
  expect(css).toContain("max-height:100px");
  expect(css).toContain("overflow:auto");
  const grid = output.window.document.querySelector(".z-grid2") as HTMLElement;
  expect(grid.style.gridTemplateColumns).toBe("");
  expect(grid.style.width).toBe("");
  const scroll = output.window.document.querySelector(
    ".z-scroll",
  ) as HTMLElement;
  expect(scroll.style.height).toBe("");
  expect(scroll.style.overflow).toBe("");
  expect(result.layoutCapture.authoredLayout).toBe(true);
  expect(result.greetingSha256).toBe(syntheticBinding.greetingSha256);
  expect(result.sourceBinding).toEqual(syntheticBinding);
  output.window.close();
});
test("exporter rejects missing, unsuccessful, wrong-role and invalid-time response binding", async () => {
  const html = '<div class="react-markdown">synthetic opening</div>';
  for (const binding of [
    null,
    { ...syntheticBinding, responseCode: 401 },
    { ...syntheticBinding, roleId: "other" },
    { ...syntheticBinding, greetingSha256: "invalid" },
    { ...syntheticBinding, observedAt: "invalid" },
    {
      ...syntheticBinding,
      observedAt: new Date(Date.now() + 120_000).toISOString(),
    },
  ])
    await expect(capture(html, binding)).rejects.toThrow(
      "public detail response binding required",
    );
});

test("opening exporter retains standalone iframe head styles and authored inline dimensions", async () => {
  const dom = new JSDOM(
    `<div class="react-markdown"><p>synthetic opening</p><div id="inline-scroll" style="height:100px;overflow-y:auto">x</div><iframe></iframe></div>`,
  );
  const frame = dom.window.document.querySelector("iframe")!;
  frame.setAttribute(
    "srcdoc",
    '<html><head><style>.inside{display:grid;grid-template-columns:1fr 1fr}</style></head><body><div class="inside">fixture</div></body></html>',
  );
  const result = await capture(dom.window.document.documentElement.outerHTML);
  expect(result.frameCount).toBe(1);
  const output = new JSDOM(result.html);
  expect(
    output.window.document.querySelector("[data-mufy-source-frame] style")!
      .textContent,
  ).toContain("grid-template-columns:1fr 1fr");
  const scroll = output.window.document.querySelector(
    "#inline-scroll",
  ) as HTMLElement;
  expect(scroll.style.height).toBe("100px");
  expect(scroll.style.overflowY).toBe("auto");
  dom.window.close();
  output.window.close();
});

test("exporter refuses collapsed lazy drawer artifacts instead of accepting a partial card", async () => {
  const dom = new JSDOM('<div class="react-markdown">synthetic opening<details><summary>drawer</summary><iframe loading="lazy"></iframe></details></div>');
  dom.window.document.querySelector('iframe')!.setAttribute('srcdoc', '<body>public widget</body>');
  await expect(capture(dom.window.document.documentElement.outerHTML)).rejects.toThrow('SOURCE_DRAWER_EXPANSION_REQUIRED');
  dom.window.document.querySelector('details')!.setAttribute('open', '');
  const result = await capture(dom.window.document.documentElement.outerHTML);
  expect(result.frameCount).toBe(1);
  expect(result.html).toContain('public widget');
  dom.window.close();
});

test("exporter refuses empty preview placeholders", async () => {
  await expect(capture('<div class="react-markdown">synthetic opening<iframe loading="lazy"></iframe></div>')).rejects.toThrow('SOURCE_FRAME_NOT_READY');
});
