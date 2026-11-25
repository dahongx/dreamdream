"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { safeRandomUUID } from "@/lib/uuid";
import { copyTextToClipboard } from "@/lib/util/clipboard";
import type { ComposerPrefixSelection } from "@/lib/opening/composer-prefix";
import {
  parseMMV2PrefixSpec,
  type MMV2PrefixSpec,
} from "@/lib/opening/mmv2-prefix";
import {
  bindMMV2Audio,
  mmv2Filtered,
  mmv2NativeCss,
  mmv2PanelPosition,
  mmv2Position,
  mmv2Tags,
  reduceMMV2,
  restoreMMV2,
  type MMV2AudioControls,
  type MMV2AudioState,
  type MMV2Selection,
} from "@/lib/opening/mmv2-prefix";
import { MMV2Icon } from "./MufyMMV2SourceIcons";
function Action({
  children,
  id,
  onAction,
  className,
  title,
  style,
}: {
  children: ReactNode;
  id?: string;
  onAction: () => void;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      id={id}
      role="button"
      tabIndex={0}
      className={className}
      title={title}
      aria-label={title}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onAction();
      }}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          e.stopPropagation();
          onAction();
        }
      }}
    >
      {children}
    </div>
  );
}
const time = (seconds: number) => {
  const n = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
};
const initialAudio: MMV2AudioState = {
  index: 0,
  playing: false,
  pending: false,
  single: false,
  current: 0,
  duration: 0,
  error: false,
};
/** Finite public MMV2 layout; no captured program, parent access or send hook. */
export function MufyMMV2PrefixPanel({
  spec: input,
  sessionId,
  onChange,
}: {
  spec: MMV2PrefixSpec;
  sessionId: string;
  onChange: (s: ComposerPrefixSelection | null) => void;
}) {
  const specKey = JSON.stringify(input),
    spec = useMemo(() => parseMMV2PrefixSpec(input), [specKey]);
  const paint = useMemo(() => {
    try {
      return spec ? mmv2NativeCss(spec) : null;
    } catch {
      return null;
    }
  }, [spec]);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null),
    [open, setOpen] = useState(false),
    [tab, setTab] = useState<"presets" | "music" | "share">("presets"),
    [filter, setFilter] = useState("全部");
  const [selection, setSelection] = useState<MMV2Selection>(() =>
      restoreMMV2(null, input),
    ),
    [ready, setReady] = useState(false),
    [newText, setNewText] = useState(""),
    [newTag, setNewTag] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [editText, setEditText] = useState(""),
    [editTag, setEditTag] = useState("");
  const [position, setPosition] = useState({ left: 14, top: 14 }),
    [panelPosition, setPanelPosition] = useState({ left: 14, top: 14 }),
    [audioState, setAudioState] = useState(initialAudio),
    [expanded, setExpanded] = useState<number[]>([]),
    [notices, setNotices] = useState<Record<string, string>>({}),
    [fontStatus, setFontStatus] = useState("pending");
  const panel = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLDivElement>(null),
    audio = useRef<HTMLAudioElement>(null),
    list = useRef<HTMLDivElement>(null),
    controller = useRef<MMV2AudioControls | null>(null),
    callbacks = useRef(onChange);
  callbacks.current = onChange;
  const active = useRef(false),
    timers = useRef(new Map<string, ReturnType<typeof setTimeout>>()),
    copyTokens = useRef(new Map<string, number>()),
    copySerial = useRef(0),
    drag = useRef<{
      id: number;
      x: number;
      y: number;
      left: number;
      top: number;
      moved: boolean;
    } | null>(null),
    positionRef = useRef(position);
  positionRef.current = position;
  const key = `nj_mufy_mmv2_${sessionId}_${input.id}`,
    posKey = key + "_position";
  useEffect(() => {
    if (!spec || !paint?.complete) return;
    const node = document.createElement("div");
    node.dataset.njMmv2PrefixLayer = "";
    Object.assign(node.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "0",
      height: "0",
      pointerEvents: "none",
      zIndex: "45",
    });
    document.body.append(node);
    active.current = true;
    setShadow(node.attachShadow({ mode: "open" }));
    return () => {
      active.current = false;
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      copyTokens.current.clear();
      node.remove();
    };
  }, [spec, paint]);
  useEffect(() => {
    if (!spec) return;
    setReady(false);
    let raw: string | null = null,
      p: { left: number; top: number } | undefined;
    try {
      raw = window.localStorage.getItem(key);
      const stored: unknown = JSON.parse(
        window.localStorage.getItem(posKey) || "null",
      );
      if (
        stored &&
        typeof stored === "object" &&
        "left" in stored &&
        "top" in stored &&
        typeof stored.left === "number" &&
        typeof stored.top === "number" &&
        Number.isFinite(stored.left) &&
        Number.isFinite(stored.top)
      )
        p = { left: stored.left, top: stored.top };
    } catch {}
    setSelection(restoreMMV2(raw, spec));
    setPosition(
      mmv2Position(window.innerWidth, window.innerHeight, p?.left, p?.top),
    );
    setReady(true);
    return () => callbacks.current(null);
  }, [spec, key, posKey]);
  useEffect(() => {
    if (!ready) return;
    callbacks.current(selection);
    try {
      window.localStorage.setItem(key, JSON.stringify(selection));
    } catch {}
  }, [selection, ready, key]);
  useEffect(() => {
    if (!shadow || !spec || !audio.current) return;
    controller.current = bindMMV2Audio(
      audio.current,
      spec.mmv2.tracks,
      setAudioState,
    );
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
  }, [shadow, spec]);
  useEffect(() => {
    if (!shadow) return;
    let alive = true;
    let face: FontFace | null = null;
    const font = paint?.font;
    if (!font || typeof FontFace === "undefined") {
      setFontStatus("not-supported");
      return;
    }
    face = new FontFace(font.family, `url(${JSON.stringify(font.url)})`, {
      display: "swap",
    });
    face
      .load()
      .then((loaded) => {
        if (alive) {
          document.fonts.add(loaded);
          setFontStatus("loaded");
        }
      })
      .catch(() => {
        if (alive) setFontStatus("error");
      });
    return () => {
      alive = false;
      if (face) document.fonts.delete(face);
    };
  }, [shadow, paint]);
  useEffect(() => {
    if (!shadow) return;
    const outside = (e: Event) => {
      const path = e.composedPath();
      if (
        !path.includes(panel.current as EventTarget) &&
        !path.includes(trigger.current as EventTarget)
      )
        setOpen(false);
    };
    const resize = () =>
      setPosition(
        mmv2Position(
          window.innerWidth,
          window.innerHeight,
          positionRef.current.left,
          positionRef.current.top,
        ),
      );
    document.addEventListener("click", outside);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("click", outside);
      window.removeEventListener("resize", resize);
    };
  }, [shadow]);
  useEffect(() => {
    if (!open) return;
    const w =
        panel.current?.offsetWidth ||
        (window.innerWidth <= 350 ? window.innerWidth * 0.7 : 320),
      h =
        panel.current?.offsetHeight ||
        (window.innerWidth <= 350 ? window.innerWidth * 0.7 * 1.618 : 420);
    setPanelPosition(
      mmv2PanelPosition(window.innerWidth, window.innerHeight, position, w, h),
    );
  }, [open, position]);
  const dispatch = (a: Parameters<typeof reduceMMV2>[1]) =>
    setSelection((s) => reduceMMV2(s, a));
  const savePosition = (p: { left: number; top: number }) => {
    setPosition(p);
    try {
      window.localStorage.setItem(posKey, JSON.stringify(p));
    } catch {}
  };
  const toggleOpen = () => {
    setOpen((s) => !s);
    setTab("presets");
  };
  const copy = async (text: string, anchor: string) => {
    const token = ++copySerial.current;
    copyTokens.current.set(anchor, token);
    const ok = await copyTextToClipboard(text);
    if (!active.current || copyTokens.current.get(anchor) !== token) return;
    clearTimeout(timers.current.get(anchor));
    setNotices((s) => ({ ...s, [anchor]: ok ? "复制成功" : "复制失败" }));
    timers.current.set(
      anchor,
      setTimeout(() => {
        if (!active.current) return;
        setNotices((s) => {
          const next = { ...s };
          delete next[anchor];
          return next;
        });
        timers.current.delete(anchor);
        copyTokens.current.delete(anchor);
      }, 1000),
    );
  };
  const tip = (id: string) =>
    notices[id] ? (
      <div
        className="mmv2-toast-tip"
        data-copy-status="request-complete-unverified"
      >
        {notices[id]}
      </div>
    ) : null;
  const add = () => {
    const text = newText.trim(),
      tag = newTag.trim() || "通用";
    if (!text) return;
    const next = reduceMMV2(selection, {
      type: "save",
      id: safeRandomUUID(),
      text,
      tag,
      add: true,
    });
    if (next === selection) return;
    setSelection(next);
    setFilter(tag);
    setNewText("");
    setNewTag("");
  };
  useEffect(() => {
    if (open && tab === "presets" && list.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [selection.presets.length]);
  const confirmEdit = () => {
    if (editing)
      dispatch({ type: "save", id: editing, text: editText, tag: editTag });
    setEditing(null);
  };
  const enter = (fn: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      fn();
    }
  };
  if (!spec || !paint?.complete || !shadow) return null;
  const track = spec.mmv2.tracks[audioState.index],
    ratio =
      audioState.duration > 0
        ? Math.max(
            0,
            Math.min(100, (audioState.current / audioState.duration) * 100),
          )
        : 0;
  return createPortal(
    <div
      data-character-css="opening"
      style={{ width: 0, height: 0, pointerEvents: "none" }}
    >
      <style>
        {paint.css +
          '\n[data-character-css="opening"] .nj_mmv2_scope .share-card-body-wrap::after,[data-character-css="opening"] .nj_mmv2_scope .mmv2-toast-tip{pointer-events:none}'}
      </style>
      <div
        className="nj_mmv2_scope"
        data-font-status={fontStatus}
        style={{ width: 0, height: 0, pointerEvents: "none" }}
      >
        <div
          ref={trigger}
          id={`trigger_${spec.id}`}
          className={
            "mufy-trigger-bw-cls" +
            (selection.activeIds.length ? " active" : "")
          }
          role="button"
          tabIndex={0}
          aria-label="配置中心"
          aria-expanded={open}
          style={{
            position: "fixed",
            left: position.left,
            top: position.top,
            right: "auto",
            bottom: "auto",
            pointerEvents: "auto",
            zIndex: 2,
            touchAction: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleOpen();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            drag.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              ...positionRef.current,
              moved: false,
            };
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            e.preventDefault();
            const dx = e.clientX - d.x,
              dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
            savePosition(
              mmv2Position(
                window.innerWidth,
                window.innerHeight,
                d.left + dx,
                d.top + dy,
              ),
            );
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            e.preventDefault();
            e.stopPropagation();
            drag.current = null;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}
            if (!d.moved) toggleOpen();
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <MMV2Icon name="trigger" />
        </div>
        <div
          ref={panel}
          id={`panel_${spec.id}`}
          className={"mufy-bw-panel-cls" + (open ? " show" : "")}
          style={{
            position: "fixed",
            left: panelPosition.left,
            top: panelPosition.top,
            right: "auto",
            bottom: "auto",
            pointerEvents: open ? "auto" : "none",
            zIndex: 1,
          }}
          aria-hidden={!open}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bw-header">
            <div className="bw-title">配置中心</div>
            <Action
              id="bw-mode-toggle"
              className="bw-txt-action"
              title="切换指令插入位置"
              onAction={() => dispatch({ type: "mode" })}
            >
              {selection.mode === "before" ? "前缀插入" : "后缀嵌入"}
            </Action>
          </div>
          <div className="mmv2-tabs">
            {(
              [
                ["presets", "指令集"],
                ["music", "播放器"],
                ["share", "面具指令[复制放置]"],
              ] as const
            ).map(([id, label]) => (
              <Action
                key={id}
                id={`mmv2-tab-${id}`}
                className={"mmv2-tab" + (tab === id ? " active" : "")}
                title={label}
                onAction={() => setTab(id)}
              >
                {label}
              </Action>
            ))}
          </div>
          <div
            id="mmv2-dynamic-filter-bar"
            className="mmv2-filter-bar"
            style={{ display: tab === "presets" ? undefined : "none" }}
          >
            {mmv2Tags(selection).map((tag) => (
              <Action
                key={tag}
                className={
                  "mmv2-filter-pill" + (filter === tag ? " active" : "")
                }
                onAction={() => setFilter(tag)}
              >
                {tag}
              </Action>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              id="mmv2-page-view-presets"
              className={
                "mmv2-view-panel" + (tab === "presets" ? " active" : "")
              }
              style={{ height: "100%" }}
            >
              <div id="bw-preset-container" className="bw-list" ref={list}>
                {filter === "全部" && (
                  <Action
                    className={
                      "bw-item default-item" +
                      (!selection.activeIds.length ? " selected" : "")
                    }
                    onAction={() => dispatch({ type: "clear" })}
                  >
                    <div className="bw-checkbox" />
                    <div
                      className="bw-content"
                      style={{
                        color: "rgba(255,255,255,.25)",
                        fontStyle: "italic",
                      }}
                    >
                      (不激活任意预设指令 / Clear)
                    </div>
                  </Action>
                )}
                {mmv2Filtered(selection, filter).map((p) => (
                  <div
                    key={p.id}
                    className={
                      "bw-item" +
                      (selection.activeIds.includes(p.id) ? " selected" : "")
                    }
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editing !== p.id)
                        dispatch({ type: "toggle", id: p.id });
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.target === e.currentTarget &&
                        (e.key === " " || e.key === "Enter")
                      ) {
                        e.preventDefault();
                        dispatch({ type: "toggle", id: p.id });
                      }
                    }}
                  >
                    {editing === p.id ? (
                      <>
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            width: "100%",
                          }}
                        >
                          <input
                            autoFocus
                            className="bw-edit-input"
                            id="mmv2-inline-edit-val"
                            aria-label="修改指令"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={enter(confirmEdit)}
                          />
                          <input
                            className="bw-edit-input"
                            id="mmv2-inline-edit-tag"
                            aria-label="修改分区"
                            value={editTag}
                            onChange={(e) => setEditTag(e.target.value)}
                            style={{ fontSize: 10 }}
                            placeholder="指定分区名"
                            onKeyDown={enter(confirmEdit)}
                          />
                        </div>
                        <Action
                          className="bw-btn-icon action-confirm"
                          title="保存"
                          onAction={confirmEdit}
                        >
                          <MMV2Icon name="confirm" />
                        </Action>
                      </>
                    ) : (
                      <>
                        <div className="bw-checkbox" />
                        <div className="bw-content">
                          {p.text}
                          <span className="bw-inline-tag">[分区: {p.tag}]</span>
                        </div>
                        <div className="bw-actions">
                          <Action
                            className="bw-btn-icon action-copy"
                            title="单独复制"
                            onAction={() => {
                              void copy(p.text, p.id);
                            }}
                          >
                            <MMV2Icon name="copy" />
                          </Action>
                          <Action
                            className="bw-btn-icon action-edit"
                            title="修改"
                            onAction={() => {
                              setEditing(p.id);
                              setEditText(p.text);
                              setEditTag(p.tag);
                            }}
                          >
                            <MMV2Icon name="edit" />
                          </Action>
                          <Action
                            className="bw-btn-icon action-delete"
                            title="删除"
                            onAction={() => {
                              if (window.confirm("确认丢弃删除该指令吗？"))
                                dispatch({ type: "delete", id: p.id });
                            }}
                          >
                            <MMV2Icon name="delete" />
                          </Action>
                        </div>
                      </>
                    )}
                    {tip(p.id)}
                  </div>
                ))}
              </div>
            </div>
            <div
              id="mmv2-page-view-music"
              className={"mmv2-view-panel" + (tab === "music" ? " active" : "")}
              style={{ height: "100%" }}
            >
              <div className="netease-music-box">
                <div className="netease-player-dashboard">
                  <div className="netease-info">
                    <div className="netease-title">{track.title}</div>
                    <div className="netease-artist">{track.artist}</div>
                  </div>
                  <div className="netease-progress-wrap">
                    <div
                      id="netease-seeker-track"
                      className="netease-bar-bg"
                      role="slider"
                      tabIndex={0}
                      aria-label="播放进度"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={ratio}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        if (r.width > 0)
                          controller.current?.seek(
                            (e.clientX - r.left) / r.width,
                          );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                          e.preventDefault();
                          controller.current?.seek(
                            ratio / 100 +
                              (e.key === "ArrowRight" ? 0.05 : -0.05),
                          );
                        }
                      }}
                    >
                      <div
                        id="netease-seeker-fill"
                        className="netease-bar-fill"
                        style={{ width: ratio + "%" }}
                      />
                    </div>
                    <div className="netease-time-indicator">
                      <span id="netease-timer-current">
                        {time(audioState.current)}
                      </span>
                      <span id="netease-timer-duration">
                        {time(audioState.duration)}
                      </span>
                    </div>
                  </div>
                  <div className="netease-controls">
                    <Action
                      className={
                        "netease-icon-btn" +
                        (audioState.single ? " active" : "")
                      }
                      id="netease-ctrl-loop"
                      title="单曲循环"
                      onAction={() => controller.current?.loop()}
                    >
                      <MMV2Icon name="loop" />
                    </Action>
                    <Action
                      className="netease-icon-btn"
                      id="netease-ctrl-play"
                      title={
                        audioState.playing
                          ? "暂停"
                          : audioState.pending
                            ? "取消加载"
                            : "播放"
                      }
                      style={{ transform: "scale(1.2)" }}
                      onAction={() => controller.current?.toggle()}
                    >
                      <MMV2Icon name={audioState.playing ? "pause" : "play"} />
                    </Action>
                    <Action
                      className="netease-icon-btn"
                      id="netease-ctrl-next"
                      title="下一首"
                      onAction={() => controller.current?.next()}
                    >
                      <MMV2Icon name="next" />
                    </Action>
                  </div>
                </div>
                <div className="netease-playlist-header">
                  播放列表 ({spec.mmv2.tracks.length}首)
                </div>
                <div
                  id="netease-playlist-tracks-container"
                  className="netease-playlist"
                >
                  {spec.mmv2.tracks.map((t, index) => (
                    <Action
                      key={t.url}
                      className={
                        "netease-track-item" +
                        (index === audioState.index ? " current-active" : "")
                      }
                      onAction={() => controller.current?.select(index)}
                    >
                      <div className="track-meta-left">
                        <span className="track-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="track-name">{t.title}</span>
                      </div>
                      <span className="track-artist-tag">{t.artist}</span>
                    </Action>
                  ))}
                </div>
                <span
                  role="status"
                  style={{ display: audioState.error ? "block" : "none" }}
                >
                  音频暂不可用
                </span>
              </div>
            </div>
            <div
              id="mmv2-page-view-share"
              className={"mmv2-view-panel" + (tab === "share" ? " active" : "")}
              style={{ height: "100%" }}
            >
              <div className="share-view-wrapper">
                {spec.mmv2.shareCards.map((card, index) => (
                  <div
                    key={index}
                    className="share-card-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      void copy(card.text, "share" + index);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.target === e.currentTarget &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        void copy(card.text, "share" + index);
                      }
                    }}
                  >
                    <div className="share-card-header">
                      <span className="share-card-title">{card.title}</span>
                      <span className="share-card-subtitle">
                        {card.subtitle}
                      </span>
                    </div>
                    <div
                      className={
                        "share-card-body-wrap" +
                        (expanded.includes(index) ? " expanded" : "")
                      }
                    >
                      <div className="share-card-body">{card.text}</div>
                    </div>
                    <Action
                      className="share-card-expand-btn"
                      onAction={() =>
                        setExpanded((s) =>
                          s.includes(index)
                            ? s.filter((i) => i !== index)
                            : [...s, index],
                        )
                      }
                    >
                      {expanded.includes(index)
                        ? "▲ 点击收起内容 / COLLAPSE"
                        : "▼ 点击展开全部 / EXPAND"}
                    </Action>
                    {tip("share" + index)}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div
            id="mmv2-presets-footer"
            className="bw-footer"
            style={{ display: tab === "presets" ? undefined : "none" }}
          >
            <div className="bw-footer-row">
              <input
                id="bw-new-input"
                className="bw-input main-input"
                placeholder="输入指令内容...（列表可多选）"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={enter(add)}
              />
              <input
                id="bw-new-tag"
                className="bw-input tag-input"
                placeholder="指定Tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={enter(add)}
              />
              <Action id="bw-add-btn" className="bw-txt-action" onAction={add}>
                添加
              </Action>
            </div>
          </div>
        </div>
        <audio ref={audio} preload="metadata" style={{ display: "none" }} />
      </div>
    </div>,
    shadow,
  );
}
