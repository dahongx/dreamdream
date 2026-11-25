/** Finite public MMV2 configuration-centre contract. No source program or source storage. */
import {
  validPrefixPresets,
  type LegacyComposerPrefixSpec,
} from "@/lib/opening/composer-prefix";
import { parse } from "css-tree";
export interface MMV2Preset {
  id: string;
  text: string;
  tag: string;
}
export interface MMV2Track {
  title: string;
  artist: string;
  url: string;
}
export interface MMV2ShareCard {
  title: string;
  subtitle: string;
  text: string;
}
export interface MMV2PrefixSpec extends LegacyComposerPrefixSpec {
  layout: "mmv2-config-centre";
  presets: MMV2Preset[];
  mmv2: { version: 2; tracks: MMV2Track[]; shareCards: MMV2ShareCard[] };
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(value: unknown, max: number, empty = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (empty || !!value.trim())
  );
}
function publicHttps(value: unknown): value is string {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validTaggedPresets(value: unknown): value is MMV2Preset[] {
  return (
    validPrefixPresets(value) &&
    value.every(
      (item) =>
        record(item) &&
        keys(item, ["id", "text", "tag"]) &&
        text(item.tag, 128),
    )
  );
}
/** No unknown layout fallback. Invalid data must remain original content. */
export function parseMMV2PrefixSpec(value: unknown): MMV2PrefixSpec | null {
  if (
    !record(value) ||
    !keys(value, [
      "version",
      "id",
      "css",
      "presets",
      "fontFace",
      "layout",
      "mmv2",
    ]) ||
    value.version !== 1 ||
    value.layout !== "mmv2-config-centre" ||
    !text(value.id, 128) ||
    !/^[-\w]+$/.test(value.id) ||
    !text(value.css, 200000) ||
    !value.css.includes(".mufy-bw-panel-cls") ||
    !value.css.includes(".mufy-trigger-bw-cls") ||
    !validTaggedPresets(value.presets)
  )
    return null;
  const config = value.mmv2;
  if (
    !record(config) ||
    !keys(config, ["version", "tracks", "shareCards"]) ||
    config.version !== 2 ||
    !Array.isArray(config.tracks) ||
    config.tracks.length !== 4 ||
    !Array.isArray(config.shareCards) ||
    config.shareCards.length !== 2
  )
    return null;
  if (
    !config.tracks.every(
      (item) =>
        record(item) &&
        keys(item, ["title", "artist", "url"]) &&
        text(item.title, 512) &&
        text(item.artist, 512, true) &&
        publicHttps(item.url),
    )
  )
    return null;
  if (
    !config.shareCards.every(
      (item) =>
        record(item) &&
        keys(item, ["title", "subtitle", "text"]) &&
        text(item.title, 512) &&
        text(item.subtitle, 1024, true) &&
        text(item.text, 40000),
    )
  )
    return null;
  if (
    value.fontFace !== undefined &&
    (!record(value.fontFace) ||
      !keys(value.fontFace, ["family", "url"]) ||
      !text(value.fontFace.family, 160) ||
      !/^nj_prefix_[\w-]{1,128}$/.test(value.fontFace.family) ||
      !publicHttps(value.fontFace.url))
  )
    return null;
  try {
    let bad = false;
    const options = {
      context: "stylesheet" as const,
      onParseError() {
        bad = true;
      },
    };
    parse(value.css, options);
    if (bad) return null;
  } catch {
    return null;
  }
  // CSS syntax validation is not a replacement for mounted scoped sanitation.
  // No author HTML, program, global hook or source storage is accepted here.
  return {
    version: 1,
    id: value.id,
    layout: "mmv2-config-centre",
    css: value.css,
    presets: value.presets.map((item) => ({
      id: item.id,
      text: item.text,
      tag: item.tag,
    })),
    ...(value.fontFace === undefined
      ? {}
      : {
          fontFace: {
            family: value.fontFace.family as string,
            url: value.fontFace.url as string,
          },
        }),
    mmv2: {
      version: 2,
      tracks: config.tracks.map((item) => {
        const track = item as MMV2Track;
        return { title: track.title, artist: track.artist, url: track.url };
      }),
      shareCards: config.shareCards.map((item) => {
        const card = item as MMV2ShareCard;
        return { title: card.title, subtitle: card.subtitle, text: card.text };
      }),
    },
  };
}

import postcss from "postcss";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import type { ComposerPrefixSelection } from "@/lib/opening/composer-prefix";
export interface MMV2Selection extends ComposerPrefixSelection {
  presets: MMV2Preset[];
}
export function restoreMMV2(
  raw: string | null,
  spec: MMV2PrefixSpec,
): MMV2Selection {
  const fallback: MMV2Selection = {
    presets: spec.presets.map((p) => ({ ...p })),
    activeIds: [],
    mode: "before",
  };
  if (!raw) return fallback;
  try {
    const s: unknown = JSON.parse(raw);
    if (
      !s ||
      typeof s !== "object" ||
      !("presets" in s) ||
      !("activeIds" in s) ||
      !("mode" in s) ||
      !validTaggedPresets(s.presets) ||
      !Array.isArray(s.activeIds) ||
      s.activeIds.length > 50 ||
      !s.activeIds.every((id: unknown) => typeof id === "string") ||
      (s.mode !== "before" && s.mode !== "after")
    )
      return fallback;
    const ids = new Set(s.presets.map((p) => p.id));
    return {
      presets: s.presets,
      activeIds: [...new Set<string>(s.activeIds)].filter((id) => ids.has(id)),
      mode: s.mode,
    };
  } catch {
    return fallback;
  }
}
export type MMV2Action =
  | { type: "toggle"; id: string }
  | { type: "clear" }
  | { type: "mode" }
  | { type: "delete"; id: string }
  | { type: "save"; id: string; text: string; tag: string; add?: boolean };
export function reduceMMV2(s: MMV2Selection, a: MMV2Action): MMV2Selection {
  if (a.type === "clear") return { ...s, activeIds: [] };
  if (a.type === "mode")
    return { ...s, mode: s.mode === "before" ? "after" : "before" };
  if (a.type === "toggle")
    return s.presets.some((p) => p.id === a.id)
      ? {
          ...s,
          activeIds: s.activeIds.includes(a.id)
            ? s.activeIds.filter((id) => id !== a.id)
            : [...s.activeIds, a.id],
        }
      : s;
  if (a.type === "delete")
    return {
      ...s,
      presets: s.presets.filter((p) => p.id !== a.id),
      activeIds: s.activeIds.filter((id) => id !== a.id),
    };
  const text = a.text.trim(),
    tag = a.tag.trim() || "通用";
  if (!text) return s;
  const existing = s.presets.some((p) => p.id === a.id);
  if (a.add === existing) return s;
  const presets = a.add
    ? [...s.presets, { id: a.id, text, tag }]
    : s.presets.map((p) => (p.id === a.id ? { ...p, text, tag } : p));
  return validTaggedPresets(presets) ? { ...s, presets } : s;
}
export function mmv2Tags(s: MMV2Selection) {
  return ["全部", ...new Set(s.presets.map((p) => p.tag))];
}
export const mmv2Filtered = (s: MMV2Selection, tag: string) =>
  s.presets.filter((p) => tag === "全部" || p.tag === tag);
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export function mmv2Position(
  width: number,
  height: number,
  x = width - 70,
  y = height - 138,
) {
  return {
    left: clamp(x, 14, Math.max(14, width - 60)),
    top: clamp(y, 14, Math.max(14, height - 60)),
  };
}
export function mmv2PanelPosition(
  width: number,
  height: number,
  trigger: { left: number; top: number },
  panelWidth = 320,
  panelHeight = 420,
) {
  return {
    left: clamp(
      trigger.left - panelWidth - 12,
      14,
      Math.max(14, width - panelWidth - 14),
    ),
    top: clamp(
      trigger.top - panelHeight - 12,
      14,
      Math.max(14, height - panelHeight - 14),
    ),
  };
}
/** Source paint stays scoped. Trusted React coordinates supply only removed fixed/z policy. */
export function mmv2NativeCss(spec: MMV2PrefixSpec) {
  const sheet = postcss.parse(spec.css);
  const fonts: { family: string; url: string }[] = [];
  sheet.walkAtRules("font-face", (rule) => {
    let family = "",
      url = "";
    rule.walkDecls((d) => {
      if (d.prop === "font-family")
        family = d.value.replace(/^['"]|['"]$/g, "");
      if (d.prop === "src") {
        const m = /^url\(\s*['"]?(https:\/\/[^)'"\s]+)['"]?\s*\)$/.exec(
          d.value,
        );
        if (m) url = m[1];
      }
    });
    if (family && url && !fonts.length) {
      const u = new URL(url);
      if (!u.username && !u.password) {
        const nativeFamily = `nj_prefix_${spec.id}_mmv2`;
        fonts.push({ family: nativeFamily, url });
        sheet.walkDecls("font-family", (d) => {
          d.value = d.value.replaceAll(family, nativeFamily);
        });
      }
    }
    rule.remove();
  });
  const font = fonts[0] ?? null;
  sheet.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name))
      return;
    rule.walkDecls((d) => {
      if (
        (d.prop === "position" && d.value === "fixed") ||
        d.prop === "z-index" ||
        d.prop === "pointer-events"
      )
        d.remove();
    });
    rule.selectors = rule.selectors.map(
      (selector) => `.nj_mmv2_scope ${selector}`,
    );
  });
  const safe = sanitizeAndScopeCss(sheet.toString(), "opening");
  const complete = [
    ".mufy-bw-panel-cls",
    ".mufy-trigger-bw-cls",
    ".mmv2-tabs",
    ".bw-list",
    ".netease-music-box",
    ".share-card-item",
  ].every((selector) => safe.css.includes(selector));
  return { ...safe, font, complete };
}
export interface MMV2AudioState {
  index: number;
  playing: boolean;
  pending: boolean;
  single: boolean;
  current: number;
  duration: number;
  error: boolean;
}
export interface MMV2AudioControls {
  toggle(): void;
  next(): void;
  select(index: number): void;
  loop(): void;
  seek(ratio: number): void;
  dispose(): void;
}
/** One stable audio element, no tab/remount reset, all events and late promises bounded. */
export function bindMMV2Audio(
  audio: HTMLAudioElement,
  tracks: MMV2Track[],
  notify: (s: MMV2AudioState) => void,
): MMV2AudioControls {
  let active = true,
    wants = false,
    request = 0;
  let state: MMV2AudioState = {
    index: 0,
    playing: false,
    pending: false,
    single: false,
    current: 0,
    duration: 0,
    error: false,
  };
  const events: [string, EventListener][] = [];
  const update = (patch: Partial<MMV2AudioState>) => {
    state = { ...state, ...patch };
    if (active) notify({ ...state });
  };
  const listen = (event: string, fn: () => void) => {
    audio.addEventListener(event, fn);
    events.push([event, fn]);
  };
  const cancel = () => {
    wants = false;
    request++;
    audio.pause();
    update({ playing: false, pending: false });
  };
  const play = () => {
    if (!active) return;
    wants = true;
    const token = ++request;
    update({ pending: true, error: false });
    try {
      const pending = audio.play();
      pending
        ?.then(() => {
          if (!active || !wants) {
            audio.pause();
            return;
          }
          if (token === request)
            update({ pending: false, playing: !audio.paused });
        })
        .catch(() => {
          if (active && token === request) {
            wants = false;
            audio.pause();
            update({ playing: false, pending: false, error: true });
          }
        });
    } catch {
      if (active && token === request) {
        wants = false;
        audio.pause();
        update({ playing: false, pending: false, error: true });
      }
    }
  };
  const select = (index: number) => {
    if (
      !active ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= tracks.length
    )
      return;
    cancel();
    audio.src = tracks[index].url;
    audio.loop = state.single;
    update({ index, current: 0, duration: 0, error: false });
    play();
  };
  const next = () => select((state.index + 1) % tracks.length);
  audio.src = tracks[0].url;
  audio.loop = false;
  listen("play", () => {
    if (!wants) {
      audio.pause();
      return;
    }
    update({ playing: true, pending: false });
  });
  listen("pause", () => update({ playing: false }));
  listen("loadedmetadata", () =>
    update({
      duration:
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0,
    }),
  );
  listen("timeupdate", () =>
    update({
      current: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration:
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0,
    }),
  );
  listen("error", () => {
    wants = false;
    request++;
    audio.pause();
    update({ error: true, playing: false, pending: false });
  });
  listen("ended", () => {
    if (!state.single) next();
  });
  notify({ ...state });
  return {
    toggle() {
      if (!active) return;
      if (state.playing || state.pending) cancel();
      else play();
    },
    next,
    select,
    loop() {
      if (!active) return;
      audio.loop = !state.single;
      update({ single: audio.loop });
    },
    seek(ratio) {
      if (
        active &&
        Number.isFinite(ratio) &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      )
        audio.currentTime = clamp(ratio, 0, 1) * audio.duration;
    },
    dispose() {
      if (!active) return;
      active = false;
      wants = false;
      request++;
      for (const [e, fn] of events) audio.removeEventListener(e, fn);
      events.length = 0;
      audio.pause();
      audio.removeAttribute("src");
      try {
        audio.load();
      } catch {}
    },
  };
}
