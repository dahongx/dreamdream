import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import type {
  ComposerPrefixSelection,
  ComposerPrefixSpec,
} from "@/lib/opening/composer-prefix";
test("native prefix controls persist only their own session selection; repaint does not reset it and unmount cleans portal", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/prefix-fixture",
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    // HTTP IP access provides getRandomValues, but not secure-context randomUUID.
    crypto: { getRandomValues: dom.window.crypto.getRandomValues.bind(dom.window.crypto) },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const prior = new Map(
    Object.keys(globals).map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  for (const [k, v] of Object.entries(globals))
    Object.defineProperty(globalThis, k, {
      value: v,
      writable: true,
      configurable: true,
    });
  const { createRoot } = await import("react-dom/client"),
    { MufyPrefixPanel } = await import("../MufyPrefixPanel");
  const root = createRoot(document.getElementById("root")!);
  const spec: ComposerPrefixSpec = {
    version: 1,
    id: "fixture",
    css: "#mufy-bw-panel{display:none}#mufy-bw-panel.show{display:flex}",
    presets: [{ id: "one", text: "public preset" }],
  };
  let session = "A",
    selection: ComposerPrefixSelection | null = null;
  const render = () =>
    root.render(
      <MufyPrefixPanel
        key={session}
        spec={spec}
        sessionId={"fixture-" + session}
        onChange={(s) => {
          selection = s;
        }}
      />,
    );
  try {
    await act(async () => render());
    expect(selection!.activeIds).toEqual([]);
    const host = document.querySelector("[data-nj-composer-prefix]")!,
      layer = document.querySelector("[data-nj-prefix-layer]")!;
    const button = layer.shadowRoot!.querySelector<HTMLButtonElement>(
      '[aria-label="选择固定指令 one"]',
    )!;
    await act(async () => button.click());
    expect(selection!.activeIds).toEqual(["one"]);
    await act(async () =>
      layer
        .shadowRoot!.querySelector<HTMLButtonElement>(
          '[aria-label="编辑固定指令 one"]',
        )!
        .click(),
    );
    const edit = layer.shadowRoot!.querySelector<HTMLInputElement>(
      '[aria-label="编辑固定指令"]',
    )!;
    const setInputValue = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype, "value",
    )!.set!;
    await act(async () => {
      setInputValue.call(edit, "edited public preset");
      edit.dispatchEvent(new dom.window.InputEvent("input", {
        bubbles: true, composed: true, inputType: "insertText",
      }));
    });
    await act(async () => {
      edit.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Enter",
          keyCode: 229,
          isComposing: true,
          bubbles: true,
        }),
      );
    });
    expect(
      layer.shadowRoot!.querySelector('[aria-label="编辑固定指令"]'),
    ).not.toBeNull();
    await act(async () => {
      edit.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
        }),
      );
    });
    expect(
      layer.shadowRoot!.querySelector('[aria-label="编辑固定指令"]'),
    ).toBeNull();
    expect(selection!.presets[0].text).toBe("edited public preset");
    const addInput = layer.shadowRoot!.querySelector<HTMLInputElement>(
      '[aria-label="新增固定指令"]',
    )!;
    await act(async () => {
      setInputValue.call(addInput, "new public preset");
      addInput.dispatchEvent(new dom.window.InputEvent("input", {
        bubbles: true, composed: true, inputType: "insertText",
      }));
    });
    await act(async () => {
      addInput.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
        key: "Enter", bubbles: true, composed: true,
      }));
    });
    expect(selection!.presets.map((preset) => preset.text)).toEqual([
      "edited public preset", "new public preset",
    ]);
    const addedId = selection!.presets[1].id;
    const findButton = (label: string) => layer.shadowRoot!
      .querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
    await act(async () => findButton(`选择固定指令 ${addedId}`).click());
    await act(async () => findButton(`删除固定指令 ${addedId}`).click());
    expect(selection!.presets.map((preset) => preset.id)).toEqual(["one"]);
    expect(selection!.activeIds).toEqual(["one"]);
    const undoButton = [...layer.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "撤销删除")!;
    await act(async () => undoButton.click());
    expect(selection!.presets[1]).toEqual({ id: addedId, text: "new public preset" });
    expect(selection!.activeIds).toEqual(["one", addedId]);
    await act(async () => findButton(`删除固定指令 ${addedId}`).click());
    await act(async () => render());
    expect(document.querySelector("[data-nj-prefix-layer]")).toBe(layer);
    expect(selection!.activeIds).toEqual(["one"]);
    expect(host.shadowRoot!.querySelector("script")).toBeNull();
    expect(layer.shadowRoot!.querySelector("script,iframe")).toBeNull();
    session = "B";
    await act(async () => render());
    expect(selection!.activeIds).toEqual([]);
    expect(document.querySelectorAll("[data-nj-prefix-layer]")).toHaveLength(1);
    session = "A";
    await act(async () => render());
    expect(selection!.activeIds).toEqual(["one"]);
    expect(document.querySelectorAll("[data-nj-prefix-layer]")).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
    expect(document.querySelector("[data-nj-prefix-layer]")).toBeNull();
    dom.window.close();
    for (const [k, d] of prior)
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
  }
});
