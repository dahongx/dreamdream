/** Finite public defaults for the observed Chen Chuang floating toolkit. */
export interface FoxToolkitData {
  id: "chenchuang-fox-v1";
  shellHtml: string;
  css: string;
  tracks: { title: string; artist: string; src: string }[];
  people: { name: string; role: string; desc: string }[];
  commands: { cmd: string; text: string }[];
  avatars: string[];
  emoticons: string[];
}
export function validFoxCommands(
  value: unknown,
): value is FoxToolkitData["commands"] {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every(
      (item) =>
        item &&
        typeof item.cmd === "string" &&
        item.cmd.trim().length > 0 &&
        item.cmd.length <= 200 &&
        typeof item.text === "string" &&
        item.text.trim().length > 0 &&
        item.text.length <= 40000,
    ) &&
    JSON.stringify(value).length <= 200000
  );
}
export function validFoxToolkit(value: unknown): value is FoxToolkitData {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<FoxToolkitData>;
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.length > 0 && v.length <= max;
  const url = (v: unknown) => {
    try {
      if (!text(v, 2048)) return false;
      const u = new URL(v as string);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  };
  return (
    d.id === "chenchuang-fox-v1" &&
    text(d.shellHtml, 30000) &&
    text(d.css, 100000) &&
    Array.isArray(d.tracks) &&
    d.tracks.length === 7 &&
    d.tracks.every(
      (t) => t && text(t.title, 200) && text(t.artist, 200) && url(t.src),
    ) &&
    new Set(d.tracks.map((t) => t.src)).size === 7 &&
    Array.isArray(d.people) &&
    d.people.length === 6 &&
    d.people.every(
      (p) => p && text(p.name, 200) && text(p.role, 200) && text(p.desc, 10000),
    ) &&
    validFoxCommands(d.commands) &&
    Array.isArray(d.avatars) &&
    d.avatars.length === 2 &&
    d.avatars.every(url) &&
    Array.isArray(d.emoticons) &&
    d.emoticons.length === 32 &&
    d.emoticons.every((e) => text(e, 100)) &&
    JSON.stringify(d).length <= 400000
  );
}

/** Only this native widget's own preferences, never source-site storage. */
export interface FoxPreferences {
  version: 1;
  track: number;
  playing: boolean;
  position: { x: number; y: number } | null;
  avatars: [string | null, string | null];
  background: string | null;
}
export function validFoxImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 7 * 1024 * 1024 &&
    /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}
export function defaultFoxPreferences(): FoxPreferences {
  return {
    version: 1,
    track: 0,
    playing: false,
    position: null,
    avatars: [null, null],
    background: null,
  };
}
export function readFoxPreferences(raw: string | null): FoxPreferences {
  if (!raw || raw.length > 22 * 1024 * 1024) return defaultFoxPreferences();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return defaultFoxPreferences();
    const p = value as Partial<FoxPreferences>;
    const position = p.position;
    if (
      p.version !== 1 ||
      !Number.isInteger(p.track) ||
      Number(p.track) < 0 ||
      Number(p.track) >= 7 ||
      typeof p.playing !== "boolean" ||
      (position !== null &&
        (!position ||
          typeof position.x !== "number" ||
          typeof position.y !== "number" ||
          !Number.isFinite(position.x) ||
          !Number.isFinite(position.y) ||
          Math.abs(position.x) > 100000 ||
          Math.abs(position.y) > 100000)) ||
      !Array.isArray(p.avatars) ||
      p.avatars.length !== 2 ||
      !p.avatars.every((image) => image === null || validFoxImage(image)) ||
      (p.background !== null && !validFoxImage(p.background))
    )
      return defaultFoxPreferences();
    return {
      version: 1,
      track: Number(p.track),
      playing: p.playing,
      position: position ? { ...position } : null,
      avatars: [p.avatars[0], p.avatars[1]],
      background: p.background,
    };
  } catch {
    return defaultFoxPreferences();
  }
}
export function clampFoxPosition(
  position: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  const clamp = (value: number, bound: number) =>
    Math.max(
      0,
      Math.min(Math.max(0, bound - 42), Number.isFinite(value) ? value : 0),
    );
  return { x: clamp(position.x, width), y: clamp(position.y, height) };
}
