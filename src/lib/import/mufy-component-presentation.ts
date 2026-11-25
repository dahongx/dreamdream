import {mufyPlayerNameBinding} from './mufy-player-name';

/** Independent source documents use content-box unless their author overrides it.
 * A host mobile reset changes padded profiles and even unrelated audio players.
 * Undo only that migration-owned universal reset; keep containment, html/body
 * sizing and every author style (including an explicit border-box reset) intact. */
function preserveIndependentBoxModel(srcdoc: string): string {
  return srcdoc.replace(
    /(<style\b[^>]*\bdata-mufy-adaptation\s*=\s*["']mobile-box-model["'][^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, start: string, css: string, end: string) => start +
      css.replace(/\*,\*::before,\*::after\s*\{\s*box-sizing\s*:\s*border-box\s*;?\s*\}/g,
        'html,body{box-sizing:border-box}') + end,
  );
}

/** Independent source iframes did not inherit the Mufy host document's skin.
 * Keep this separate from reply canvases, which intentionally consume it.
 * Colors here reproduce the measured source UA default, not Dearm UI tokens.
 */
export function openingComponentPresentation(
  srcdoc: string,
  sanitizedHostSkin: string,
  independentSource: boolean,
): string {
  if (independentSource && !srcdoc.includes('data-mufy-source-skin') &&
      !srcdoc.includes('data-mufy-rendered-opening')) {
    // Before author CSS: explicit author body/element colors still win.
    // Do not change color-scheme: transparent iframe canvases need it to match
    // the host. Do not remove the existing sandbox or surface reset here.
    const presented = preserveIndependentBoxModel(srcdoc);
    return '<style data-mufy-component-presentation>body{color:rgb(0,0,0);text-shadow:none}</style>\n' + mufyPlayerNameBinding(presented) + presented;
  }
  return (sanitizedHostSkin ? `<style>${sanitizedHostSkin}</style>` : '') + '\n' + srcdoc;
}
