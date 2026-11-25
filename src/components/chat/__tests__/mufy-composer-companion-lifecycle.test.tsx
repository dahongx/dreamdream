import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

test("composer companion stays mounted through rerenders and relays only an intent enum", async () => {
  const dom = new JSDOM(
    '<main id="test-root"></main><div id="nj_chat_input_box"><textarea></textarea></div>',
  );
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    MessageEvent: dom.window.MessageEvent,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  const composer = document.getElementById("nj_chat_input_box")!;
  composer.getBoundingClientRect = () => ({
    x: 20,
    y: 600,
    left: 20,
    top: 600,
    right: 380,
    bottom: 660,
    width: 360,
    height: 60,
    toJSON() {
      return {};
    },
  });
  const { createRoot } = await import("react-dom/client");
  const { MufyComposerCompanion } = await import("../MufyComposerCompanion");
  const root = createRoot(document.getElementById("test-root")!);
  const source =
    '<script>const p = window.parent;const htmlStr = "censy-pet-companion-v1 censy-pet-avatar censy-pet-bubble #mufy_chat_input_box";p.censyPetSpeak=function(){};</script>';
  try {
    await act(async () =>
      root.render(createElement(MufyComposerCompanion, { contents: [source] })),
    );
    const frame = document.querySelector<HTMLIFrameElement>("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("src")).toBeNull();
    const data = {
      type: "mufy-composer-companion-bounds",
      x: 260,
      y: 160,
      width: 60,
      height: 80,
    };
    await act(async () =>
      window.dispatchEvent(
        new dom.window.MessageEvent("message", {
          source: frame.contentWindow,
          data,
        }),
      ),
    );
    const shell = document.querySelector<HTMLElement>(
      "[data-mufy-composer-companion]",
    )!;
    expect(shell.style.width).toBe("60px");
    expect(shell.style.top).toBe("520px");
    expect(shell.style.left).toBe("305px");
    await act(async () =>
      root.render(createElement(MufyComposerCompanion, { contents: [source] })),
    );
    expect(document.querySelector("iframe")).toBe(frame);
    const relayed: unknown[] = [];
    frame.contentWindow!.postMessage = (value: unknown) => {
      relayed.push(value);
    };
    const textarea = composer.querySelector("textarea")!;
    textarea.value = "我想你了：这是私密草稿";
    textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    expect(relayed).toEqual([
      { type: "mufy-composer-companion-intent", intent: "typing_love" },
    ]);
    expect(frame.srcdoc).not.toContain("这是私密草稿");
    relayed.length = 0;
    const replay = document.createElement("button");
    replay.id = "nj_chat_input_replay_btn";
    document.body.appendChild(replay);
    replay.click();
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "nj_stage_adjust_brightness";
    document.body.appendChild(slider);
    slider.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    expect(relayed).toEqual([
      { type: "mufy-composer-companion-action", action: "replay" },
      { type: "mufy-composer-companion-action", action: "slider" },
    ]);
    replay.remove();
    slider.remove();
    await act(async () =>
      window.dispatchEvent(
        new dom.window.MessageEvent("message", {
          source: window,
          data: { ...data, width: 1 },
        }),
      ),
    );
    expect(shell.style.width).toBe("60px");
    await act(async () =>
      root.render(createElement(MufyComposerCompanion, { contents: [] })),
    );
    expect(document.querySelector("[data-mufy-composer-companion]")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
