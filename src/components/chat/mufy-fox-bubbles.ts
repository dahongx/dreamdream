/** Observed source cadence: wait 15–20s, show one bubble for 6s, then wait again. */
export interface FoxBubbleClock {
  random: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
}
const browserClock: FoxBubbleClock = {
  random: () => Math.random(),
  schedule: (callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    return () => window.clearTimeout(timer);
  },
};
export function bindFoxBubbles(
  root: HTMLElement,
  emoticons: readonly string[],
  clock: FoxBubbleClock = browserClock,
): () => void {
  let disposed = false,
    active: HTMLElement | null = null,
    cancel = () => {};
  const schedule = () => {
    cancel();
    if (!disposed)
      cancel = clock.schedule(spawn, 15000 + clock.random() * 5000);
  };
  const spawn = () => {
    if (disposed) return;
    const left = root.querySelector<HTMLElement>(
        "#fox-avatar-box-left .fx-bubble-zone",
      ),
      right = root.querySelector<HTMLElement>(
        "#fox-avatar-box-right .fx-bubble-zone",
      );
    left?.replaceChildren();
    right?.replaceChildren();
    const zone = clock.random() > 0.5 ? left : right;
    if (!zone || !emoticons.length) {
      schedule();
      return;
    }
    active = document.createElement("div");
    active.className = "fx-emoji-bubble";
    active.textContent =
      emoticons[Math.floor(clock.random() * emoticons.length)];
    zone.append(active);
    cancel = clock.schedule(() => {
      active?.remove();
      active = null;
      schedule();
    }, 6000);
  };
  schedule();
  return () => {
    disposed = true;
    cancel();
    active?.remove();
    active = null;
  };
}
