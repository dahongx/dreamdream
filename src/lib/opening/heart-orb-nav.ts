import {
  sanitizeHeartShell,
  heartNativeCss,
  HEART_COORDINATES,
  validAddedHeartTrack,
} from "@/lib/opening/heart-orb-os";
import { HEART_NAV_DEFAULTS } from "./heart-nav-public-defaults";
export {
  sanitizeHeartShell,
  heartNativeCss,
  HEART_COORDINATES,
  validAddedHeartTrack,
};
export interface HeartNavData {
  playlist: { name: string; url: string }[];
  commands: { t: string; d: string }[];
  emojis: { title: string; url: string }[];
}
export interface HeartNavSpec {
  version: 1;
  variant: "heart-orb-nav-v441";
  shellHtml: string;
  css: string;
  documents: [];
  heartNav: HeartNavData;
}
function safe(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return true;
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null)
    return false;
  return Reflect.ownKeys(value).every(
    (k) =>
      typeof k === "string" &&
      !!Object.getOwnPropertyDescriptor(value, k) &&
      !Object.getOwnPropertyDescriptor(value, k)?.get &&
      !Object.getOwnPropertyDescriptor(value, k)?.set &&
      (k === "length" ||
        safe((value as Record<string, unknown>)[k], depth + 1)),
  );
}
const shellKey = (s: string) =>
  sanitizeHeartShell(s).replace(/>\s+</g, "><").trim();
export function validHeartNavShell(html: string): boolean {
  try {
    return shellKey(html) === shellKey(HEART_NAV_DEFAULTS.shellHtml);
  } catch {
    return false;
  }
}
export function validHeartNavSpec(value: unknown): value is HeartNavSpec {
  try {
    if (
      !safe(value) ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    )
      return false;
    const s = value as Partial<HeartNavSpec>;
    return (
      Object.keys(s).sort().join() ===
        "css,documents,heartNav,shellHtml,variant,version" &&
      s.version === 1 &&
      s.variant === "heart-orb-nav-v441" &&
      s.shellHtml === HEART_NAV_DEFAULTS.shellHtml &&
      s.css === HEART_NAV_DEFAULTS.css &&
      Array.isArray(s.documents) &&
      s.documents.length === 0 &&
      Reflect.ownKeys(s.documents).length === 1 &&
      JSON.stringify(s.heartNav) ===
        JSON.stringify(HEART_NAV_DEFAULTS.heartNav) &&
      validHeartNavShell(s.shellHtml)
    );
  } catch {
    return false;
  }
}
export interface HeartNavCallbacks {
  fill?: (text: string) => void;
  open: (value: boolean) => void;
  navigate?: (direction: "top" | "bottom") => void;
}
export function bindHeartNavOrb(
  scope: HTMLElement,
  spec: HeartNavSpec,
  audio: HTMLAudioElement,
  cb: HeartNavCallbacks,
) {
  if (!validHeartNavSpec(spec) || !validHeartNavShell(scope.innerHTML))
    throw Error("INVALID_HEART_CONTRACT");
  const q = <T extends Element = HTMLElement>(id: string) =>
    scope.querySelector<T>("#" + id)!;
  const master = q("cen_heart_master"),
    trigger = q("cen_heart_trigger"),
    toast = q("cen_toast");
  const panels = Array.from(scope.querySelectorAll<HTMLElement>(".cen-panel")),
    orbs = Array.from(scope.querySelectorAll<HTMLElement>(".cen-heart-orb"));
  type Binding = [EventTarget, string, EventListener];
  const events: Binding[] = [],
    playlistEvents: Binding[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined,
    active = true,
    request = 0,
    wants = false,
    pending = false,
    index = 0,
    loop = false,
    expanded = false;
  const tracks = spec.heartNav.playlist.map((t) => ({ ...t }));
  const listen = (
    el: EventTarget,
    event: string,
    fn: EventListener,
    bucket: Binding[] = events,
  ) => {
    el.addEventListener(event, fn);
    bucket.push([el, event, fn]);
  };
  const unbind = (bucket: Binding[]) => {
    for (const [el, event, fn] of bucket.splice(0))
      el.removeEventListener(event, fn);
  };
  const bind = (
    el: HTMLElement | SVGElement,
    fn: () => void,
    label: string,
    bucket: Binding[] = events,
  ) => {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", label);
    listen(el, "click", fn, bucket);
    if (el.tagName !== "BUTTON")
      listen(
        el,
        "keydown",
        (e) => {
          if (["Enter", " "].includes((e as KeyboardEvent).key)) {
            e.preventDefault();
            fn();
          }
        },
        bucket,
      );
  };
  const showToast = (text: string) => {
    if (!active) return;
    clearTimeout(timer);
    toast.textContent = text;
    toast.classList.add("show");
    timer = setTimeout(() => {
      if (active) toast.classList.remove("show");
    }, 1500);
  };
  const closePanels = () => {
    panels.forEach((p) => {
      p.classList.remove("show");
      p.inert = true;
      p.setAttribute("aria-hidden", "true");
    });
    orbs.forEach((o) => {
      o.classList.remove("active");
      o.setAttribute("aria-expanded", "false");
    });
    cb.open(false);
  };
  let wasDrag = false;
  bind(
    trigger,
    () => {
      if (wasDrag) {
        wasDrag = false;
        return;
      }
      expanded = !expanded;
      master.classList.toggle("expanded", expanded);
      trigger.setAttribute("aria-expanded", String(expanded));
      orbs.forEach((o) => (o.inert = !expanded));
      if (!expanded) closePanels();
    },
    "展开心球",
  );
  orbs.forEach((orb) =>
    bind(
      orb,
      () => {
        const already = orb.classList.contains("active");
        closePanels();
        if (!already) {
          const id = orb.getAttribute("data-target"),
            panel = panels.find((p) => p.id === id);
          if (panel) {
            orb.classList.add("active");
            orb.setAttribute("aria-expanded", "true");
            panel.classList.add("show");
            panel.inert = false;
            panel.setAttribute("aria-hidden", "false");
            cb.open(true);
          }
        }
      },
      orb.textContent?.trim() ?? "面板",
    ),
  );
  const doc = scope.ownerDocument;
  listen(doc, "pointerdown", (e) => {
    const path = e.composedPath();
    if (!path.includes(scope)) closePanels();
  });
  const inject = (text: string) => {
    if (cb.fill) {
      cb.fill(text);
      showToast("已注入");
    }
  };
  const fillList = <T>(
    id: string,
    values: T[],
    create: (item: T, index: number) => HTMLElement,
  ) => {
    const list = q(id);
    list.replaceChildren(...values.map(create));
  };
  const element = (className: string, text?: string) => {
    const e = doc.createElement("div");
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  fillList("isc_list", spec.heartNav.commands, (c) => {
    const row = element("isc-item");
    row.append(element("isc-item-title", c.t));
    bind(row, () => inject(c.d), c.t);
    row.setAttribute("aria-disabled", String(!cb.fill));
    return row;
  });
  fillList("img_list", spec.heartNav.emojis, (e) => {
    const row = element("img-item"),
      image = doc.createElement("img");
    image.src = e.url;
    image.title = e.title;
    image.alt = e.title;
    row.append(image);
    bind(row, () => inject(`![${e.title}](${e.url})`), e.title);
    row.setAttribute("aria-disabled", String(!cb.fill));
    return row;
  });
  const navButtons = Array.from(
    scope.querySelectorAll<HTMLElement>("#panel_nav .cen-nav-btn"),
  );
  if (navButtons.length !== 2) throw Error("INVALID_NAV_CONTROLS");
  navButtons.forEach((button, index) => {
    bind(
      button,
      () => cb.navigate?.(index === 0 ? "top" : "bottom"),
      index === 0 ? "强制跃迁至顶端" : "强制坠落至底部",
    );
    button.setAttribute("aria-disabled", String(!cb.navigate));
  });
  const play = q<SVGElement>("msc_play"),
    name = q("cen_msc_name"),
    prog = q("msc_prog_fill"),
    loopBtn = q<SVGElement>("msc_loop");
  const paint = (playing: boolean) => {
    play.replaceChildren();
    if (playing) {
      for (const x of [6, 14]) {
        const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
        for (const [k, v] of Object.entries({
          x: String(x),
          y: "4",
          width: "4",
          height: "16",
        }))
          rect.setAttribute(k, v);
        play.append(rect);
      }
    } else {
      const polygon = doc.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      polygon.setAttribute("points", "5 3 19 12 5 21 5 3");
      play.append(polygon);
    }
    play.setAttribute(
      "aria-label",
      pending ? "取消加载" : playing ? "暂停" : "播放",
    );
    play.setAttribute("aria-busy", String(pending));
  };
  const cancel = () => {
    request++;
    wants = false;
    pending = false;
    audio.pause();
    paint(false);
  };
  const renderList = () => {
    unbind(playlistEvents);
    fillList("msc_list", tracks, (t, i) => {
      const row = element(
        "msc-item" + (i === index ? " playing" : ""),
        `${i + 1}. ${t.name}`,
      );
      bind(row, () => select(i), `播放 ${t.name}`, playlistEvents);
      return row;
    });
  };
  const start = () => {
    const token = ++request;
    wants = true;
    pending = true;
    if (!audio.getAttribute("src")) audio.src = tracks[index].url;
    paint(false);
    try {
      audio
        .play()
        ?.then(() => {
          if (!active || token !== request) return;
          pending = false;
          paint(!audio.paused);
        })
        .catch(() => {
          if (active && token === request) {
            wants = false;
            pending = false;
            paint(false);
            scope.setAttribute("data-heart-audio", "unavailable");
          }
        });
    } catch {
      if (active && token === request) {
        wants = false;
        pending = false;
        paint(false);
        scope.setAttribute("data-heart-audio", "unavailable");
      }
    }
  };
  const select = (next: number) => {
    cancel();
    index = next;
    audio.src = tracks[index].url;
    audio.load();
    name.textContent = tracks[index].name;
    renderList();
    start();
  };
  bind(
    play,
    () => {
      if (wants || !audio.paused) cancel();
      else {
        if (!audio.getAttribute("src")) {
          name.textContent = tracks[index].name;
          renderList();
        }
        start();
      }
    },
    "播放",
  );
  bind(
    q<SVGElement>("msc_prev"),
    () => select((index - 1 + tracks.length) % tracks.length),
    "上一首",
  );
  bind(
    q<SVGElement>("msc_next"),
    () => select((index + 1) % tracks.length),
    "下一首",
  );
  bind(
    loopBtn,
    () => {
      loop = !loop;
      audio.loop = loop;
      loopBtn.style.stroke = loop ? "#FFF" : "#777";
      loopBtn.style.filter = loop ? "drop-shadow(0 0 5px #FFF)" : "none";
      loopBtn.setAttribute("aria-pressed", String(loop));
    },
    "单曲循环",
  );
  listen(audio, "play", () => {
    if (active && wants) {
      pending = false;
      paint(true);
      scope.setAttribute("data-heart-audio", "playing");
    }
  });
  listen(audio, "pause", () => {
    if (!pending) wants = false;
    paint(false);
  });
  listen(audio, "error", () => {
    request++;
    wants = false;
    pending = false;
    paint(false);
    scope.setAttribute("data-heart-audio", "unavailable");
  });
  listen(audio, "ended", () => {
    if (!loop) select((index + 1) % tracks.length);
  });
  listen(audio, "timeupdate", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0)
      prog.style.width =
        Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100)) +
        "%";
  });
  listen(q("msc_prog_bg"), "click", (e) => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = q("msc_prog_bg").getBoundingClientRect();
    if (rect.width > 0)
      audio.currentTime =
        Math.max(
          0,
          Math.min(1, ((e as MouseEvent).clientX - rect.left) / rect.width),
        ) * audio.duration;
  });
  bind(
    q("msc_add_btn"),
    () => {
      const n = q<HTMLInputElement>("msc_input_name"),
        u = q<HTMLInputElement>("msc_input_url");
      if (tracks.length < 50 && validAddedHeartTrack(n.value, u.value)) {
        tracks.push({ name: n.value, url: u.value });
        n.value = "";
        u.value = "";
        renderList();
      }
    },
    "INJECT TRACK",
  );
  let drag: {
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null = null;
  listen(trigger, "pointerdown", (e) => {
    const p = e as PointerEvent;
    if (p.button !== 0) return;
    const r = master.getBoundingClientRect();
    drag = {
      id: p.pointerId,
      x: p.clientX,
      y: p.clientY,
      left: r.left,
      top: r.top,
    };
    wasDrag = false;
    master.style.right = "auto";
    master.style.transform = "none";
    master.style.left = r.left + "px";
    master.style.top = r.top + "px";
    trigger.setPointerCapture?.(p.pointerId);
  });
  listen(trigger, "pointermove", (e) => {
    const p = e as PointerEvent;
    if (!drag || drag.id !== p.pointerId) return;
    const dx = p.clientX - drag.x,
      dy = p.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDrag = true;
    master.style.left = drag.left + dx + "px";
    master.style.top = drag.top + dy + "px";
  });
  for (const event of ["pointerup", "pointercancel"])
    listen(trigger, event, () => {
      drag = null;
    });
  closePanels();
  orbs.forEach((o) => (o.inert = true));
  renderList();
  audio.loop = false;
  paint(false);
  return () => {
    active = false;
    request++;
    clearTimeout(timer);
    unbind(playlistEvents);
    unbind(events);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    cb.open(false);
  };
}
