"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  bindHeartOrb,
  HEART_COORDINATES,
  heartNativeCss,
  sanitizeHeartShell,
  validHeartOrbSpec,
  validHeartShell,
} from "@/lib/opening/heart-orb-os";

/** Public Heart OS controls only; no source program, parent bridge or send hook. */
export function MufyHeartOrbOS({
  spec,
  onFillComposer,
  onOpenChange,
}: {
  spec: unknown;
  onFillComposer?: (text: string) => void;
  onOpenChange: (value: boolean) => void;
}) {
  const key = JSON.stringify(spec),
    stable = useMemo(() => {
      try {
        const v: unknown = JSON.parse(key);
        return validHeartOrbSpec(v) ? v : null;
      } catch {
        return null;
      }
    }, [key]);
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    audio = useRef<HTMLAudioElement>(null),
    callbacks = useRef({ onFillComposer, onOpenChange });
  callbacks.current = { onFillComposer, onOpenChange };
  const [shadow, setShadow] = useState<ShadowRoot | null>(null),
    [failedKey, setFailedKey] = useState<string | null>(null);
  const markup = useMemo(
      () => ({ __html: stable ? sanitizeHeartShell(stable.shellHtml) : "" }),
      [stable],
    ),
    css = useMemo(
      () => (stable ? heartNativeCss(stable.css).css : ""),
      [stable],
    );
  useEffect(() => {
    if (host.current)
      setShadow(
        host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" }),
      );
  }, []);
  useEffect(() => {
    if (!shadow || !stable || !shell.current || !audio.current) return;
    try {
      if (!validHeartShell(shell.current.innerHTML))
        throw Error("INVALID_MOUNTED_HEART");
      return bindHeartOrb(shell.current, stable, audio.current, {
        fill: onFillComposer
          ? (text) => callbacks.current.onFillComposer?.(text)
          : undefined,
        open: (value) => callbacks.current.onOpenChange(value),
        copy: async (url) => {
          // User-initiated copying of this finite public gallery URL only. A success
          // return is not proof of clipboard readback; that remains actual UI QA.
          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(url);
              return true;
            } catch {
              /* Original source also supports ordinary copy on HTTP. */
            }
          }
          const previous = document.activeElement,
            temporary = document.createElement("textarea");
          temporary.value = url;
          temporary.setAttribute("aria-hidden", "true");
          temporary.style.cssText = "position:fixed;left:-9999px;top:0";
          document.body.append(temporary);
          temporary.select();
          let ok = false;
          try {
            ok = document.execCommand("copy");
          } finally {
            temporary.remove();
            if (previous instanceof HTMLElement) previous.focus();
          }
          return ok;
        },
      });
    } catch {
      setFailedKey(key);
      callbacks.current.onOpenChange(false);
    }
  }, [shadow, stable, key, Boolean(onFillComposer)]);
  if (!stable || failedKey === key) return null;
  return (
    <div
      ref={host}
      data-nj-heart-orb-os-v42
      className="nj_floating_widget"
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
            <style>{css + HEART_COORDINATES}</style>
            <div ref={shell} dangerouslySetInnerHTML={markup} />
            <audio ref={audio} preload="none" />
          </div>,
          shadow,
        )}
    </div>
  );
}
