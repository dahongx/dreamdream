import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { attachMufyGhostPlayer } from "../import/mufy-ghost-player";

class ElementMock extends EventTarget {
  textContent = "";
  title = "";
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }
}

class AudioMock extends ElementMock {
  src = "";
  preload = "";
  paused = true;
  loop = false;
  currentTime = 0;
  duration = Number.NaN;
  rejectPlay = false;
  load() {}
  async play() {
    if (this.rejectPlay) throw new Error("Source unavailable");
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}

function mount() {
  const root = new ElementMock();
  const audio = new AudioMock();
  const elements = new Map<string, ElementMock>();
  const node = (selector: string) => {
    if (!elements.has(selector)) elements.set(selector, new ElementMock());
    return elements.get(selector) as ElementMock;
  };
  const dom = Object.assign(root, { querySelector: node, appendChild() {} });
  const html = attachMufyGhostPlayer('<div id="ftGhostSidebar"></div>', [
    { name: "First", url: "https://example.com/first.mp3" },
    { name: "Second", url: "https://example.com/second.mp3" },
  ]);
  const script = html.match(
    /<script id="nj-recovered-ghost-player">([\s\S]*)<\/script>/,
  )?.[1];
  if (!script) throw new Error("Missing player script");
  runInNewContext(script, {
    document: { getElementById: () => dom, createElement: () => audio },
  });
  const click = (selector: string) =>
    node(selector).dispatchEvent(new Event("click"));
  return { audio, node, click };
}

describe("recovered Mufy ghost player", () => {
  test("resets stale captured progress, plays, pauses and switches actual sources", async () => {
    const { audio, node, click } = mount();
    expect(node("#ftTitle").textContent).toBe("First");
    expect(node("#ftCurTime").textContent).toBe("00:00");
    expect(node("#ftIconPlay").style.display).toBe("block");
    click("#ftPlayBtn");
    await Promise.resolve();
    expect(audio.paused).toBe(false);
    audio.duration = 180;
    audio.currentTime = 60;
    audio.dispatchEvent(new Event("timeupdate"));
    expect(node("#ftCurTime").textContent).toBe("01:00");
    click("#ftPlayBtn");
    expect(audio.paused).toBe(true);
    click("#ftNextBtn");
    expect(audio.src).toBe("https://example.com/second.mp3");
    click("#ftModeBtn");
    expect(audio.loop).toBe(true);
    expect(node("#ftModeToast").textContent).toBe("单曲循环");
  });

  test("does not show a playing state when the audio fails", async () => {
    const { audio, node, click } = mount();
    audio.rejectPlay = true;
    click("#ftPlayBtn");
    await Promise.resolve();
    await Promise.resolve();
    expect(node("#ftIconPlay").style.display).toBe("block");
    expect(node("#ftTitle").textContent).toContain("音源暂不可用");
  });

  test("escapes script-closing text and replaces a previous recovery once", () => {
    const tracks = [
      { name: "</script>", url: "https://example.com/first.mp3" },
    ];
    const first = attachMufyGhostPlayer(
      '<div id="ftGhostSidebar"></div>',
      tracks,
    );
    expect(first).toContain('"name":"\\u003c/script>"');
    expect(
      attachMufyGhostPlayer(first, tracks).match(
        /id="nj-recovered-ghost-player"/g,
      ),
    ).toHaveLength(1);
    const floating = attachMufyGhostPlayer(
      '<floating kind="ghost-right"><div id="ftGhostSidebar"></div></floating>',
      tracks,
    );
    expect(floating.indexOf('id="nj-recovered-ghost-player"')).toBeLessThan(
      floating.indexOf("</floating>"),
    );
  });
});
