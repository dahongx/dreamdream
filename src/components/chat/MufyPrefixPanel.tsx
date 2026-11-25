"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  readPrefixSelection,
  restoreDeletedPrefix,
  validPrefixPresets,
  type ComposerPrefixSelection,
  type ComposerPrefixSpec,
  type DeletedPrefixPreset,
} from "@/lib/opening/composer-prefix";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { safeRandomUUID } from "@/lib/uuid";
import { MufyMMV2PrefixPanel } from "./MufyMMV2PrefixPanel";
import { parseMMV2PrefixSpec } from "@/lib/opening/mmv2-prefix";
export function MufyPrefixPanel(props: { spec: ComposerPrefixSpec; sessionId: string; onChange: (selection: ComposerPrefixSelection | null) => void }) {
  if ("layout" in props.spec || "mmv2" in props.spec) {
    const native = parseMMV2PrefixSpec(props.spec);
    return native ? <MufyMMV2PrefixPanel {...props} key={`${props.sessionId}:${native.id}`} spec={native} /> : null;
  }
  return <LegacyMufyPrefixPanel {...props} />;
}
const fonts = new Map<string, FontFace>();

/** Native controls, authored public CSS. Never executes the source hook/program. */
function LegacyMufyPrefixPanel({
  spec,
  sessionId,
  onChange,
}: {
  spec: ComposerPrefixSpec;
  sessionId: string;
  onChange: (selection: ComposerPrefixSelection | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const layerHost = useRef<HTMLDivElement | null>(null),
    [layerShadow, setLayerShadow] = useState<ShadowRoot | null>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null),
    [selection, setSelection] = useState<ComposerPrefixSelection>(() =>
      readPrefixSelection(null, spec),
    );
  const [ready, setReady] = useState(false),
    [open, setOpen] = useState(false),
    [newText, setNewText] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [editText, setEditText] = useState("");
  const [fontStatus, setFontStatus] = useState("pending");
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<DeletedPrefixPreset | null>(null),
    [anchor, setAnchor] = useState({ left: 12, bottom: 64 });
  const callback = useRef(onChange);
  callback.current = onChange;
  const key = `nj_mufy_prefix_${sessionId}_${spec.id}`;
  const css = useMemo(
    () => sanitizeAndScopeCss(spec.css, "opening").css,
    [spec.css],
  );
  useEffect(() => {
    if (host.current)
      setShadow(
        host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" }),
      );
  }, []);
  useEffect(() => {
    if (!spec.fontFace || typeof FontFace === "undefined") {
      setFontStatus("not-supported");
      return;
    }
    let active = true;
    const { family, url } = spec.fontFace;
    const face =
      fonts.get(family) ??
      new FontFace(family, `url(${JSON.stringify(url)})`, { display: "swap" });
    fonts.set(family, face);
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        if (active) setFontStatus("loaded");
      })
      .catch(() => {
        fonts.delete(family);
        if (active) setFontStatus("error");
      });
    return () => {
      active = false;
    };
  }, [spec.fontFace]);
  useEffect(() => {
    const node = document.createElement("div");
    node.setAttribute("data-nj-prefix-layer", "");
    Object.assign(node.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "70",
    });
    document.body.appendChild(node);
    layerHost.current = node;
    setLayerShadow(node.attachShadow({ mode: "open" }));
    return () => {
      node.remove();
      layerHost.current = null;
    };
  }, []);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {}
    setSelection(readPrefixSelection(raw, spec));
    setReady(true);
    return () => callback.current(null);
  }, [key, spec]);
  useEffect(() => {
    if (!ready) return;
    callback.current(selection);
    try {
      window.localStorage.setItem(key, JSON.stringify(selection));
    } catch {}
  }, [selection, ready, key]);
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (r)
        setAnchor({
          left: Math.max(12, Math.min(r.left, window.innerWidth - 332)),
          bottom: Math.max(12, window.innerHeight - r.top + 15),
        });
    };
    const outside = (event: Event) => {
      const path = event.composedPath();
      if (
        !path.includes(host.current as EventTarget) &&
        !path.includes(layerHost.current as EventTarget)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const toggle = (id: string) =>
    setSelection((s) => ({
      ...s,
      activeIds: s.activeIds.includes(id)
        ? s.activeIds.filter((x) => x !== id)
        : [...s.activeIds, id],
    }));
  const add = () => {
    const text = newText.trim();
    if (!text) return;
    const presets = [...selection.presets, { id: safeRandomUUID(), text }];
    if (!validPrefixPresets(presets)) {
      setNotice("内容过长或条目过多，输入已保留，尚未保存。");
      return;
    }
    setSelection((s) => ({ ...s, presets }));
    setNewText("");
    setNotice("");
  };
  const save = () => {
    const text = editText.trim();
    if (!text) return;
    const presets = selection.presets.map((p) =>
      p.id === editing ? { ...p, text } : p,
    );
    if (!validPrefixPresets(presets)) {
      setNotice("内容过长，修改已保留，尚未保存。");
      return;
    }
    setSelection((s) => ({ ...s, presets }));
    setEditing(null);
    setNotice("");
  };
  const icon = (kind: "menu" | "edit" | "delete" | "save") => (
    <svg
      width={kind === "menu" ? 20 : 14}
      height={kind === "menu" ? 20 : 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={
          kind === "menu"
            ? "M3 6h18M3 12h18M3 18h18"
            : kind === "edit"
              ? "M16 3l5 5M4 20l4-1L21 6l-3-3L5 16z"
              : kind === "delete"
                ? "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15"
                : "M4 12l5 5L20 6"
        }
      />
    </svg>
  );
  return (
    <div
      ref={host}
      data-nj-composer-prefix
      data-nj-font-status={fontStatus}
      className="shrink-0 self-center"
      style={{ width: 28, height: 28, marginRight: 8 }}
    >
      {shadow &&
        createPortal(
          <div data-character-css="opening">
            <style>
              {css +
                `:host{all:initial;display:block}#mufy-fixed-trigger-bw{margin:0!important}#mufy-bw-panel{position:fixed!important;left:${anchor.left}px!important;bottom:${anchor.bottom}px!important;width:min(320px,calc(100vw - 24px))!important;height:min(380px,calc(100dvh - 32px))!important;z-index:70!important;line-height:1.5}#mufy-bw-panel button{font-family:inherit;cursor:pointer}#mufy-bw-panel .bw-checkbox{padding:0}#mufy-bw-panel .bw-actions button{background:transparent;border:0}#mufy-bw-panel input{font-size:13px}#mufy-bw-panel [data-prefix-text]{text-align:left;border:0;background:transparent;padding:0}#mufy-fixed-trigger-bw:focus-visible,#mufy-bw-panel button:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}
            </style>
            <button
              ref={trigger}
              id="mufy-fixed-trigger-bw"
              type="button"
              aria-label="固定指令配置"
              aria-expanded={open}
              className={selection.activeIds.length ? "active" : ""}
              onClick={() => setOpen((v) => !v)}
            >
              {icon("menu")}
            </button>
            {layerShadow &&
              createPortal(
                <div data-character-css="opening">
                  <style>
                    {css +
                      `#mufy-bw-panel{position:fixed!important;left:${anchor.left}px!important;bottom:${anchor.bottom}px!important;width:min(320px,calc(100vw - 24px))!important;height:min(380px,calc(100dvh - 32px))!important;z-index:70!important;line-height:1.5;pointer-events:auto}#mufy-bw-panel button{font-family:inherit;cursor:pointer}#mufy-bw-panel .bw-checkbox{padding:0}#mufy-bw-panel .bw-actions button{background:transparent;border:0}#mufy-bw-panel input{font-size:13px}#mufy-bw-panel [data-prefix-text]{text-align:left;border:0;background:transparent;padding:0}#mufy-bw-panel button:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}
                  </style>
                  <div
                    ref={panel}
                    id="mufy-bw-panel"
                    style={{ display: open ? "flex" : "none" }}
                    className={open ? "show" : ""}
                    role="dialog"
                    aria-label="固定指令配置"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        setOpen(false);
                        trigger.current?.focus();
                      }
                    }}
                  >
                    <div className="bw-header">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div className="bw-title">指令配置</div>
                        <button
                          type="button"
                          id="bw-mode-toggle"
                          onClick={() =>
                            setSelection((s) => ({
                              ...s,
                              mode: s.mode === "before" ? "after" : "before",
                            }))
                          }
                        >
                          {selection.mode === "before"
                            ? "前缀插入"
                            : "后缀嵌入"}
                        </button>
                      </div>
                      <div className="bw-subtitle">「点击左侧文字切换」</div>
                    </div>
                    <div className="bw-list" id="bw-preset-container">
                      <button
                        type="button"
                        className={`bw-item default-item ${selection.activeIds.length ? "" : "selected"}`}
                        onClick={() =>
                          setSelection((s) => ({ ...s, activeIds: [] }))
                        }
                      >
                        <span className="bw-checkbox" />
                        <span className="bw-content">(不使用 / Default)</span>
                      </button>
                      {selection.presets.map((p, index) => (
                        <div
                          key={p.id}
                          className={`bw-item ${selection.activeIds.includes(p.id) ? "selected" : ""}`}
                        >
                          {editing === p.id ? (
                            <>
                              <input
                                aria-label="编辑固定指令"
                                className="bw-edit-input"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    !e.nativeEvent.isComposing &&
                                    e.nativeEvent.keyCode !== 229
                                  ) {
                                    e.preventDefault();
                                    save();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="bw-btn-icon confirm"
                                aria-label="保存固定指令"
                                onClick={save}
                              >
                                {icon("save")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="bw-checkbox"
                                aria-label={`选择固定指令 ${p.id}`}
                                aria-pressed={selection.activeIds.includes(
                                  p.id,
                                )}
                                onClick={() => toggle(p.id)}
                              />
                              <button
                                type="button"
                                data-prefix-text
                                className="bw-content"
                                onClick={() => toggle(p.id)}
                              >
                                {p.text}
                              </button>
                              <span className="bw-actions">
                                <button
                                  type="button"
                                  className="bw-btn-icon edit"
                                  aria-label={`编辑固定指令 ${p.id}`}
                                  onClick={() => {
                                    setEditing(p.id);
                                    setEditText(p.text);
                                  }}
                                >
                                  {icon("edit")}
                                </button>
                                <button
                                  type="button"
                                  className="bw-btn-icon delete"
                                  aria-label={`删除固定指令 ${p.id}`}
                                  onClick={() => {
                                    setUndo({
                                      preset: p,
                                      index,
                                      wasActive: selection.activeIds.includes(
                                        p.id,
                                      ),
                                    });
                                    setSelection((s) => ({
                                      ...s,
                                      presets: s.presets.filter(
                                        (x) => x.id !== p.id,
                                      ),
                                      activeIds: s.activeIds.filter(
                                        (x) => x !== p.id,
                                      ),
                                    }));
                                  }}
                                >
                                  {icon("delete")}
                                </button>
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                      {undo && (
                        <button
                          type="button"
                          className="bw-btn"
                          onClick={() => {
                            const next = restoreDeletedPrefix(selection, undo);
                            if (next === selection) {
                              setNotice("请先移除一条指令，再恢复已删除内容。");
                              return;
                            }
                            setSelection(next);
                            setUndo(null);
                            setNotice("");
                          }}
                        >
                          撤销删除
                        </button>
                      )}
                      {notice && (
                        <div role="status" className="bw-content">
                          {notice}
                        </div>
                      )}
                    </div>
                    <div className="bw-footer">
                      <input
                        id="bw-new-input"
                        className="bw-input"
                        aria-label="新增固定指令"
                        placeholder="输入新内容...（上方条目可多选）"
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.nativeEvent.isComposing &&
                            e.nativeEvent.keyCode !== 229
                          ) {
                            e.preventDefault();
                            add();
                          }
                        }}
                      />
                      <button type="button" className="bw-btn" onClick={add}>
                        添加
                      </button>
                    </div>
                  </div>
                </div>,
                layerShadow,
              )}
          </div>,
          shadow,
        )}
    </div>
  );
}
