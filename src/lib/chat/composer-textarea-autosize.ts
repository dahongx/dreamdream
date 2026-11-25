export interface ComposerBoxMetrics {
  scrollHeight: number;
  boxSizing: string;
  paddingTop: string;
  paddingBottom: string;
  borderTopWidth: string;
  borderBottomWidth: string;
}
const pixels = (value: string) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
/** scrollHeight includes padding, excludes border; limit is the outer border box. */
export function composerTextareaHeight(metrics: ComposerBoxMetrics): number {
  const padding = pixels(metrics.paddingTop) + pixels(metrics.paddingBottom);
  const border =
    pixels(metrics.borderTopWidth) + pixels(metrics.borderBottomWidth);
  const scroll = Number.isFinite(metrics.scrollHeight)
    ? Math.max(0, metrics.scrollHeight)
    : 0;
  const outer = Math.min(scroll + border, 160);
  return Math.max(
    0,
    metrics.boxSizing === "border-box" ? outer : outer - padding - border,
  );
}
interface FontEvents {
  ready: PromiseLike<unknown>;
  addEventListener(type: "loadingdone", listener: EventListener): void;
  removeEventListener(type: "loadingdone", listener: EventListener): void;
}
export interface ComposerAutosizeEnvironment {
  getStyle(
    element: HTMLTextAreaElement,
  ): Omit<ComposerBoxMetrics, "scrollHeight">;
  observe(element: HTMLTextAreaElement, callback: () => void): () => void;
  addResize(listener: EventListener): void;
  removeResize(listener: EventListener): void;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
  fonts?: FontEvents;
}
function browserEnvironment(
  element: HTMLTextAreaElement,
): ComposerAutosizeEnvironment {
  const view = element.ownerDocument.defaultView;
  if (!view) throw Error("Textarea has no browsing context");
  return {
    getStyle: (el) => view.getComputedStyle(el),
    observe(el, callback) {
      const observer =
        typeof view.ResizeObserver === "function"
          ? new view.ResizeObserver(callback)
          : null;
      observer?.observe(el);
      return () => observer?.disconnect();
    },
    addResize: (listener) => view.addEventListener("resize", listener),
    removeResize: (listener) => view.removeEventListener("resize", listener),
    requestFrame: (callback) => view.requestAnimationFrame(callback),
    cancelFrame: (handle) => view.cancelAnimationFrame(handle),
    fonts: element.ownerDocument.fonts,
  };
}
export function createComposerTextareaAutosizer(
  element: HTMLTextAreaElement,
  environment: ComposerAutosizeEnvironment = browserEnvironment(element),
) {
  let disposed = false;
  let frame: number | null = null;
  let width = element.getBoundingClientRect().width;
  const measure = () => {
    if (disposed) return;
    if (frame !== null) environment.cancelFrame(frame);
    frame = null;
    width = element.getBoundingClientRect().width;
    const scrollTop = element.scrollTop;
    element.style.height = "auto";
    const style = environment.getStyle(element);
    element.style.height = `${composerTextareaHeight({
      scrollHeight: element.scrollHeight,
      boxSizing: style.boxSizing,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      borderTopWidth: style.borderTopWidth,
      borderBottomWidth: style.borderBottomWidth,
    })}px`;
    // Keep internal scrolling for long drafts; no overflow suppression.
    element.scrollTop = scrollTop;
  };
  const schedule = () => {
    if (disposed || frame !== null) return;
    frame = environment.requestFrame(() => {
      frame = null;
      measure();
    });
  };
  const disconnect = environment.observe(element, () => {
    const nextWidth = element.getBoundingClientRect().width;
    if (nextWidth === width) return;
    width = nextWidth;
    schedule();
  });
  const resize: EventListener = () => schedule();
  const fontLoaded: EventListener = () => schedule();
  environment.addResize(resize);
  environment.fonts?.addEventListener("loadingdone", fontLoaded);
  environment.fonts?.ready.then(schedule, () => {});
  measure();
  return {
    measure,
    dispose() {
      if (disposed) return;
      disposed = true;
      disconnect();
      environment.removeResize(resize);
      environment.fonts?.removeEventListener("loadingdone", fontLoaded);
      if (frame !== null) environment.cancelFrame(frame);
      frame = null;
    },
  };
}
