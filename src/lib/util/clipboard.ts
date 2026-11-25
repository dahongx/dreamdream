/**
 * Robust copy-to-clipboard that works around two pitfalls our chat UI hits:
 *
 * 1. Radix DropdownMenu / Popover portals keep a focus trap inside the menu.
 *    When we call this from `onSelect` of a DropdownMenu.Item, any subsequent
 *    `.focus()` on a hidden <textarea> loses to that trap, so `execCommand`
 *    copies nothing (returns true silently in some browsers).
 *
 * 2. `navigator.clipboard.writeText` requires "transient user activation". If
 *    the menu is left open via `e.preventDefault()`, some browsers (Safari
 *    notably) treat the call as out-of-gesture and resolve the promise
 *    without staging the write.
 *
 * Strategy: try `navigator.clipboard.writeText` first (HTTPS / localhost).
 * Fall back to a Selection/Range-based execCommand path that copies the text
 * from a contenteditable span — Selection works even when no element is
 * focused, so the focus trap doesn't kill it.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (window.navigator.clipboard?.writeText && window.isSecureContext) {
      await window.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  // A selection in the parent document is not sufficient while an iframe owns
  // focus: Chromium can report success without replacing the clipboard. Keep
  // the temporary editor inside the current shadow/focus boundary so modal
  // focus traps and native author drawers do not steal that focus back.
  let previousFocus = document.activeElement as HTMLElement | null;
  while (previousFocus?.shadowRoot?.activeElement instanceof HTMLElement) {
    previousFocus = previousFocus.shadowRoot.activeElement;
  }
  const activeRoot = previousFocus?.getRootNode();
  const mount = activeRoot instanceof ShadowRoot
    ? activeRoot
    : previousFocus?.closest('[role="dialog"], [role="menu"]') ?? document.body;
  const span = document.createElement("span");
  span.textContent = text;
  span.contentEditable = "true";
  span.tabIndex = -1;
  // Off-screen but still selectable. `position: fixed` + `top: 0` is
  // important: scrolling far off the viewport breaks selection in some
  // mobile browsers.
  span.style.position = "fixed";
  span.style.top = "0";
  span.style.left = "0";
  span.style.opacity = "0";
  span.style.pointerEvents = "none";
  span.style.whiteSpace = "pre";
  span.setAttribute("aria-hidden", "true");
  mount.appendChild(span);

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).cloneRange()
      : null;

  try {
    span.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(span);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const ok = document.execCommand("copy");

    selection?.removeAllRanges();
    if (previousRange) selection?.addRange(previousRange);

    return ok;
  } catch {
    return false;
  } finally {
    span.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}
