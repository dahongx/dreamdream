import { parseMMV2PrefixSpec, type MMV2PrefixSpec } from "./mmv2-prefix";
/** Declarative public UI data only. No author program or source storage. */
export interface ComposerPrefixPreset {
  id: string;
  text: string;
}
export interface LegacyComposerPrefixSpec {
  version: 1;
  id: string;
  css: string;
  presets: ComposerPrefixPreset[];
  fontFace?: { family: string; url: string };
}
export type ComposerPrefixSpec = LegacyComposerPrefixSpec | MMV2PrefixSpec;
export interface ComposerPrefixSelection {
  presets: ComposerPrefixPreset[];
  activeIds: string[];
  mode: "before" | "after";
}
export interface ScopedPrefixSelection {
  scope: string;
  value: ComposerPrefixSelection | null;
}
export function applyScopedComposerPrefix(
  text: string,
  selection: ScopedPrefixSelection | null,
  scope: string,
): string {
  return applyComposerPrefix(
    text,
    selection?.scope === scope ? selection.value : null,
  );
}
export interface DeletedPrefixPreset {
  preset: ComposerPrefixPreset;
  index: number;
  wasActive: boolean;
}
export function restoreDeletedPrefix(
  selection: ComposerPrefixSelection,
  deleted: DeletedPrefixPreset,
): ComposerPrefixSelection {
  if (selection.presets.some((p) => p.id === deleted.preset.id))
    return selection;
  const presets = [...selection.presets];
  presets.splice(Math.min(deleted.index, presets.length), 0, deleted.preset);
  if (!validPrefixPresets(presets)) return selection;
  return {
    ...selection,
    presets,
    activeIds: deleted.wasActive
      ? [...new Set([...selection.activeIds, deleted.preset.id])]
      : selection.activeIds,
  };
}
const ENVELOPE = /<template data-nj-composer-prefix-v1>([\s\S]*?)<\/template>/g;
export function composerPrefixEnvelope(spec: ComposerPrefixSpec): string {
  return `<template data-nj-composer-prefix-v1>${JSON.stringify(spec).replace(/</g, "\\u003c")}</template>`;
}
export function validPrefixPresets(
  value: unknown,
): value is ComposerPrefixPreset[] {
  if (!Array.isArray(value) || value.length > 50) return false;
  let total = 0;
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !/^[-\w]{1,128}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > 40000
    )
      return false;
    ids.add(item.id);
    total += item.text.length;
  }
  return total <= 200000;
}
export function extractComposerPrefixes(content: string): {
  rest: string;
  specs: ComposerPrefixSpec[];
} {
  const specs: ComposerPrefixSpec[] = [];
  const rest = content.replace(
    new RegExp(ENVELOPE.source, "g"),
    (raw, json: string) => {
      if (json.length > 500000) return raw;
      try {
        const s = JSON.parse(json);
        if (s && typeof s === "object" && ("layout" in s || "mmv2" in s)) {
          const native = parseMMV2PrefixSpec(s);
          if (!native) return raw;
          specs.push(native);
          return "";
        }
        if (
          s?.version !== 1 ||
          typeof s.id !== "string" ||
          !/^[-\w]{1,128}$/.test(s.id) ||
          typeof s.css !== "string" ||
          s.css.length > 200000 ||
          !s.css.includes("#mufy-bw-panel") ||
          !validPrefixPresets(s.presets)
        )
          return raw;
        if (
          s.fontFace &&
          (!/^nj_prefix_[\w-]{1,128}$/.test(s.fontFace.family) ||
            typeof s.fontFace.url !== "string" ||
            s.fontFace.url.length > 2048 ||
            new URL(s.fontFace.url).protocol !== "https:")
        )
          return raw;
        specs.push({
          version: 1,
          id: s.id,
          css: s.css,
          presets: s.presets,
          ...(s.fontFace ? { fontFace: s.fontFace } : {}),
        });
        return "";
      } catch {
        return raw;
      }
    },
  );
  if (specs.some(s => "layout" in s)) {
    const first = JSON.stringify(specs[0]);
    if (specs.some(s => JSON.stringify(s) !== first)) return { rest: content, specs: [] };
    return { rest, specs: specs.length ? [specs[0]] : [] };
  }
  return { rest, specs };
}
export function readPrefixSelection(
  raw: string | null,
  spec: ComposerPrefixSpec,
): ComposerPrefixSelection {
  const fallback: ComposerPrefixSelection = {
    presets: spec.presets.map((p) => ({ ...p })),
    activeIds: [],
    mode: "before",
  };
  if (!raw) return fallback;
  try {
    const s = JSON.parse(raw);
    if (
      !validPrefixPresets(s?.presets) ||
      !Array.isArray(s.activeIds) ||
      s.activeIds.length > 50 ||
      !s.activeIds.every((id: unknown) => typeof id === "string") ||
      (s.mode !== "before" && s.mode !== "after")
    )
      return fallback;
    const ids = new Set(s.presets.map((p: ComposerPrefixPreset) => p.id));
    return {
      presets: s.presets,
      activeIds: [...new Set<string>(s.activeIds as string[])].filter((id) =>
        ids.has(id),
      ),
      mode: s.mode,
    };
  } catch {
    return fallback;
  }
}
/** Called once at the actual manual send boundary, never on draft updates. */
export function applyComposerPrefix(
  text: string,
  selection: ComposerPrefixSelection | null,
): string {
  if (!selection || !text.trim()) return text;
  const selected = new Set(selection.activeIds),
    block = selection.presets
      .filter((p) => selected.has(p.id))
      .map((p) => p.text)
      .join("");
  if (!block) return text;
  return selection.mode === "after" ? text + "\n" + block : block + "\n" + text;
}
export function uniqueComposerPrefix(
  contents: string[],
): ComposerPrefixSpec | null {
  const found = contents.flatMap((c) => extractComposerPrefixes(c).specs);
  if (found.some(s => "layout" in s)) {
    return found.length && found.every(s => JSON.stringify(s) === JSON.stringify(found[0])) ? found[0] : null;
  }
  return found.length === 1 ? found[0] : null;
}
