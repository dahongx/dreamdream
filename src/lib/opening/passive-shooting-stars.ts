/** Finite public-source decoration contract; no markup, assets, script or CSS accepted. */
export interface PassiveStar {
  leftPercent: number;
  sizePx: number;
  alpha: number;
  durationSec: number;
  delaySec: number;
}
export interface PassiveStarsSpec {
  version: 1;
  kind: "public-seven-falling-stars";
  id: string;
  stars: PassiveStar[];
}
const exactKeys = (value: object, keys: string[]) =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
export function parsePassiveStars(value: unknown): PassiveStarsSpec | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (
    !exactKeys(s, ["version", "kind", "id", "stars"]) ||
    s.version !== 1 ||
    s.kind !== "public-seven-falling-stars" ||
    typeof s.id !== "string" ||
    !/^[a-z0-9-]{1,64}$/.test(s.id) ||
    !Array.isArray(s.stars) ||
    s.stars.length !== 7
  )
    return null;
  for (const item of s.stars) {
    if (
      !item ||
      typeof item !== "object" ||
      !exactKeys(item, [
        "leftPercent",
        "sizePx",
        "alpha",
        "durationSec",
        "delaySec",
      ])
    )
      return null;
    const p = item as Record<string, unknown>;
    if (
      !Object.values(p).every(
        (v) => typeof v === "number" && Number.isFinite(v),
      )
    )
      return null;
    if (
      !(
        Number(p.leftPercent) >= 0 &&
        Number(p.leftPercent) <= 100 &&
        Number(p.sizePx) >= 1 &&
        Number(p.sizePx) <= 24 &&
        Number(p.alpha) >= 0 &&
        Number(p.alpha) <= 1 &&
        Number(p.durationSec) >= 1 &&
        Number(p.durationSec) <= 60 &&
        Number(p.delaySec) >= 0 &&
        Number(p.delaySec) <= 60
      )
    )
      return null;
  }
  return {
    version: 1,
    kind: "public-seven-falling-stars",
    id: s.id,
    stars: s.stars.map((p) => ({
      leftPercent: p.leftPercent,
      sizePx: p.sizePx,
      alpha: p.alpha,
      durationSec: p.durationSec,
      delaySec: p.delaySec,
    })),
  };
}
export function extractPassiveStars(content: string): {
  rest: string;
  specs: PassiveStarsSpec[];
} {
  const specs: PassiveStarsSpec[] = [];
  let conflict = false;
  const rest = content.replace(
    /<template data-nj-passive-stars-v1>([^<]{1,4096})<\/template>/g,
    (whole: string, json: string) => {
      let spec: PassiveStarsSpec | null = null;
      try {
        spec = parsePassiveStars(JSON.parse(json));
      } catch {
        return whole;
      }
      if (!spec) return whole;
      // Only identical complete contracts can deduplicate. Ambiguous author data
      // must remain entirely unchanged, rather than half-activating one canvas.
      if (specs.length && JSON.stringify(specs[0]) !== JSON.stringify(spec))
        conflict = true;
      if (!specs.length) specs.push(spec);
      return "";
    },
  );
  return conflict ? { rest: content, specs: [] } : { rest, specs };
}
export function encodePassiveStars(spec: PassiveStarsSpec): string {
  const parsed = parsePassiveStars(spec);
  if (!parsed) throw new Error("INVALID_PASSIVE_STARS");
  return `<template data-nj-passive-stars-v1>${JSON.stringify(parsed)}</template>`;
}
