"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  bindHeartNavOrb,
  HEART_COORDINATES,
  heartNativeCss,
  sanitizeHeartShell,
  validHeartNavSpec,
  validHeartNavShell,
} from "@/lib/opening/heart-orb-nav";

/** Public Heart OS controls only; no source program, parent bridge or send hook. */
export function MufyHeartNavOrbOS({
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
        return validHeartNavSpec(v) ? v : null;
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
      if (!validHeartNavShell(shell.current.innerHTML))
        throw Error("INVALID_MOUNTED_HEART");
      return bindHeartNavOrb(shell.current, stable, audio.current, {
        fill: onFillComposer
          ? (text) => callbacks.current.onFillComposer?.(text)
          : undefined,
        open: (value) => callbacks.current.onOpenChange(value),
        navigate: (direction) => {
          const chat = document.getElementById("nj_chat_messages");
          if (chat)
            chat.scrollTo({
              top: direction === "top" ? 0 : chat.scrollHeight,
              behavior: "smooth",
            });
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
      data-nj-heart-orb-nav-v441
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
