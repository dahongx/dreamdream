import {
  isKnownWinterToolboxDocument,
  WINTER_COPY_COMMANDS,
  WINTER_COPY_HANDLERS,
} from "@/lib/opening/winter-music-v9";

/** Trusted, document-local compatibility code. No captured program is executed by this function. */
export function installWinterLocalCopy(
  commands: readonly string[],
  handlers: readonly string[],
) {
  // Self-contained for serialization into this one strictly fingerprinted opaque document.
  if (commands.length !== 6 || handlers.length !== 6) return () => {};
  let listening = false,
    disposed = false,
    busy = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  let currentToast: HTMLElement | null = null,
    originalToastText = "";
  function clearFeedback() {
    clearTimeout(timer);
    timer = undefined;
    if (currentToast) {
      currentToast.classList.remove("show");
      currentToast.textContent = originalToastText;
    }
  }
  function feedback(toast: HTMLElement, ok: boolean) {
    clearFeedback();
    currentToast = toast;
    originalToastText = toast.textContent || "";
    toast.textContent = ok ? originalToastText : "复制未完成，请重试";
    toast.setAttribute(
      "data-winter-copy-result",
      ok ? "browser-copy-accepted" : "failed",
    );
    toast.classList.add("show");
    // Original authored toast duration, not a clipboard deadline or promise cancellation.
    timer = setTimeout(clearFeedback, 2000);
  }
  function copySynchronously(text: string): boolean {
    const previous = document.activeElement as HTMLElement | null,
      selection = document.getSelection();
    const ranges: Range[] = [];
    if (selection)
      for (let i = 0; i < selection.rangeCount; i++)
        ranges.push(selection.getRangeAt(i).cloneRange());
    const input =
      previous instanceof HTMLInputElement ||
      previous instanceof HTMLTextAreaElement
        ? previous
        : null;
    const previousInput =
      input && typeof input.selectionStart === "number"
        ? {
            start: input.selectionStart,
            end: input.selectionEnd ?? input.selectionStart,
            direction: input.selectionDirection ?? "none",
          }
        : null;
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.readOnly = true;
    temporary.tabIndex = -1;
    temporary.setAttribute("aria-hidden", "true");
    temporary.style.cssText =
      "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(temporary);
    try {
      temporary.focus({ preventScroll: true });
      temporary.select();
      temporary.setSelectionRange(0, text.length);
      // Synchronous native browser operation; no navigator.clipboard Promise can finish late.
      return document.execCommand("copy") === true;
    } catch {
      return false;
    } finally {
      temporary.remove();
      try {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        selection?.removeAllRanges();
        for (const range of ranges) selection?.addRange(range);
        if (input?.isConnected && previousInput)
          input.setSelectionRange(
            previousInput.start,
            previousInput.end,
            previousInput.direction,
          );
      } catch {
        /* Copy result is not changed by an obsolete focus/selection restoration target. */
      }
    }
  }
  function click(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>("button.cmd-btn"),
      scope = document.querySelector(".cmd-area");
    if (!button || !scope?.contains(button)) return;
    // Block the original async onclick even for synthetic/changed buttons. Only real gestures below copy.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (disposed || !listening || !event.isTrusted) return;
    const toast = document.getElementById("toast");
    if (!toast) return;
    const buttons = Array.from(
      scope.querySelectorAll<HTMLButtonElement>("button.cmd-btn"),
    );
    const index = buttons.indexOf(button);
    if (
      busy ||
      buttons.length !== 6 ||
      index < 0 ||
      !buttons.every((b, i) => b.getAttribute("onclick") === handlers[i])
    ) {
      feedback(toast, false);
      return;
    }
    busy = true;
    let ok = false;
    try {
      ok = copySynchronously(commands[index]);
    } catch {
      ok = false;
    } finally {
      busy = false;
    }
    feedback(toast, ok);
  }
  function resume() {
    if (disposed || listening) return;
    listening = true;
    document.addEventListener("click", click, true);
  }
  function suspend() {
    if (listening) document.removeEventListener("click", click, true);
    listening = false;
    clearFeedback();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    suspend();
    window.removeEventListener("pagehide", suspend);
    window.removeEventListener("pageshow", resume);
  }
  // Document-local listener is installed synchronously, before user input; no host/window message is involved.
  resume();
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  return dispose;
}

/** Exact finite source document only, not an id/class heuristic or an arbitrary text capability. */
export function winterLocalCommandCopyCompat(documentSource: string): string {
  if (!isKnownWinterToolboxDocument(documentSource)) return "";
  const args = JSON.stringify([
    WINTER_COPY_COMMANDS,
    WINTER_COPY_HANDLERS,
  ]).replace(/</g, "\\u003c");
  return (
    '<script data-mufy-compat="known-winter-six-local-copy">(' +
    installWinterLocalCopy.toString() +
    ").apply(null," +
    args +
    ");</script>"
  );
}
