import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import {
  buildMufyComposerCompanionFrame,
  companionControlAction,
  companionDraftIntent,
  extractMufyComposerCompanion,
  validateCompanionBounds,
} from "../mufy-composer-companion";

const program = `(function(){const p = window.parent; const target=p.document.querySelector('#mufy_chat_input_box');const htmlStr = '<div id="censy-pet-companion-v1"><img id="censy-pet-avatar"><div id="censy-pet-bubble"></div></div>';target.innerHTML=htmlStr;p.censyPetSpeak=function(){};})();`;

test("only a single known public composer script is extracted, not source bookkeeping or prose", () => {
  expect(extractMufyComposerCompanion(`<script>${program}</script>`)).toBe(
    program,
  );
  expect(extractMufyComposerCompanion(program)).toBeNull();
  expect(
    extractMufyComposerCompanion(
      `<script>/* __MUFY_ARTIFACT_BRIDGE__ */${program}</script>`,
    ),
  ).toBeNull();
  expect(
    extractMufyComposerCompanion(
      `<script>${program}</script><script>${program}</script>`,
    ),
  ).toBeNull();
  expect(
    extractMufyComposerCompanion(
      `<script>${program.replace("censy-pet-avatar", "different-pet")}</script>`,
    ),
  ).toBeNull();
});

test("draft classification preserves author priority without returning user text", () => {
  expect(companionDraftIntent("   ")).toBe("empty");
  expect(companionDraftIntent("爱".repeat(26) + "?")).toBe("typing_long");
  expect(companionDraftIntent("我想你了吗")).toBe("typing_love");
  expect(companionDraftIntent("你好？")).toBe("typing_question");
  expect(companionDraftIntent("继续说")).toBe("typing_idle");
});

test("geometry is finite and confined to the small virtual canvas", () => {
  const value = {
    type: "mufy-composer-companion-bounds",
    x: 260,
    y: 160,
    width: 60,
    height: 80,
  };
  expect(validateCompanionBounds(value)).toEqual({
    x: 260,
    y: 160,
    width: 60,
    height: 80,
  });
  for (const patch of [
    { x: -1 },
    { x: NaN },
    { width: Infinity },
    { width: 61 },
    { height: 81 },
    { height: 0 },
    { type: "other" },
  ])
    expect(validateCompanionBounds({ ...value, ...patch })).toBeNull();
});

test("native control mapping uses semantic IDs rather than colors or text", () => {
  const dom = new JSDOM(
    '<button id="nj_chat_input_model_btn"><span>Model</span></button><button class="text-red-500">Not delete</button><button id="nj_message_actions_copy">Copy</button>',
  );
  expect(
    companionControlAction(dom.window.document.querySelector("span")!),
  ).toBe("model");
  expect(
    companionControlAction(dom.window.document.querySelector(".text-red-500")!),
  ).toBeNull();
  expect(
    companionControlAction(
      dom.window.document.getElementById("nj_message_actions_copy")!,
    ),
  ).toBe("copy");
  const dialog = dom.window.document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("data-state", "open");
  expect(companionControlAction(dialog)).toBe("save");
  dom.window.close();
});

test("virtual composer executes locally without a parent alias or Host RPC", () => {
  const html = buildMufyComposerCompanionFrame(program);
  const dom = new JSDOM(html);
  // Bun does not support jsdom's VM global proxy. Execute only this synthetic
  // fixture with explicit dependencies, never the captured public program.
  const isolated = [...dom.window.document.querySelectorAll("script")].find(
    (script) => script.textContent?.includes("const htmlStr ="),
  )!.textContent!;
  new Function("window", isolated)(dom.window);
  for (const script of dom.window.document.querySelectorAll("script"))
    expect(() => new Function(script.textContent ?? "")).not.toThrow();
  expect(
    dom.window.document.querySelector(
      "#mufy_chat_input_box #censy-pet-companion-v1",
    ),
  ).not.toBeNull();
  expect(html).not.toContain("const p = window.parent;");
  expect(html).not.toContain("nj_iframe_bridge_ready");
  expect(html).not.toContain("allow-same-origin");
  expect(html).toContain("connect-src 'none'");
  expect(html).toContain("frame-src 'none'");
  expect(html).toContain("event.source!==parent");
  dom.window.close();
});

test("late image load recovers a zero-area bootstrap without animation frames", async () => {
  const dom = new JSDOM(buildMufyComposerCompanionFrame(program));
  const doc = dom.window.document;
  const image = doc.createElement("img");
  image.id = "censy-pet-avatar";
  doc.body.appendChild(image);
  let loaded = false;
  image.getBoundingClientRect = () =>
    ({
      left: 265,
      top: 164,
      right: 320,
      bottom: 240,
      width: 55,
      height: loaded ? 76 : 0,
    }) as DOMRect;
  const messages: unknown[] = [];
  const reporter = doc.querySelector(
    "script[data-mufy-composer-companion-adapter]",
  )!.textContent!;
  new Function(
    "document",
    "window",
    "parent",
    "getComputedStyle",
    "MutationObserver",
    "ResizeObserver",
    "requestAnimationFrame",
    reporter,
  )(
    doc,
    dom.window,
    {
      postMessage(value: unknown) {
        messages.push(value);
      },
    },
    () => ({ display: "block", visibility: "visible", opacity: "1" }),
    dom.window.MutationObserver,
    class {
      observe() {}
    },
    () => 0,
  );
  await new Promise<void>((resolve) =>
    dom.window.addEventListener("load", () => resolve(), { once: true }),
  );
  expect(messages).toHaveLength(0);
  loaded = true;
  image.dispatchEvent(new dom.window.Event("load"));
  expect(validateCompanionBounds(messages.at(-1))).toEqual({
    x: 261,
    y: 160,
    width: 59,
    height: 80,
  });
  dom.window.close();
});
