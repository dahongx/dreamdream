"use client";
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  validNativeCommands,
  type NativeImageSidebar,
} from "@/lib/opening/native-image-sidebar";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

/** Known public command titles/data only. No source JS, iframe, send or context API. */
export function MufyCommandDrawer({
  spec,
  characterId,
  onFillComposer,
  onOpenChange,
}: {
  spec: NativeImageSidebar;
  characterId: string;
  onFillComposer?: (text: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const fill = useRef(onFillComposer),
    notify = useRef(onOpenChange);
  fill.current = onFillComposer;
  notify.current = onOpenChange;
  const configKey = JSON.stringify(spec.commandDrawer);
  const config = useMemo(() => spec.commandDrawer, [configKey]);
  const markup = useMemo(
    () => ({
      __html: DOMPurify.sanitize(spec.shellHtml, {
        ALLOWED_TAGS: [
          "div",
          "span",
          "input",
          "textarea",
          "button",
          "svg",
          "path",
          "line",
          "polyline",
          "circle",
        ],
        ALLOWED_ATTR: [
          "id",
          "class",
          "type",
          "placeholder",
          "viewBox",
          "d",
          "fill",
          "stroke",
          "stroke-width",
          "stroke-linecap",
          "stroke-linejoin",
          "x1",
          "x2",
          "y1",
          "y2",
          "cx",
          "cy",
          "r",
          "points",
        ],
        ALLOW_DATA_ATTR: false,
      }),
    }),
    [spec.shellHtml],
  );
  const css = useMemo(
    () =>
      sanitizeAndScopeCss(spec.css.replaceAll(":root", ".cen-root"), "opening")
        .css,
    [spec.css],
  );
  useEffect(() => {
    if (host.current)
      setShadow(
        host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" }),
      );
  }, []);
  useEffect(() => {
    const node = host.current,
      root = shell.current;
    if (!shadow || !node || !root || !validNativeCommands(config)) return;
    const trigger = root.querySelector<HTMLElement>("#cen-cmd-toggle"),
      board = root.querySelector<HTMLElement>("#Mg_board_v2"),
      close = root.querySelector<HTMLElement>("#cen-cmd-close"),
      list = root.querySelector<HTMLElement>("#cen-cmd-ul"),
      title = root.querySelector<HTMLInputElement>("#cen-new-title"),
      content = root.querySelector<HTMLTextAreaElement>("#cen-new-content"),
      save = root.querySelector<HTMLButtonElement>("#cen-save-btn");
    if (!trigger || !board || !close || !list || !title || !content || !save)
      return;
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.className = "nj_command_status";
    board.append(status);
    const key = `nj_mufy_commands_${characterId}_${config.id}`;
    let custom: { title: string; content: string }[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      if (Array.isArray(parsed) && parsed.length === 0) custom = [];
      else if (validNativeCommands({ id: config.id, commands: parsed }))
        custom = parsed;
    } catch {}
    let opened = false,
      removed: {
        item: { title: string; content: string };
        index: number;
      } | null = null;
    const persist = () => {
      try {
        window.localStorage.setItem(key, JSON.stringify(custom));
      } catch {
        status.textContent = "无法保存到此浏览器；当前面板仍可使用。";
      }
    };
    const show = (next: boolean) => {
      opened = next;
      board.classList.toggle("open", next);
      board.setAttribute("aria-hidden", String(!next));
      board.inert = !next;
      trigger.setAttribute("aria-expanded", String(next));
      notify.current(next);
    };
    const render = () => {
      list.replaceChildren();
      const all = [...config.commands, ...custom];
      all.forEach((cmd, index) => {
        const row = document.createElement("div");
        row.className =
          "cen-cmd-item" + (index >= config.commands.length ? " custom" : "");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nj_command_pick cen-cmd-title";
        button.textContent = cmd.title;
        button.addEventListener("click", () => {
          if (fill.current) {
            fill.current(cmd.content);
            status.textContent = "已填入输入框，尚未发送。";
            show(false);
          } else status.textContent = "请在对话中使用。";
        });
        row.append(button);
        if (index >= config.commands.length) {
          const del = document.createElement("button");
          del.type = "button";
          del.className = "cen-cmd-del";
          del.textContent = "×";
          del.setAttribute("aria-label", `删除 ${cmd.title}`);
          del.addEventListener("click", () => {
            const at = index - config.commands.length;
            removed = { item: custom[at], index: at };
            custom = custom.filter((_, i) => i !== at);
            persist();
            render();
            status.replaceChildren(document.createTextNode("已删除。"));
            const undo = document.createElement("button");
            undo.type = "button";
            undo.textContent = "撤销";
            undo.onclick = () => {
              if (!removed) return;
              const restored = [...custom];
              restored.splice(
                Math.min(removed.index, custom.length),
                0,
                removed.item,
              );
              if (!validNativeCommands({ id: config.id, commands: restored })) {
                status.textContent = "当前已达容量上限，暂不能恢复。";
                return;
              }
              custom = restored;
              removed = null;
              persist();
              render();
              status.textContent = "已恢复。";
            };
            status.append(undo);
          });
          row.append(del);
        }
        list.append(row);
      });
    };
    const add = () => {
      const next = [
        ...custom,
        { title: title.value.trim(), content: content.value.trim() },
      ];
      if (!validNativeCommands({ id: config.id, commands: next })) {
        status.textContent =
          "请填写标题和内容；最多50项，标题200字、内容40000字以内。";
        return;
      }
      custom = next;
      persist();
      render();
      title.value = "";
      content.value = "";
      status.textContent = "已保存新指令，尚未发送。";
    };
    const toggle = () => show(!opened),
      hide = () => show(false),
      outside = (event: Event) => {
        if (event.target && !node.contains(event.target as Node)) hide();
      };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hide();
        trigger.focus();
      } else if (
        (event.key === "Enter" || event.key === " ") &&
        event.target === trigger
      ) {
        event.preventDefault();
        toggle();
      }
    };
    trigger.setAttribute("role", "button");
    trigger.tabIndex = 0;
    trigger.setAttribute("aria-label", "指令面板");
    close.setAttribute("role", "button");
    close.tabIndex = 0;
    close.setAttribute("aria-label", "关闭指令面板");
    const closeKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        hide();
        trigger.focus();
      }
    };
    const formKey = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        !event.isComposing &&
        event.target === title
      ) {
        event.preventDefault();
        content.focus();
      }
    };
    title.maxLength = 200;
    content.maxLength = 40000;
    save.type = "button";
    trigger.addEventListener("click", toggle);
    root.addEventListener("keydown", keyboard);
    root.addEventListener("keydown", formKey);
    close.addEventListener("click", hide);
    close.addEventListener("keydown", closeKey);
    save.addEventListener("click", add);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    render();
    show(false);
    return () => {
      trigger.removeEventListener("click", toggle);
      root.removeEventListener("keydown", keyboard);
      root.removeEventListener("keydown", formKey);
      close.removeEventListener("click", hide);
      close.removeEventListener("keydown", closeKey);
      save.removeEventListener("click", add);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      status.remove();
      notify.current(false);
    };
  }, [shadow, config, characterId, markup]);
  return (
    <div
      ref={host}
      className="nj_floating_widget"
      data-nj-command-drawer={config?.id}
      style={{ position: "fixed", inset: 0, zIndex: 45, pointerEvents: "none" }}
    >
      {shadow &&
        createPortal(
          <div className="cen-root" data-character-css="opening">
            <style>
              {css +
                `[data-character-css="opening"]{font-size:16px;line-height:1.5;color:rgb(249,250,251)}
                [data-character-css="opening"] *{box-sizing:border-box}
                [data-character-css="opening"] #cen-cmd-toggle{pointer-events:auto}
                [data-character-css="opening"] .cen-cmd-panel{pointer-events:none}
                [data-character-css="opening"] .cen-cmd-panel.open{pointer-events:auto}
                [data-character-css="opening"] .nj_command_pick{display:block;width:100%;background:none;border:0;padding:0;font-family:inherit;text-align:inherit;cursor:pointer}
                [data-character-css="opening"] .nj_command_status{font-size:12px;line-height:1.5}
                [data-character-css="opening"] #Ks_wrapper_v2{position:fixed;top:30%;right:20px;pointer-events:none;max-width:calc(100vw - 20px)}
                [data-character-css="opening"] #Mg_board_v2{max-width:calc(100vw - 80px)}
                [data-character-css="opening"] .cen-cmd-item.custom .cen-cmd-del{display:block}
                [data-character-css="opening"] button:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}
            </style>
            <div ref={shell} className="cen-root" dangerouslySetInnerHTML={markup} />
          </div>,
          shadow,
        )}
    </div>
  );
}
