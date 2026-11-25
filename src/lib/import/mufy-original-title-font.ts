/** Fixed, user-supplied public font. Never forwards creator CSS or arbitrary URLs
 * into the host. The font family is unique to these exact, SHA-256 pinned bytes. */
export const MUFY_QIE_FONT_SHA256 = '51271b875de0235ba75bdf5f7e13f9ff885990147c7c742c115c58368693d34b';
export const MUFY_QIE_FONT_PATH = '/fonts/mufy-qie-title-51271b875de0.woff2';
const SOURCE_URL = 'https://s3plus.meituan.net/opapisdk/op_ticket_1_5677168484_1772019524134_qdqqd_7zgmfh.woff2';

export function usesMufyOriginalTitleFont(components: ReadonlyArray<{content:string}>): boolean {
  return components.some(({content}) => content.length <= 2_097_152 &&
    [...content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].some(([,css]) => {
      const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
      return /\.censy-quad-title\b/.test(clean) &&
        [...clean.matchAll(/@font-face\s*\{([^{}]*)\}/gi)].some(([,face]) =>
          /font-family\s*:\s*['"]?CensyCustomTitleFont['"]?\s*(?:;|$)/i.test(face) &&
          face.includes(SOURCE_URL));
    }));
}

// These constants are application-authored, not a sanitizer exception.
// No size, spacing, content, animation, or fallback family is changed.
export const MUFY_ORIGINAL_TITLE_FONT_CSS = `@font-face{font-family:DearmQieTitle51271b;src:url("${MUFY_QIE_FONT_PATH}") format("woff2");font-display:swap}
[data-mufy-original-title-font="qie-51271b"] .censy-quad-title{font-family:DearmQieTitle51271b,sans-serif!important}`;
