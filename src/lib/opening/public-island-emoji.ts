/** Finite public source options; no CSS/program supplied through this contract. */
export function publicIslandEmojiUrls(
  value: unknown,
): readonly string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) return null;
  if (
    value.some((url) => {
      if (typeof url !== "string" || url.length > 2048) return true;
      try {
        const u = new URL(url);
        return u.protocol !== "https:" || !!u.username || !!u.password;
      } catch {
        return true;
      }
    })
  )
    return null;
  return value as string[];
}
export interface PublicIslandPaintOptions {
  insertFeedback?: "source-gold-200ms" | "source-blue-200ms";
  artistFontSize?: 10 | 11;
}
export function validPublicIslandPaintOptions(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.insertFeedback === undefined ||
      v.insertFeedback === "source-gold-200ms" ||
      v.insertFeedback === "source-blue-200ms") &&
    (v.artistFontSize === undefined ||
      v.artistFontSize === 10 ||
      v.artistFontSize === 11)
  );
}
export const SOURCE_INSERT_FEEDBACK_COLOR = "rgba(210, 169, 65, 0.4)";
export const SOURCE_BLUE_INSERT_FEEDBACK_COLOR = "rgba(170, 201, 228, 0.4)";
type Timer = ReturnType<typeof setTimeout>;
interface TimerScheduler {
  set(fn: () => void, delay: number): Timer;
  clear(timer: Timer): void;
}
/** Each active element keeps its own original inline declaration across re-clicks. */
export function createPublicIslandInsertFeedback(
  enabled: boolean | NonNullable<PublicIslandPaintOptions["insertFeedback"]>,
  scheduler: TimerScheduler = {
    set: (fn, delay) => setTimeout(fn, delay),
    clear: (timer) => clearTimeout(timer),
  },
) {
  const color = enabled === "source-blue-200ms" ? SOURCE_BLUE_INSERT_FEEDBACK_COLOR : SOURCE_INSERT_FEEDBACK_COLOR;
  type Declaration = { property: string; value: string; priority: string };
  const active = new Map<
    HTMLElement,
    { original: Declaration[]; timer: Timer }
  >();
  let disposed = false;
  const restore = (
    element: HTMLElement,
    state: { original: Declaration[] },
  ) => {
    // Do not overwrite a subsequent independent style change.
    if (
      element.style.getPropertyValue("background") !==
      color
    )
      return;
    for (const property of Array.from(element.style))
      if (/^background(?:-|$)/.test(property))
        element.style.removeProperty(property);
    for (const declaration of state.original)
      element.style.setProperty(
        declaration.property,
        declaration.value,
        declaration.priority,
      );
  };
  return {
    flash(element: HTMLElement) {
      if (!enabled || disposed) return;
      const previous = active.get(element);
      if (previous) scheduler.clear(previous.timer);
      const original =
        previous?.original ??
        Array.from(element.style)
          .filter((property) => /^background(?:-|$)/.test(property))
          .map((property) => ({
            property,
            value: element.style.getPropertyValue(property),
            priority: element.style.getPropertyPriority(property),
          }));
      element.style.setProperty("background", color);
      const state = { original, timer: undefined as unknown as Timer };
      state.timer = scheduler.set(() => {
        if (active.get(element) !== state) return;
        active.delete(element);
        restore(element, state);
      }, 200);
      active.set(element, state);
    },
    dispose() {
      disposed = true;
      for (const [element, state] of active) {
        scheduler.clear(state.timer);
        restore(element, state);
      }
      active.clear();
    },
  };
}
