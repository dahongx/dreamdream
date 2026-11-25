"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  bindNativeGhostMusic,
  nativeGhostCss,
  NATIVE_GHOST_COORDINATES,
  sanitizeNativeGhostShell,
  validKnownGhostNativeSpec,
  validKnownGhostShell,
} from "@/lib/opening/censy-ghost-music";

/** Finite public-source adapter using native ShadowRoot/portal ownership. */
export function MufyCensyGhostMusic({
  spec,
  onOpenChange,
}: {
  spec: unknown;
  onOpenChange: (open: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    callback = useRef(onOpenChange);
  callback.current = onOpenChange;
  const [shadow, setShadow] = useState<ShadowRoot | null>(null),
    [failedKey, setFailedKey] = useState<string | null>(null);
  const key = JSON.stringify(spec);
  const stable = useMemo(() => {
    const v: unknown = JSON.parse(key);
    return validKnownGhostNativeSpec(v) ? v : null;
  }, [key]);
  const markup = useMemo(
    () => ({
      __html: stable ? sanitizeNativeGhostShell(stable.shellHtml) : "",
    }),
    [stable],
  );
  const css = useMemo(
    () => (stable ? nativeGhostCss(stable).css : ""),
    [stable],
  );
  useEffect(() => {
    if (host.current)
      setShadow(
        host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" }),
      );
  }, []);
  useEffect(() => {
    if (!shadow || !stable || !shell.current) return;
    try {
      if (!validKnownGhostShell(shell.current.innerHTML))
        throw Error("INVALID_MOUNTED_GHOST_SHELL");
      return bindNativeGhostMusic(shell.current, stable, (open) =>
        callback.current(open),
      );
    } catch {
      // A stale/invalid private envelope must not take down the chat tree.
      setFailedKey(key);
      callback.current(false);
    }
  }, [shadow, stable, key]);
  if (!stable || failedKey === key) return null;
  return (
    <div
      ref={host}
      className="nj_floating_widget nj_floating_sidebar"
      data-nj-censy-ghost-music-v4
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 45,
      }}
    >
      {shadow &&
        createPortal(
          <div data-character-css="opening">
            <style>{css + NATIVE_GHOST_COORDINATES}</style>
            <div ref={shell} dangerouslySetInnerHTML={markup} />
          </div>,
          shadow,
        )}
    </div>
  );
}
