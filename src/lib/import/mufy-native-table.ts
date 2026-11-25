/** Source public DOM, 2026-10-19: Mufy supplies white / #f0f0f0 table
 * rows outside the author's inline HTML. Preserve that platform default only
 * for imported native tables explicitly using black text with no own surface.
 * This is not a global dark-mode override or a rewrite of model/history data. */
export function needsMufyLightTableRows(style: { color?: unknown; background?: unknown; backgroundColor?: unknown; backgroundImage?: unknown } | undefined): boolean {
  if (!style) return false;
  const color = typeof style.color === "string" ? style.color.replace(/\s+/g, "").toLowerCase() : undefined;
  if (!color || !["black", "#000", "#000000", "rgb(0,0,0)", "rgba(0,0,0,1)"].includes(color)) return false;
  for (const value of [style.background, style.backgroundColor]) {
    if (value !== undefined && (typeof value !== "string" || !["transparent", "rgba(0,0,0,0)"].includes(value.replace(/\s+/g, "").toLowerCase()))) return false;
  }
  return !style.backgroundImage || style.backgroundImage === "none";
}

export function hasMufyRenderedOpening(rules: ReadonlyArray<{ enabled: boolean; replacement: string }>): boolean {
  return rules.some(rule => rule.enabled && rule.replacement.startsWith("<artifact><style data-mufy-rendered-opening>"));
}

/** New normal-UI imports carry the offline adapter's explicit component marker,
 * not the legacy rendered-opening regex. Do not infer provenance from names. */
export function hasMufyAdaptedComponent(components: ReadonlyArray<{ content: string }>): boolean {
  return components.some(({ content }) => /<style\b[^>]*\bdata-mufy-adaptation=["']mobile-box-model["'][^>]*>/i.test(content));
}
