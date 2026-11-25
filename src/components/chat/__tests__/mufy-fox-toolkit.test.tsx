import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import {
  type FoxToolkitData,
  validFoxToolkit,
} from "@/lib/opening/fox-toolkit";
import {
  extractNativeImageSidebars,
  type NativeImageSidebar,
  nativeImageSidebarEnvelope,
} from "@/lib/opening/native-image-sidebar";
import fixture from "../../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/25/native-fox-toolkit/toolkit-data.json";
import { MufyFoxToolkit } from "../MufyFoxToolkit";

test("only a validated inert Fox envelope reaches the native floating route", () => {
  const spec: NativeImageSidebar = {
    version: 1,
    variant: "fox-toolkit",
    shellHtml: '<div class="native-fox-toolkit"></div>',
    css: "",
    documents: [],
    foxToolkit: fixture as FoxToolkitData,
  };
  expect(
    extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars,
  ).toHaveLength(1);
  expect(
    extractNativeImageSidebars(
      nativeImageSidebarEnvelope({
        ...spec,
        documents: ["<script>bad</script>"],
      }),
    ).sidebars,
  ).toHaveLength(0);
  expect(
    extractNativeImageSidebars(
      nativeImageSidebarEnvelope({
        ...spec,
        foxToolkit: {
          ...spec.foxToolkit!,
          avatars: ["javascript:bad", "javascript:bad"],
        },
      }),
    ).sidebars,
  ).toHaveLength(0);
});

test("Fox public data keeps all seven tracks, six people and ten commands without source code execution", async () => {
  const data = fixture as FoxToolkitData;
  expect(validFoxToolkit(data)).toBe(true);
  expect(
    validFoxToolkit({
      ...data,
      tracks: [...data.tracks, { ...data.tracks[0], src: "javascript:bad" }],
    }),
  ).toBe(false);
  const dom = new JSDOM(
    '<div id="root"></div><div id="nj_chat_messages"></div><textarea id="nj_chat_input_textarea"></textarea>',
    { url: "http://localhost/fox" },
  );
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
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
  let paused = true,
    plays = 0;
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, "paused", {
    get: () => paused,
  });
  dom.window.HTMLMediaElement.prototype.play = function () {
    plays++;
    paused = false;
    this.dispatchEvent(new dom.window.Event("playing"));
    return Promise.resolve();
  };
  dom.window.HTMLMediaElement.prototype.pause = function () {
    paused = true;
    this.dispatchEvent(new dom.window.Event("pause"));
  };
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(document.getElementById("root")!),
    input = document.querySelector("textarea")!;
  let fills = 0;
  const priorCreateUrl = Object.getOwnPropertyDescriptor(
      URL,
      "createObjectURL",
    ),
    priorRevokeUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  const render = () =>
    root.render(
      <MufyFoxToolkit
        data={structuredClone(data)}
        characterId="fox-test"
        onReplaceComposer={(text) => {
          input.value = text;
          fills++;
        }}
        onOpenChange={() => {}}
      />,
    );
  try {
    await act(async () => render());
    const shadow = document.querySelector("[data-nj-fox-toolkit]")!.shadowRoot!,
      q = (id: string) => shadow.querySelector<HTMLElement>("#" + id)!;
    expect(shadow.querySelector("script,iframe,[onclick]")).toBeNull();
    expect(shadow.querySelectorAll(".fx-playlist li")).toHaveLength(7);
    expect(shadow.querySelectorAll(".fx-npc-item-btn")).toHaveLength(6);
    expect(shadow.querySelectorAll(".fx-prompt-item")).toHaveLength(10);
    expect(q("fox-avatar-box-left").getAttribute("aria-label")).toBe(
      "更换左侧头像",
    );
    expect(q("fox-avatar-box-right").getAttribute("aria-label")).toBe(
      "更换右侧头像",
    );
    expect(shadow.querySelectorAll('[aria-label="关闭浮窗"]')).toHaveLength(1);
    expect(plays).toBe(0);
    expect(q("fox-panel").inert).toBe(true);
    Object.defineProperty(dom.window, "innerWidth", {
      value: 390,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(dom.window, "innerHeight", {
      value: 844,
      writable: true,
      configurable: true,
    });
    await act(async () => window.dispatchEvent(new dom.window.Event("resize")));
    expect(q("fox-floating-ball").style.left).toBe("328px");
    expect(q("fox-floating-ball").style.top).toBe("702px");
    expect(
      JSON.parse(
        window.localStorage.getItem(
          "nj_fox_fox-test_chenchuang-fox-v1_preferences",
        )!,
      ).position,
    ).toBeNull();
    await act(async () => q("fox-floating-ball").click());
    expect(q("fox-floating-ball").getAttribute("aria-expanded")).toBe("true");
    const chat = document.getElementById("nj_chat_messages")!;
    const scrollRequests: ScrollToOptions[] = [];
    Object.defineProperty(chat, "scrollHeight", { value: 2400 });
    chat.scrollTo = ((options: ScrollToOptions) => {
      scrollRequests.push(options);
    }) as typeof chat.scrollTo;
    for (const [control, top] of [
      ["fox-btn-top", 0],
      ["fox-btn-bottom", 2400],
    ] as const) {
      await act(async () => q(control).click());
      expect(scrollRequests.at(-1)).toEqual({ top, behavior: "smooth" });
      expect(q("fox-floating-ball").getAttribute("aria-expanded")).toBe("false");
      expect(q("fox-panel").inert).toBe(true);
      expect(fills).toBe(0);
      expect(plays).toBe(0);
      await act(async () => q("fox-floating-ball").click());
    }
    const people = shadow.querySelectorAll<HTMLElement>(".fx-npc-item-btn");
    await act(async () =>
      shadow.querySelector<HTMLElement>("[data-target=npc]")!.click(),
    );
    expect(q("fox-watermark").textContent).toBe("DATA");
    expect(q("fox-vertical-text").textContent).toBe("SYS.ARCHIVE // NPC");
    for (let i = 0; i < people.length; i++) {
      await act(async () => people[i].click());
      expect(q("fox-npc-name-disp").textContent).toBe(data.people[i].name);
      expect(q("fox-npc-desc-disp").textContent).toBe(data.people[i].desc);
    }
    for (let i = 0; i < data.commands.length; i++) {
      await act(async () => {
        q("fox-floating-ball").click();
        shadow.querySelector<HTMLElement>("[data-target=prompt]")!.click();
      });
      input.value = "existing draft";
      input.setSelectionRange(2, 3);
      await act(async () =>
        shadow.querySelectorAll<HTMLElement>(".fx-prompt-item")[i].click(),
      );
      // This author's observed contract replaces the draft; it does not append.
      expect(input.value).toBe(data.commands[i].text);
      expect(input.selectionStart).toBe(data.commands[i].text.length);
      expect(q("fox-panel").inert).toBe(true);
    }
    expect(fills).toBe(10);
    await act(async () => {
      q("fox-floating-ball").click();
      shadow.querySelector<HTMLElement>("[data-target=audio]")!.click();
      q("fox-play").click();
    });
    expect(plays).toBe(1);
    expect(paused).toBe(false);
    const audio = q("fox-audio-element") as HTMLAudioElement;
    audio.currentTime = 12;
    await act(async () => render());
    expect(q("fox-audio-element")).toBe(audio);
    expect(audio.currentTime).toBe(12);
    expect(paused).toBe(false);
    await act(async () => q("fox-play").click());
    expect(paused).toBe(true);
    for (let i = 0; i < 7; i++) {
      await act(async () =>
        shadow.querySelectorAll<HTMLElement>(".fx-playlist li")[i].click(),
      );
      expect(audio.getAttribute("src")).toBe(data.tracks[i].src);
      expect(q("fox-title").textContent).toBe(data.tracks[i].title);
    }
    await act(async () =>
      shadow.querySelector<HTMLElement>("[data-target=prompt]")!.click(),
    );
    await act(async () =>
      shadow.querySelector<HTMLElement>(".fx-prompt-edit-btn")!.click(),
    );
    expect(q("fox-prompt-form").inert).toBe(false);
    (q("fox-form-cmd") as HTMLInputElement).value = "saved test command";
    (q("fox-form-text") as HTMLTextAreaElement).value = "saved test text";
    await act(async () => q("fox-form-save").click());
    expect(q("fox-prompt-form").inert).toBe(true);
    expect(
      JSON.parse(
        window.localStorage.getItem(
          "nj_fox_fox-test_chenchuang-fox-v1_commands",
        )!,
      )[0],
    ).toEqual({ cmd: "saved test command", text: "saved test text" });
    const preferenceKey = "nj_fox_fox-test_chenchuang-fox-v1_preferences";
    const saved = JSON.parse(window.localStorage.getItem(preferenceKey)!);
    expect(saved.track).toBe(6);
    expect(saved.playing).toBe(true);
    const image = "data:image/png;base64,iVBORw0KGgo=";
    window.localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        ...saved,
        avatars: [image, image],
        background: image,
        position: { x: 5000, y: 5000 },
      }),
    );
    await act(async () => root.render(null));
    expect(
      JSON.parse(window.localStorage.getItem(preferenceKey)!).playing,
    ).toBe(true);
    await act(async () => render());
    const restored = document.querySelector("[data-nj-fox-toolkit]")!,
      restoredShadow = restored.shadowRoot!,
      r = (id: string) => restoredShadow.querySelector<HTMLElement>(`#${id}`)!;
    expect(
      (r("fox-audio-element") as HTMLAudioElement).getAttribute("src"),
    ).toBe(data.tracks[6].src);
    expect(paused).toBe(false);
    expect(r("fox-avatar-img-left").getAttribute("src")).toBe(image);
    expect(r("fox-floating-ball").style.left).toBe(
      `${window.innerWidth - 42}px`,
    );
    expect(r("fox-floating-ball").style.top).toBe(
      `${window.innerHeight - 42}px`,
    );
    expect(
      document.querySelector('style[data-nj-fox-background="fox-test"]')
        ?.textContent,
    ).toContain(image);
    expect(restoredShadow.querySelector(".fx-prompt-cmd")?.textContent).toBe(
      "saved test command",
    );
    Object.defineProperty(URL, "createObjectURL", {
      value: () => "blob:fox-test-upload",
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: () => {},
      configurable: true,
    });
    await act(async () => r("fox-avatar-box-left").click());
    const upload =
        restoredShadow.querySelector<HTMLInputElement>("input[type=file]")!,
      avatar = r("fox-avatar-img-left");
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9dQAAAAASUVORK5CYII=";
    const png = new dom.window.File(
      [new Uint8Array(Buffer.from(pngBase64, "base64"))],
      "tiny.png",
      { type: "image/png" },
    );
    Object.defineProperty(upload, "files", {
      value: [png],
      configurable: true,
    });
    const imageSaved = new Promise<void>((resolve) => {
      const observer = new dom.window.MutationObserver(() => {
        if (
          avatar.getAttribute("src") === `data:image/png;base64,${pngBase64}`
        ) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(avatar, { attributes: true, attributeFilter: ["src"] });
    });
    await act(async () => {
      upload.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      await imageSaved;
    });
    expect(
      JSON.parse(window.localStorage.getItem(preferenceKey)!).avatars[0],
    ).toBe(`data:image/png;base64,${pngBase64}`);
    await act(async () => r("fox-play").click());
    dom.window.HTMLMediaElement.prototype.play = () =>
      Promise.reject(
        Object.assign(new Error("gesture required"), {
          name: "NotAllowedError",
        }),
      );
    await act(async () => r("fox-play").click());
    expect(restored.getAttribute("data-nj-audio-status")).toBe(
      "gesture-required",
    );
    expect(r("fox-play").getAttribute("aria-label")).toBe("点击播放");
    const storageSet = dom.window.Storage.prototype.setItem;
    dom.window.Storage.prototype.setItem = function (
      key: string,
      value: string,
    ) {
      if (key === preferenceKey) throw new Error("quota");
      return storageSet.call(this, key, value);
    };
    await act(async () => r("fox-btn-bg-reset").click());
    expect(restored.getAttribute("data-nj-preference-status")).toBe("unsaved");
    expect(
      restoredShadow.querySelector("[role=status]")?.textContent,
    ).toContain("本地保存未成功");
  } finally {
    await act(async () => root.unmount());
    expect(paused).toBe(true);
    if (priorCreateUrl)
      Object.defineProperty(URL, "createObjectURL", priorCreateUrl);
    else Reflect.deleteProperty(URL, "createObjectURL");
    if (priorRevokeUrl)
      Object.defineProperty(URL, "revokeObjectURL", priorRevokeUrl);
    else Reflect.deleteProperty(URL, "revokeObjectURL");
    dom.window.close();
    for (const [k, d] of prior)
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
  }
});
