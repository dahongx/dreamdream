"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildMufyComposerCompanionFrame,
  type CompanionBounds,
  companionControlAction,
  companionDraftIntent,
  extractMufyComposerCompanion,
  validateCompanionBounds,
} from "@/lib/import/mufy-composer-companion";

/** One stable opening companion, independent of streamed message mounts. */
export const MufyComposerCompanion = memo(function MufyComposerCompanion({
  contents,
}: {
  contents: string[];
}) {
  const program = useMemo(() => {
    const found = contents
      .map(extractMufyComposerCompanion)
      .filter((value): value is string => value !== null);
    return found.length === 1 ? found[0] : null;
  }, [contents]);
  return program ? <CompanionInstance key={program} program={program} /> : null;
});

function CompanionInstance({ program }: { program: string }) {
  const srcdoc = useMemo(
    () => buildMufyComposerCompanionFrame(program),
    [program],
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const [bounds, setBounds] = useState<CompanionBounds | null>(null);
  const [anchor, setAnchor] = useState<{ right: number; top: number } | null>(
    null,
  );
  useEffect(() => {
    const composer = document.getElementById("nj_chat_input_box");
    if (!composer) return;
    function measure() {
      if (!composer) return;
      const r = composer.getBoundingClientRect();
      setAnchor(
        r.width && r.height ? { right: r.right - 15, top: r.top } : null,
      );
    }
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      const value = validateCompanionBounds(event.data);
      if (value) setBounds(value);
    }
    function input(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      frame.current?.contentWindow?.postMessage(
        {
          type: "mufy-composer-companion-intent",
          intent: companionDraftIntent(target.value),
        },
        "*",
      );
    }
    function click(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const action = companionControlAction(target);
      if (action)
        frame.current?.contentWindow?.postMessage(
          { type: "mufy-composer-companion-action", action },
          "*",
        );
    }
    function stageInput(event: Event) {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !target.matches(
          'input[type="range"].nj_stage_adjust_brightness,input[type="range"].nj_stage_adjust_clarity',
        )
      )
        return;
      frame.current?.contentWindow?.postMessage(
        { type: "mufy-composer-companion-action", action: "slider" },
        "*",
      );
    }
    const observer = new ResizeObserver(measure);
    observer.observe(composer);
    measure();
    window.addEventListener("message", receive);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    composer.addEventListener("input", input);
    document.addEventListener("click", click, true);
    document.addEventListener("input", stageInput, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("message", receive);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      composer.removeEventListener("input", input);
      document.removeEventListener("click", click, true);
      document.removeEventListener("input", stageInput, true);
    };
  }, []);
  if (!anchor) return null;
  return createPortal(
    <div
      data-mufy-composer-companion
      className="nj_floating_widget fixed z-[45] overflow-hidden"
      style={{
        left: anchor.right - 320 + (bounds?.x ?? 0),
        top: anchor.top - 240 + (bounds?.y ?? 0),
        width: bounds?.width ?? 0,
        height: bounds?.height ?? 0,
      }}
    >
      <iframe
        ref={(node) => {
          frame.current = node;
          node?.style.setProperty("display", "block", "important");
        }}
        title="mufy-composer-companion"
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        style={{
          position: "absolute",
          left: -(bounds?.x ?? 0),
          top: -(bounds?.y ?? 0),
          width: 320,
          height: 240,
          border: 0,
          background: "transparent",
        }}
      />
    </div>,
    document.body,
  );
}
