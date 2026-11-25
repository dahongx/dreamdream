"use client";
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  clampFoxPosition,
  defaultFoxPreferences,
  type FoxPreferences,
  type FoxToolkitData,
  readFoxPreferences,
  validFoxCommands,
  validFoxImage,
  validFoxToolkit,
} from "@/lib/opening/fox-toolkit";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { bindFoxBubbles } from "./mufy-fox-bubbles";

/** Inert authored markup with finite native actions. No source JS or send hook. */
export function MufyFoxToolkit({
  data: sourceData,
  characterId,
  onReplaceComposer,
  onOpenChange,
}: {
  data: FoxToolkitData;
  characterId: string;
  onReplaceComposer?: (text: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const dataKey = JSON.stringify(sourceData);
  const data = useMemo(() => JSON.parse(dataKey) as FoxToolkitData, [dataKey]);
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const callbacks = useRef({ onReplaceComposer, onOpenChange });
  callbacks.current = { onReplaceComposer, onOpenChange };
  const pendingCaret = useRef<{
      input: HTMLTextAreaElement;
      value: string;
      caret: number;
    } | null>(null),
    [caretRevision, setCaretRevision] = useState(0);
  useLayoutEffect(() => {
    if (caretRevision === 0) return;
    const pending = pendingCaret.current;
    pendingCaret.current = null;
    if (pending?.input.isConnected && pending.input.value === pending.value) {
      pending.input.focus();
      pending.input.setSelectionRange(pending.caret, pending.caret);
    }
  }, [caretRevision]);
  const valid = validFoxToolkit(data);
  const markup = useMemo(
    () => ({
      __html: valid
        ? DOMPurify.sanitize(data.shellHtml, {
            ALLOWED_TAGS: [
              "div",
              "span",
              "button",
              "input",
              "textarea",
              "audio",
              "img",
              "ul",
              "li",
              "svg",
              "path",
              "polyline",
              "line",
            ],
            ALLOWED_ATTR: [
              "id",
              "class",
              "type",
              "accept",
              "title",
              "placeholder",
              "src",
              "alt",
              "data-index",
              "data-target",
              "viewBox",
              "d",
              "fill",
              "stroke",
              "stroke-width",
              "points",
              "preserveAspectRatio",
              "width",
              "height",
            ],
            ALLOW_DATA_ATTR: false,
          })
        : "",
    }),
    [data.shellHtml, valid],
  );
  const css = useMemo(
    () => (valid ? sanitizeAndScopeCss(data.css, "opening").css : ""),
    [data.css, valid],
  );
  useEffect(() => {
    if (host.current)
      setShadow(
        host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" }),
      );
  }, []);
  useEffect(() => {
    const root = shell.current;
    if (!shadow || !root || !valid) return;
    const q = <T extends HTMLElement = HTMLElement>(id: string) =>
      root.querySelector<T>("#" + id);
    const ball = q("fox-floating-ball"),
      panel = q("fox-panel"),
      audio = q<HTMLAudioElement>("fox-audio-element");
    if (!ball || !panel || !audio) return;
    const bindings: [EventTarget, string, EventListener][] = [];
    const listen = (el: EventTarget, event: string, fn: EventListener) => {
      el.addEventListener(event, fn);
      bindings.push([el, event, fn]);
    };
    const button = (el: HTMLElement, label: string) => {
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", label);
    };
    const controls: Record<string, string> = {
      "fox-floating-ball": "打开浮窗",
      "fox-prev": "上一首",
      "fox-play": "播放",
      "fox-next": "下一首",
      "fox-btn-top": "一键回顶",
      "fox-btn-bottom": "一键到底",
      "fox-btn-bg": "上传背景",
      "fox-btn-bg-reset": "恢复背景",
      "fox-form-save": "保存指令",
      "fox-form-cancel": "取消编辑",
      "fox-form-del": "删除指令",
    };
    for (const [id, label] of Object.entries(controls)) {
      const el = q(id);
      if (el) button(el, label);
    }
    for (const selector of [
      ".fx-tab-btn",
      ".fx-npc-item-btn",
      ".fx-close-btn",
      ".fx-avatar-container",
      ".fx-playlist li",
    ])
      for (const el of root.querySelectorAll<HTMLElement>(selector))
        button(
          el,
          el.classList.contains("fx-avatar-container")
            ? el.id === "fox-avatar-box-left"
              ? "更换左侧头像"
              : "更换右侧头像"
            : el.classList.contains("fx-close-btn")
              ? "关闭浮窗"
              : el.textContent?.trim() ||
                el.getAttribute("title") ||
                "播放器控件",
        );
    let destroyed = false,
      track = 0,
      generation = 0,
      pending = false,
      editing = -1;
    const storageKey = `nj_fox_${characterId}_${data.id}_commands`;
    const preferenceKey = `nj_fox_${characterId}_${data.id}_preferences`;
    let preferences = defaultFoxPreferences();
    try {
      preferences = readFoxPreferences(
        window.localStorage.getItem(preferenceKey),
      );
    } catch {
      /* Own preferences may be unavailable. */
    }
    const preferenceStatus = document.createElement("div");
    preferenceStatus.setAttribute("role", "status");
    preferenceStatus.hidden = true;
    panel.append(preferenceStatus);
    const savePreferences = (patch: Partial<FoxPreferences>) => {
      if (destroyed) return;
      preferences = { ...preferences, ...patch };
      try {
        window.localStorage.setItem(preferenceKey, JSON.stringify(preferences));
        preferenceStatus.hidden = true;
        host.current?.setAttribute("data-nj-preference-status", "saved");
      } catch {
        preferenceStatus.textContent =
          "本地保存未成功，当前设置刷新后可能丢失。";
        preferenceStatus.hidden = false;
        host.current?.setAttribute("data-nj-preference-status", "unsaved");
      }
    };
    let commands = data.commands.map((command) => ({ ...command }));
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw && raw.length <= 200000) {
        const stored: unknown = JSON.parse(raw);
        if (validFoxCommands(stored)) commands = stored;
      }
    } catch {
      /* Own scoped preferences only. */
    }
    const persist = () => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(commands));
      } catch {
        /* Keep current in-memory commands. */
      }
    };
    const form = q("fox-prompt-form"),
      commandName = q<HTMLInputElement>("fox-form-cmd"),
      commandText = q<HTMLTextAreaElement>("fox-form-text");
    const setForm = (open: boolean) => {
      form?.classList.toggle("active", open);
      if (form) form.inert = !open;
    };
    const setOpen = (open: boolean) => {
      panel.classList.toggle("active", open);
      panel.inert = !open;
      panel.setAttribute("aria-hidden", String(!open));
      ball.style.opacity = open ? "0" : "1";
      ball.style.pointerEvents = open ? "none" : "auto";
      ball.setAttribute("aria-expanded", String(open));
      callbacks.current.onOpenChange(open);
      if (!open) setForm(false);
    };
    const setPlaying = (playing: boolean) => {
      const play = q("fox-icon-play"),
        pause = q("fox-icon-pause");
      if (play) play.style.display = playing ? "none" : "block";
      if (pause) pause.style.display = playing ? "block" : "none";
      q("fox-play")?.setAttribute(
        "aria-label",
        pending ? "正在加载，点击取消" : playing ? "暂停" : "播放",
      );
      q("fox-play")?.setAttribute("aria-pressed", String(playing));
    };
    const fail = (error?: unknown) => {
      pending = false;
      setPlaying(false);
      savePreferences({ playing: false });
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "NotAllowedError"
      ) {
        host.current?.setAttribute("data-nj-audio-status", "gesture-required");
        q("fox-play")?.setAttribute("aria-label", "点击播放");
        return;
      }
      host.current?.setAttribute("data-nj-audio-status", "unavailable");
      q("fox-play")?.setAttribute("aria-label", "音频无法加载，点击重试");
    };
    const play = async () => {
      const request = ++generation;
      pending = true;
      setPlaying(false);
      try {
        await audio.play();
        if (!destroyed && request === generation) {
          pending = false;
          setPlaying(!audio.paused);
        }
      } catch (error) {
        if (!destroyed && request === generation) fail(error);
      }
    };
    const load = (index: number) => {
      ++generation;
      pending = false;
      audio.pause();
      track = (index + data.tracks.length) % data.tracks.length;
      savePreferences({ track });
      audio.src = data.tracks[track].src;
      host.current?.removeAttribute("data-nj-audio-status");
      if (q("fox-title"))
        q("fox-title")!.textContent = data.tracks[track].title;
      if (q("fox-artist"))
        q("fox-artist")!.textContent = data.tracks[track].artist;
      if (q("fox-time-cur")) q("fox-time-cur")!.textContent = "0:00";
      if (q("fox-progress")) q("fox-progress")!.style.width = "0%";
      root.querySelectorAll(".fx-playlist li").forEach((el, i) => {
        el.classList.toggle("active", i === track);
      });
      setPlaying(false);
    };
    const renderCommands = () => {
      const list = q("fox-prompt-list-container");
      if (!list) return;
      list.replaceChildren();
      commands.forEach((command, index) => {
        const row = document.createElement("div"),
          header = document.createElement("div"),
          name = document.createElement("div"),
          edit = document.createElement("div"),
          text = document.createElement("div");
        row.className = "fx-prompt-item";
        row.dataset.index = String(index);
        header.className = "fx-prompt-header";
        name.className = "fx-prompt-cmd";
        name.textContent = command.cmd;
        edit.className = "fx-prompt-edit-btn";
        edit.textContent = "[修改]";
        edit.dataset.index = String(index);
        button(edit, "修改 " + command.cmd);
        text.className = "fx-prompt-desc";
        text.textContent = command.text;
        header.append(name, edit);
        row.append(header, text);
        button(row, "填入 " + command.cmd);
        list.append(row);
      });
      const add = document.createElement("div");
      add.id = "fox-prompt-add-btn";
      add.className = "fx-prompt-add-btn";
      add.textContent = "+ 添加新指令";
      button(add, "添加新指令");
      list.append(add);
    };
    const showEdit = (index: number) => {
      editing = index;
      if (commandName)
        commandName.value = index < 0 ? "新指令" : commands[index].cmd;
      if (commandText)
        commandText.value = index < 0 ? "" : commands[index].text;
      const del = q("fox-form-del");
      if (del) del.style.display = index < 0 ? "none" : "block";
      setForm(true);
      commandName?.focus();
    };
    const insert = (text: string) => {
      const fill = callbacks.current.onReplaceComposer;
      if (!fill) return;
      const input = document.getElementById("nj_chat_input_textarea");
      if (input instanceof HTMLTextAreaElement) {
        const value = text;
        pendingCaret.current = { input, value, caret: value.length };
        fill(value);
        setCaretRevision((n) => n + 1);
      } else fill(text);
    };
    const changeView = (target: string) => {
      if (!["audio", "npc", "prompt"].includes(target)) return;
      root.querySelectorAll<HTMLElement>(".fx-view").forEach((el) => {
        const active = el.id === "fox-view-" + target;
        el.classList.toggle("active", active);
        el.inert = !active;
      });
      root.querySelectorAll(".fx-tab-btn").forEach((el) => {
        el.classList.toggle(
          "active",
          el.getAttribute("data-target") === target,
        );
      });
      if (q("fox-watermark"))
        q("fox-watermark")!.textContent =
          target === "audio" ? "AURA" : target === "npc" ? "DATA" : "EXEC";
      if (q("fox-vertical-text"))
        q("fox-vertical-text")!.textContent =
          target === "audio"
            ? "SYS.AUDIO // TRACK"
            : target === "npc"
              ? "SYS.ARCHIVE // NPC"
              : "SYS.CMD // OVERRIDE";
    };
    const files = new Set<HTMLInputElement>(),
      objectUrls = new Set<string>();
    const readers = new Set<FileReader>(),
      uploadVersions = new Map<string, number>();
    const backgroundStyle = document.createElement("style");
    backgroundStyle.dataset.njFoxBackground = characterId;
    const applyBackground = (url: string | null) => {
      if (!url) {
        backgroundStyle.remove();
        return;
      }
      backgroundStyle.textContent = `#nj_background_image{background-image:url("${url}")!important;background-size:cover!important;background-position:center!important}`;
      if (!backgroundStyle.isConnected) document.head.append(backgroundStyle);
    };
    preferences.avatars.forEach((image, index) => {
      const avatar = q<HTMLImageElement>(
        index === 0 ? "fox-avatar-img-left" : "fox-avatar-img-right",
      );
      if (image && avatar) avatar.src = image;
    });
    applyBackground(preferences.background);
    const imageUpload = (
      targetKey: string,
      apply: (url: string, persist: boolean) => void,
    ) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp,image/gif";
      input.hidden = true;
      root.append(input);
      files.add(input);
      listen(input, "change", () => {
        const file = input.files?.[0];
        if (
          !file ||
          !/^image\/(png|jpeg|webp|gif)$/.test(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          return;
        const url = URL.createObjectURL(file);
        objectUrls.add(url);
        apply(url, false);
        const version = (uploadVersions.get(targetKey) ?? 0) + 1;
        uploadVersions.set(targetKey, version);
        const reader = new window.FileReader();
        readers.add(reader);
        reader.onload = () => {
          readers.delete(reader);
          if (
            !destroyed &&
            uploadVersions.get(targetKey) === version &&
            validFoxImage(reader.result)
          )
            apply(reader.result, true);
        };
        reader.onerror = () => {
          readers.delete(reader);
        };
        reader.readAsDataURL(file);
        input.remove();
        files.delete(input);
      });
      input.click();
    };
    listen(root, "click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const el = target.closest<HTMLElement>(
        "[id],.fx-tab-btn,.fx-npc-item-btn,.fx-prompt-edit-btn,.fx-prompt-item,.fx-close-btn,.fx-playlist li",
      );
      if (!el) return;
      if (el === ball) {
        setOpen(true);
        return;
      }
      if (el.classList.contains("fx-close-btn")) {
        setOpen(false);
        ball.focus();
        return;
      }
      const tab = target.closest<HTMLElement>(".fx-tab-btn");
      if (tab) {
        changeView(tab.dataset.target ?? "");
        return;
      }
      const npc = target.closest<HTMLElement>(".fx-npc-item-btn");
      if (npc) {
        const person = data.people[Number(npc.dataset.index)];
        if (person) {
          root.querySelectorAll(".fx-npc-item-btn").forEach((e) => {
            e.classList.toggle("active", e === npc);
          });
          for (const [suffix, value] of Object.entries({
            name: person.name,
            role: person.role,
            desc: person.desc,
          })) {
            const node = q(`fox-npc-${suffix}-disp`);
            if (node) node.textContent = value;
          }
        }
        return;
      }
      const edit = target.closest<HTMLElement>(".fx-prompt-edit-btn");
      if (edit) {
        showEdit(Number(edit.dataset.index));
        return;
      }
      if (el.id === "fox-prompt-add-btn") {
        showEdit(-1);
        return;
      }
      if (el.id === "fox-form-cancel") {
        setForm(false);
        return;
      }
      if (el.id === "fox-form-save") {
        const command = {
          cmd: commandName?.value.trim() || "未命名指令",
          text: commandText?.value.trim() || "...",
        };
        const next = commands.map((c) => ({ ...c }));
        if (editing < 0) next.push(command);
        else next[editing] = command;
        if (!validFoxCommands(next)) return;
        commands = next;
        persist();
        renderCommands();
        setForm(false);
        return;
      }
      if (el.id === "fox-form-del") {
        if (editing >= 0) {
          commands.splice(editing, 1);
          persist();
          renderCommands();
          setForm(false);
        }
        return;
      }
      const command = target.closest<HTMLElement>(".fx-prompt-item");
      if (command) {
        const value = commands[Number(command.dataset.index)];
        if (value) {
          insert(value.text);
          setOpen(false);
        }
        return;
      }
      const song = target.closest<HTMLElement>(".fx-playlist li");
      if (song) {
        load(Number(song.dataset.index));
        void play();
        return;
      }
      if (el.id === "fox-play" || target.closest("#fox-play")) {
        if (pending || !audio.paused) {
          ++generation;
          pending = false;
          audio.pause();
          setPlaying(false);
        } else void play();
        return;
      }
      if (el.id === "fox-prev" || target.closest("#fox-prev")) {
        load(track - 1);
        void play();
        return;
      }
      if (el.id === "fox-next" || target.closest("#fox-next")) {
        load(track + 1);
        void play();
        return;
      }
      if (el.id === "fox-btn-top" || target.closest("#fox-btn-top")) {
        document
          .getElementById("nj_chat_messages")
          ?.scrollTo({ top: 0, behavior: "smooth" });
        setOpen(false);
        return;
      }
      if (el.id === "fox-btn-bottom" || target.closest("#fox-btn-bottom")) {
        const chat = document.getElementById("nj_chat_messages");
        chat?.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
        setOpen(false);
        return;
      }
      const avatar = target.closest<HTMLElement>(".fx-avatar-container");
      if (avatar) {
        const img = avatar.querySelector("img");
        const index = avatar.id === "fox-avatar-box-left" ? 0 : 1;
        imageUpload("avatar" + index, (url, persist) => {
          if (img) img.src = url;
          if (persist) {
            const avatars: [string | null, string | null] = [
              ...preferences.avatars,
            ];
            avatars[index] = url;
            savePreferences({ avatars });
          }
        });
        return;
      }
      if (el.id === "fox-btn-bg" || target.closest("#fox-btn-bg")) {
        imageUpload("background", (url, persist) => {
          applyBackground(url);
          if (persist) savePreferences({ background: url });
        });
        return;
      }
      if (el.id === "fox-btn-bg-reset" || target.closest("#fox-btn-bg-reset")) {
        backgroundStyle.remove();
        uploadVersions.set(
          "background",
          (uploadVersions.get("background") ?? 0) + 1,
        );
        savePreferences({ background: null });
        return;
      }
    });
    listen(root, "keydown", (event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === "Escape") {
        setOpen(false);
        ball.focus();
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.getAttribute("role") === "button" &&
        ["Enter", " "].includes(keyEvent.key)
      ) {
        event.preventDefault();
        target.click();
      }
    });
    listen(audio, "playing", () => {
      pending = false;
      setPlaying(true);
      savePreferences({ playing: true });
    });
    listen(audio, "pause", () => {
      setPlaying(false);
      savePreferences({ playing: false });
    });
    listen(audio, "error", fail);
    listen(audio, "ended", () => {
      load(track + 1);
      void play();
    });
    listen(audio, "timeupdate", () => {
      const duration = audio.duration;
      if (Number.isFinite(duration) && duration > 0) {
        if (q("fox-progress"))
          q("fox-progress")!.style.width =
            `${Math.min(100, (100 * audio.currentTime) / duration)}%`;
        if (q("fox-time-cur"))
          q("fox-time-cur")!.textContent =
            `${Math.floor(audio.currentTime / 60)}:${String(Math.floor(audio.currentTime % 60)).padStart(2, "0")}`;
      }
    });
    const progress = q("fox-progress-bg");
    if (progress)
      listen(progress, "click", (event) => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        const rect = progress.getBoundingClientRect();
        if (rect.width > 0)
          audio.currentTime =
            Math.max(
              0,
              Math.min(
                1,
                ((event as MouseEvent).clientX - rect.left) / rect.width,
              ),
            ) * audio.duration;
      });
    let drag: {
        x: number;
        y: number;
        left: number;
        top: number;
        id: number;
      } | null = null,
      moved = false;
    const setPosition = (position: { x: number; y: number }) => {
      const next = clampFoxPosition(
        position,
        window.innerWidth,
        window.innerHeight,
      );
      ball.style.left = `${next.x}px`;
      ball.style.top = `${next.y}px`;
      return next;
    };
    const defaultPosition = () => ({
      x: window.innerWidth - 62,
      y: window.innerHeight - 142,
    });
    setPosition(preferences.position ?? defaultPosition());
    ball.style.right = "auto";
    ball.style.bottom = "auto";
    listen(ball, "pointerdown", (event) => {
      const e = event as PointerEvent,
        rect = ball.getBoundingClientRect();
      drag = {
        x: e.clientX,
        y: e.clientY,
        left: rect.left,
        top: rect.top,
        id: e.pointerId,
      };
      moved = false;
      ball.setPointerCapture?.(e.pointerId);
    });
    listen(ball, "pointermove", (event) => {
      if (!drag) return;
      const e = event as PointerEvent,
        dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      if (moved) {
        ball.style.left = `${Math.max(0, Math.min(window.innerWidth - 42, drag.left + dx))}px`;
        ball.style.top = `${Math.max(0, Math.min(window.innerHeight - 42, drag.top + dy))}px`;
      }
    });
    const endDrag = () => {
      if (drag && moved)
        savePreferences({
          position: setPosition({
            x: parseFloat(ball.style.left),
            y: parseFloat(ball.style.top),
          }),
        });
      drag = null;
    };
    listen(ball, "pointerup", endDrag);
    listen(ball, "pointercancel", endDrag);
    listen(window, "resize", () => {
      // An untouched source ball follows its responsive default. Resizing is
      // not a user drag and must not overwrite the user's chosen anchor.
      setPosition(preferences.position ?? defaultPosition());
    });
    const suppressDragClick = (event: Event) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      }
    };
    ball.addEventListener("click", suppressDragClick);
    bindings.push([ball, "click", suppressDragClick]);
    const stopBubbles = bindFoxBubbles(root, data.emoticons);
    audio.preload = "none";
    renderCommands();
    changeView("audio");
    setForm(false);
    setOpen(false);
    const restorePlaying = preferences.playing;
    load(preferences.track);
    if (restorePlaying) void play();
    return () => {
      destroyed = true;
      ++generation;
      stopBubbles();
      backgroundStyle.remove();
      audio.pause();
      audio.removeAttribute("src");
      for (const [el, event, fn] of bindings) el.removeEventListener(event, fn);
      for (const input of files) input.remove();
      for (const reader of readers) reader.abort();
      preferenceStatus.remove();
      for (const url of objectUrls) URL.revokeObjectURL(url);
      callbacks.current.onOpenChange(false);
    };
  }, [shadow, data, characterId, valid]);
  if (!valid) return null;
  return (
    <div
      ref={host}
      data-nj-fox-toolkit={data.id}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 44 }}
    >
      {shadow &&
        createPortal(
          <div
            data-character-css="opening"
            style={{ fontSize: 16, lineHeight: 1.5 }}
          >
            <style>
              {css +
                `\n*,*::before,*::after{box-sizing:border-box}#fox-floating-ball{position:fixed!important;pointer-events:auto;touch-action:none}#fox-panel{position:fixed!important;pointer-events:none;max-height:calc(100dvh - 32px);overflow:visible}#fox-panel.active{pointer-events:auto}svg{display:block;vertical-align:middle}.fx-view[aria-hidden=true]{display:none}[role=button]:focus-visible{outline:2px solid currentColor;outline-offset:2px}`}
            </style>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Public inert shell is allowlisted by DOMPurify; source scripts and handlers are excluded. */}
            <div ref={shell} dangerouslySetInnerHTML={markup} />
          </div>,
          shadow,
        )}
    </div>
  );
}
