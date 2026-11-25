/** Explicit creator opt-in. This is sizing metadata, never source provenance. */
export function artifactMinHeight(srcdoc: string): number | undefined {
  const root = /^\s*(?:<!doctype\b[^>]*>\s*)?<html\b([^>]*)>/i.exec(srcdoc);
  if (!root) return undefined;
  const attribute =
    /\bdata-nj-iframe-min-height\s*=\s*["']([0-9]{1,3})["']/i.exec(root[1]);
  if (!attribute) return undefined;
  const value = Number(attribute[1]);
  return value >= 1 && value <= 500 ? value : undefined;
}
