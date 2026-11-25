import DOMPurify from "isomorphic-dompurify";
import postcss from "postcss";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

export function sanitizeNativeGhostShell(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["div", "span", "button", "audio"],
    ALLOWED_ATTR: ["id", "class", "loop", "type"],
    ALLOW_DATA_ATTR: false,
  });
}

// Canonical public shell, not executable captured code. Populated from the
// reviewed source artifact; whitespace between elements is insignificant.
const KNOWN_GHOST_SHELL =
  '<div id="C_GhostTrigger_Box"></div><div id="C_GhostPlayer_Panel"><div class="c-player-header"><div class="c-player-title">留声·秘档</div><button class="c-player-ctrl-btn c_state_pause" id="C_Ghost_PlayBtn"></button></div><div class="c-track-list"><div class="c-track-item c_active_track">天下</div><div class="c-track-item">山河令</div><div class="c-track-item">拂世之剑</div></div><div class="c-wave-container" id="C_Ghost_Wave"><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div><div class="c-wave-bar"></div></div><audio id="C_Ghost_AudioEngine" loop=""></audio></div>';
const normalizedShell = (html: string) =>
  sanitizeNativeGhostShell(html).replace(/>\s+</g, "><").trim();
export function validKnownGhostShell(html: string): boolean {
  try {
    return normalizedShell(html) === KNOWN_GHOST_SHELL;
  } catch {
    return false;
  }
}
const validGhostCss = (css: string): boolean => {
  try {
    postcss.parse(css);
    return true;
  } catch {
    return false;
  }
};

export interface KnownGhostNativeSpec {
  version: 1;
  variant: "censy-ghost-music-v4";
  shellHtml: string;
  css: string;
  documents: [];
  ghostMusic: {
    id: "censy-ghost-music-v4";
    tracks: { title: string; src: string }[];
  };
}
export const EXACT_TRACKS = [
  {
    title: "天下",
    src: "http://dlink.host/1drv/aHR0cHM6Ly8xZHJ2Lm1zL3UvYy84ZDBmY2RjOWQ4ZWRmN2FiL0VSRldITkFkVTVGR2dUQWdpLWE1MlVvQjZRYWJFbXRnSG56THhKZkhjdVpDMGc_ZT12VHlHaVI.mp3",
  },
  {
    title: "山河令",
    src: "http://music.163.com/song/media/outer/url?id=1303042675.mp3",
  },
  {
    title: "拂世之剑",
    src: "http://music.163.com/song/media/outer/url?id=30064893.mp3",
  },
] as const;
/** Native opt-in is finite: no broad HTTP allowance or arbitrary author code. */
export function validKnownGhostNativeSpec(
  value: unknown,
): value is KnownGhostNativeSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Partial<KnownGhostNativeSpec>;
  if (
    Object.keys(s).sort().join() !==
    "css,documents,ghostMusic,shellHtml,variant,version"
  )
    return false;
  if (
    s.version !== 1 ||
    s.variant !== "censy-ghost-music-v4" ||
    typeof s.shellHtml !== "string" ||
    s.shellHtml.length > 30000 ||
    typeof s.css !== "string" ||
    s.css.length > 30000 ||
    !Array.isArray(s.documents) ||
    s.documents.length !== 0
  )
    return false;
  if (
    !s.ghostMusic ||
    Object.keys(s.ghostMusic).sort().join() !== "id,tracks" ||
    s.ghostMusic.id !== "censy-ghost-music-v4" ||
    JSON.stringify(s.ghostMusic.tracks) !== JSON.stringify(EXACT_TRACKS)
  )
    return false;
  return (
    !/<(?:script|iframe|object|embed)\b|\bon\w+\s*=|window\.parent/i.test(
      s.shellHtml,
    ) &&
    validKnownGhostShell(s.shellHtml) &&
    validGhostCss(s.css)
  );
}

/** Exactly observed roots only; native same-document hit testing passes blank areas. */
export const NATIVE_GHOST_COORDINATES = `
[data-character-css="opening"]{pointer-events:none}
[data-character-css="opening"] #C_GhostTrigger_Box,[data-character-css="opening"] #C_GhostPlayer_Panel{box-sizing:border-box;pointer-events:auto}
[data-character-css="opening"] #C_GhostTrigger_Box{position:fixed;z-index:2}
[data-character-css="opening"] #C_GhostPlayer_Panel{position:fixed;z-index:1}
`;
export function nativeGhostCss(spec: KnownGhostNativeSpec) {
  const transferredCoordinates: {
    selector: string;
    property: string;
    value: string;
  }[] = [];
  if (!validGhostCss(spec.css))
    return { css: "", warnings: ["INVALID_GHOST_CSS"], transferredCoordinates };
  const source = postcss.parse(spec.css);
  source.walkRules((rule) => {
    if (
      rule.selector !== "#C_GhostTrigger_Box" &&
      rule.selector !== "#C_GhostPlayer_Panel"
    )
      return;
    rule.walkDecls((decl) => {
      if (
        (decl.prop === "position" && decl.value === "fixed") ||
        decl.prop === "z-index"
      ) {
        transferredCoordinates.push({
          selector: rule.selector,
          property: decl.prop,
          value: decl.value,
        });
        decl.remove();
      }
    });
  });
  // The trusted native component, not arbitrary author CSS, owns fixed geometry.
  return {
    ...sanitizeAndScopeCss(source.toString(), "opening"),
    transferredCoordinates,
  };
}

/** Native behavior only. No captured program, host read, storage or new controls. */
export function bindNativeGhostMusic(
  scope: HTMLElement,
  spec: KnownGhostNativeSpec,
  onOpenChange: (open: boolean) => void,
) {
  if (!validKnownGhostNativeSpec(spec))
    throw Error("INVALID_NATIVE_GHOST_SPEC");
  // Recheck the actual mounted/sanitized DOM, not merely the metadata string.
  if (!validKnownGhostShell(scope.innerHTML))
    throw Error("EXACT_FIVE_CONTROLS_REQUIRED");
  const trigger = scope.querySelector<HTMLElement>("#C_GhostTrigger_Box"),
    panel = scope.querySelector<HTMLElement>("#C_GhostPlayer_Panel"),
    audio = scope.querySelector<HTMLAudioElement>("#C_Ghost_AudioEngine"),
    play = scope.querySelector<HTMLButtonElement>("#C_Ghost_PlayBtn"),
    wave = scope.querySelector<HTMLElement>("#C_Ghost_Wave"),
    tracks = Array.from(scope.querySelectorAll<HTMLElement>(".c-track-item"));
  if (!trigger || !panel || !audio || !play || !wave || tracks.length !== 3)
    throw Error("EXACT_FIVE_CONTROLS_REQUIRED");
  let index = 0,
    open = false,
    active = true,
    wants = false,
    pending = false,
    request = 0;
  const bindings: [EventTarget, string, EventListener][] = [];
  const listen = (el: EventTarget, event: string, fn: EventListener) => {
    el.addEventListener(event, fn);
    bindings.push([el, event, fn]);
  };
  const renderAudio = (playing: boolean) => {
    play.classList.toggle("c_state_play", playing);
    play.classList.toggle("c_state_pause", !playing);
    wave.classList.toggle("c_is_playing", playing);
    play.setAttribute(
      "aria-label",
      pending ? "取消加载" : playing ? "暂停" : "播放",
    );
    play.setAttribute("aria-busy", String(pending));
  };
  const cancel = () => {
    wants = false;
    pending = false;
    request++;
    audio.pause();
    renderAudio(false);
  };
  const fail = () => {
    wants = false;
    pending = false;
    renderAudio(false);
    scope.setAttribute("data-nj-audio-status", "unavailable");
  };
  const start = () => {
    const token = ++request;
    wants = true;
    pending = true;
    renderAudio(false);
    if (!audio.getAttribute("src"))
      audio.setAttribute("src", spec.ghostMusic.tracks[index].src);
    try {
      audio
        .play()
        ?.then(() => {
          if (!active || token !== request) return;
          pending = false;
          renderAudio(!audio.paused);
        })
        .catch(() => {
          if (active && token === request) fail();
        });
    } catch {
      if (active && token === request) fail();
    }
  };
  const setOpen = (value: boolean) => {
    open = value;
    panel.classList.toggle("c_panel_open", open);
    panel.inert = !open;
    panel.setAttribute("aria-hidden", String(!open));
    trigger.setAttribute("aria-expanded", String(open));
    onOpenChange(open);
  };
  const select = (next: number) => {
    cancel();
    index = next;
    tracks.forEach((e, i) => e.classList.toggle("c_active_track", i === index));
    audio.setAttribute("src", spec.ghostMusic.tracks[index].src);
    audio.load();
    start();
  };
  const bind = (el: HTMLElement, fn: () => void, label: string) => {
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", label);
    el.tabIndex = 0;
    listen(el, "click", () => fn());
    if (el.tagName !== "BUTTON")
      listen(el, "keydown", (event) => {
        const e = event as KeyboardEvent;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fn();
        }
      });
  };
  bind(trigger, () => setOpen(!open), "留声·秘档");
  bind(play, () => (wants || !audio.paused ? cancel() : start()), "播放");
  tracks.forEach((e, i) =>
    bind(e, () => select(i), spec.ghostMusic.tracks[i].title),
  );
  listen(audio, "play", () => {
    if (!active || !wants) return;
    pending = false;
    renderAudio(true);
    scope.setAttribute("data-nj-audio-status", "playing");
  });
  listen(audio, "pause", () => {
    if (!pending) wants = false;
    renderAudio(false);
  });
  listen(audio, "error", () => {
    request++;
    fail();
  });
  audio.loop = true;
  renderAudio(false);
  setOpen(false);
  return () => {
    active = false;
    request++;
    for (const [el, event, fn] of bindings) el.removeEventListener(event, fn);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    onOpenChange(false);
  };
}
