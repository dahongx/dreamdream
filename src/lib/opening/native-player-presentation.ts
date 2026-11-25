/** The shard player sizes its padded children with the browser content-box
 * default. Narrow iframe widths must not trigger our host mobile reset inside
 * that independent document. Change only migration-owned styles; author CSS,
 * scripts and the outer responsive containment remain intact. */
export function nativePlayerDocumentPresentation(srcdoc: string): string {
  if (!/class\s*=\s*["'][^"']*\bcensy-player-shard\b/.test(srcdoc)) return srcdoc;
  return srcdoc.replace(
    /(<style\b[^>]*\bdata-mufy-adaptation\s*=\s*["']mobile-box-model["'][^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, start: string, css: string, end: string) =>
      start + css.replace(/\*,\*::before,\*::after\s*\{\s*box-sizing\s*:\s*border-box\s*;?\s*\}/g,
        'html,body{box-sizing:border-box}') + end,
  );
}
