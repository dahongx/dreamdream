"use client";

import { useEffect } from "react";
import { useModalClose } from "./useModalClose";

interface Props {
  fallbackHref: string;
  className?: string;
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

/**
 * Backdrop + ESC + click-outside wrapper for intercepted-route modals.
 * Children should be the modal card itself; backdrop click only fires
 * when the click target is the backdrop element, so clicks inside the
 * card pass through.
 */
export function ModalShell({
  fallbackHref,
  className,
  closeOnBackdrop = true,
  children,
}: Props) {
  const close = useModalClose(fallbackHref);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) close();
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: ESC is wired via document listener above
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop is decorative; close is also reachable via button + ESC
    <div onClick={onBackdropClick} className={className}>
      {children}
    </div>
  );
}
