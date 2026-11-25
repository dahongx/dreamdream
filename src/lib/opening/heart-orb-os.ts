import DOMPurify from "isomorphic-dompurify";
import postcss from "postcss";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { HEART_PUBLIC_DEFAULTS } from "./heart-orb-public-defaults";

export interface HeartOrbData {
  playlist: { name: string; url: string }[];
  commands: { t: string; d: string }[];
  emojis: { title: string; url: string }[];
  singleAvatars: string[];
  coupleAvatars: string[];
}
export interface HeartOrbSpec {
  version: 1;
  variant: "heart-orb-os-v42";
  shellHtml: string;
  css: string;
  documents: [];
  heartOrb: HeartOrbData;
}
export function sanitizeHeartShell(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "div",
      "span",
      "svg",
      "path",
      "polygon",
      "polyline",
      "line",
      "rect",
      "circle",
      "img",
      "input",
      "button",
    ],
    ALLOWED_ATTR: [
      "id",
      "class",
      "data-target",
      "src",
      "alt",
      "type",
      "placeholder",
      "viewBox",
      "d",
      "points",
      "x",
      "y",
      "x1",
      "x2",
      "y1",
      "y2",
      "width",
      "height",
      "r",
      "cx",
      "cy",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
const shellKey = (html: string) =>
  sanitizeHeartShell(html).replace(/>\s+</g, "><").trim();
const knownShellKey = shellKey(HEART_PUBLIC_DEFAULTS.shellHtml),
  knownDataKey = JSON.stringify(HEART_PUBLIC_DEFAULTS.heartOrb);
export function validHeartShell(html: string): boolean {
  try {
    return shellKey(html) === knownShellKey;
  } catch {
    return false;
  }
}
export function validHeartOrbSpec(value: unknown): value is HeartOrbSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Partial<HeartOrbSpec>;
  if (
    Object.keys(s).sort().join() !==
      "css,documents,heartOrb,shellHtml,variant,version" ||
    s.version !== 1 ||
    s.variant !== "heart-orb-os-v42" ||
    typeof s.shellHtml !== "string" ||
    s.shellHtml.length > 30000 ||
    typeof s.css !== "string" ||
    s.css.length > 30000 ||
    !Array.isArray(s.documents) ||
    s.documents.length !== 0
  )
    return false;
  if (!s.heartOrb || JSON.stringify(s.heartOrb) !== knownDataKey) return false;
  if (
    /<(?:script|iframe|object|embed)\b|\bon\w+\s*=|window\.parent/i.test(
      s.shellHtml,
    ) ||
    !validHeartShell(s.shellHtml)
  )
    return false;
  try {
    postcss.parse(s.css);
    return true;
  } catch {
    return false;
  }
}
export const HEART_COORDINATES = `
[data-character-css=opening]{pointer-events:none}
#cen_heart_master{position:fixed!important;top:50%;right:20px;transform:translateY(-50%);z-index:2;pointer-events:none}
.cen-panels-wrapper{position:fixed!important;top:0;left:0;width:0;height:0;pointer-events:none;z-index:1}
.cen-panel{position:fixed!important;pointer-events:none}.cen-panel.show{pointer-events:auto}
.cen-main-trigger{pointer-events:auto;touch-action:none}.cen-main-trigger img,.img-item img{pointer-events:none}
.cen-sub-orbs-box{pointer-events:none}#cen_heart_master.expanded .cen-sub-orbs-box{pointer-events:auto}
`;
export function heartNativeCss(css: string) {
  try {
    const ast = postcss.parse(css);
    ast.walkDecls((d) => {
      if (
        d.prop === "pointer-events" ||
        (d.prop === "position" && d.value === "fixed") ||
        (d.prop === "z-index" && Number(d.value) > 100)
      )
        d.remove();
    });
    return sanitizeAndScopeCss(ast.toString(), "opening");
  } catch {
    return { css: "", warnings: ["INVALID_HEART_CSS"] };
  }
}
export interface HeartCallbacks {
  fill?: (text: string) => void;
  copy: (url: string) => Promise<boolean>;
  open: (value: boolean) => void;
}
export function validAddedHeartTrack(name: string, url: string): boolean {
  try {
    const u = new URL(url);
    return (
      !!name &&
      name.length <= 200 &&
      url.length <= 2048 &&
      ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
/** Own native actions only; no evaluated source program, parent access or send hook. */
export function bindHeartOrb(
  scope: HTMLElement,
  spec: HeartOrbSpec,
  audio: HTMLAudioElement,
  cb: HeartCallbacks,
) {
  if (!validHeartOrbSpec(spec) || !validHeartShell(scope.innerHTML))
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
  const tracks = spec.heartOrb.playlist.map((t) => ({ ...t }));
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
      showToast("指令/表情 已注入");
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
  fillList("isc_list", spec.heartOrb.commands, (c) => {
    const row = element("isc-item");
    row.append(element("isc-item-title", c.t));
    bind(row, () => inject(c.d), c.t);
    row.setAttribute("aria-disabled", String(!cb.fill));
    return row;
  });
  fillList("img_list", spec.heartOrb.emojis, (e) => {
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
  const gallery = q("avt_list");
  gallery.replaceChildren();
  for (const [title, urls] of [
    ["- ✧ 单人头像 ✧ -", spec.heartOrb.singleAvatars],
    ["- ♡ 情侣头像 ♡ -", spec.heartOrb.coupleAvatars],
  ] as const) {
    const heading = element("avt-section-title", title);
    if (title.includes("单人")) heading.style.marginTop = "0";
    gallery.append(heading);
    for (const url of urls) {
      const row = element("img-item"),
        image = doc.createElement("img");
      image.src = url;
      image.alt = "头像";
      row.append(image);
      bind(
        row,
        () => {
          void cb
            .copy(url)
            .then((ok) => {
              if (active) showToast(ok ? "复制链接成功" : "复制未完成");
            })
            .catch(() => {
              if (active) showToast("复制未完成");
            });
        },
        "复制头像链接",
      );
      gallery.append(row);
    }
  }
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
      loopBtn.style.stroke = loop ? "#FF007F" : "#FFF";
      loopBtn.style.filter = loop ? "drop-shadow(0 0 5px #FF007F)" : "none";
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
