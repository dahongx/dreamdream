import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import type { NativeImageSidebar } from "@/lib/opening/native-image-sidebar";
test("native cloud player survives parent updates, preserves playback ownership and scopes navigation", async () => {
  const dom = new JSDOM(
      '<div id="root"></div><div id="nj_chat_messages"></div>',
      { url: "http://localhost/cloud-fixture" },
    ),
    globals = {
      window: dom.window,
      document: dom.window.document,
      Element: dom.window.Element,
      HTMLElement: dom.window.HTMLElement,
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
    this.dispatchEvent(new dom.window.Event("play"));
    return Promise.resolve();
  };
  dom.window.HTMLMediaElement.prototype.pause = function () {
    paused = true;
    this.dispatchEvent(new dom.window.Event("pause"));
  };
  dom.window.HTMLMediaElement.prototype.load = () => {};
  const { createRoot } = await import("react-dom/client"),
    { MufyCloudMusic } = await import("../MufyCloudMusic");
  const root = createRoot(document.getElementById("root")!);
  const spec: NativeImageSidebar = {
    version: 1,
    variant: "cloud-music",
    css: ".panel{color:#333}",
    documents: [],
    cloudMusic: {
      id: "fixture",
      tracks: [
        { title: "one", src: "https://example.com/one.mp3" },
        { title: "two", src: "https://example.com/two.mp3" },
      ],
      lineHeight: 1.8,
      initialDisabled: true,
    },
    shellHtml:
      '<div id="wrapper" class="cloud-music-sidebar"><div id="trigger" onclick="bad()">Open</div><div id="btn-top">Top</div><div id="btn-bottom">Bottom</div><div id="panel"><span id="cover"></span><span id="songTitle"></span><button id="playBtn"></button><button id="prevBtn"></button><button id="nextBtn"></button><button id="powerBtn"></button><div id="bar"></div><audio id="audio" src="https://example.com/one.mp3"></audio></div><script>bad()</script></div>',
  };
  const render = () =>
    root.render(
      <MufyCloudMusic
        spec={{
          ...spec,
          cloudMusic: {
            ...spec.cloudMusic!,
            tracks: [...spec.cloudMusic!.tracks],
          },
        }}
        characterId="fixture"
        onOpenChange={() => {}}
      />,
    );
  try {
    await act(async () => render());
    const shadow = document.querySelector("[data-nj-cloud-music]")!.shadowRoot!,
      audio = shadow.querySelector<HTMLAudioElement>("audio")!;
    expect(shadow.querySelector("script,iframe,[onclick]")).toBeNull();
    expect(plays).toBe(0);
    await act(async () => {
      shadow.querySelector<HTMLElement>("#trigger")!.click();
      shadow.querySelector<HTMLElement>("#playBtn")!.click();
    });
    expect(paused).toBe(false);
    audio.currentTime = 12;
    await act(async () => render());
    expect(shadow.querySelector("audio")).toBe(audio);
    expect(audio.currentTime).toBe(12);
    await act(async () => audio.pause());
    const beforeResume = plays;
    await act(async () =>
      shadow.querySelector<HTMLElement>("#playBtn")!.click(),
    );
    expect(paused).toBe(false);
    expect(plays).toBe(beforeResume + 1);
    expect(shadow.querySelector("#wrapper")!.classList.contains("open")).toBe(
      true,
    );
    await act(async () =>
      shadow.querySelector<HTMLElement>("#nextBtn")!.click(),
    );
    expect(shadow.querySelector("#songTitle")!.textContent).toBe("two");
    expect(audio.getAttribute("src")).toBe("https://example.com/two.mp3");
    expect(paused).toBe(false);
    const edges: number[] = [];
    const messages = document.getElementById("nj_chat_messages")!;
    Object.defineProperty(messages, "scrollHeight", { value: 500 });
    messages.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === "object") edges.push(options.top ?? -1);
    };
    await act(async () => {
      shadow.querySelector<HTMLElement>("#btn-bottom")!.click();
      shadow.querySelector<HTMLElement>("#btn-top")!.click();
    });
    expect(edges).toEqual([500, 0]);
    await act(async () =>
      shadow.querySelector<HTMLElement>("#playBtn")!.click(),
    );
    expect(paused).toBe(true);
    let finishPending: (() => void) | undefined;
    dom.window.HTMLMediaElement.prototype.play = function () {
      plays++;
      return new Promise<void>((resolve) => {
        finishPending = resolve;
      });
    };
    await act(async () =>
      shadow.querySelector<HTMLElement>("#playBtn")!.click(),
    );
    expect(shadow.querySelector("#playBtn")!.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(shadow.querySelector("#playBtn")!.getAttribute("aria-label")).toBe(
      "取消加载",
    );
    await act(async () =>
      shadow.querySelector<HTMLElement>("#playBtn")!.click(),
    );
    await act(async () => {
      finishPending?.();
    });
    expect(paused).toBe(true);
    expect(
      document
        .querySelector("[data-nj-cloud-music]")!
        .getAttribute("data-nj-audio-status"),
    ).toBe("paused");
    await act(async () => {
      shadow.querySelector<HTMLElement>("#trigger")!.click();
      shadow.querySelector<HTMLElement>("#trigger")!.click();
    });
    expect(shadow.querySelector("audio")).toBe(audio);
    expect(shadow.querySelector("#panel")!.getAttribute("aria-hidden")).toBe(
      "false",
    );
  } finally {
    await act(async () => root.unmount());
    expect(paused).toBe(true);
    dom.window.close();
    for (const [k, d] of prior)
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
  }
});
