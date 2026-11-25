import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { bindFoxBubbles, type FoxBubbleClock } from "../mufy-fox-bubbles";

test("source bubbles have a quiet interval, never overlap, and stop on disposal", () => {
  const dom = new JSDOM(
    '<div id="root"><div id="fox-avatar-box-left"><div class="fx-bubble-zone"></div></div><div id="fox-avatar-box-right"><div class="fx-bubble-zone"></div></div></div>',
  );
  const old = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    value: dom.window.document,
    configurable: true,
  });
  let now = 0,
    id = 0;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const clock: FoxBubbleClock = {
    random: () => 0.2,
    schedule: (callback, delay) => {
      const key = ++id;
      tasks.set(key, { at: now + delay, callback });
      return () => {
        tasks.delete(key);
      };
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const task = [...tasks]
        .sort((a, b) => a[1].at - b[1].at)
        .find(([, task]) => task.at <= end);
      if (!task) break;
      now = task[1].at;
      tasks.delete(task[0]);
      task[1].callback();
    }
    now = end;
  };
  const root = dom.window.document.getElementById("root")!;
  try {
    const stop = bindFoxBubbles(root, ["one", "two"], clock);
    advance(15999);
    expect(root.querySelectorAll(".fx-emoji-bubble")).toHaveLength(0);
    advance(1);
    expect(root.querySelectorAll(".fx-emoji-bubble")).toHaveLength(1);
    expect(
      root.querySelector("#fox-avatar-box-right .fx-emoji-bubble")?.textContent,
    ).toBe("one");
    advance(5999);
    expect(root.querySelectorAll(".fx-emoji-bubble")).toHaveLength(1);
    advance(1);
    expect(root.querySelectorAll(".fx-emoji-bubble")).toHaveLength(0);
    advance(16000);
    expect(root.querySelectorAll(".fx-emoji-bubble")).toHaveLength(1);
    stop();
    expect(root.querySelectorAll(".fx-emoji-bubble")).toHaveLength(0);
    expect(tasks.size).toBe(0);
    advance(60000);
    expect(root.querySelectorAll(".fx-emoji-bubble")).toHaveLength(0);
  } finally {
    dom.window.close();
    if (old) Object.defineProperty(globalThis, "document", old);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
