/** Public creator component styles only. No prompt, stored-message or host CSS mutation. */
export function collectMufySharedComponentStyle(components: ReadonlyArray<{content:string}>): string {
  const blocks=new Set<string>();
  for(const {content} of components){
    if(content.length>2_097_152)continue;
    for(const match of content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)){
      const css=match[1],clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
      // The known public fire-terminal block is independent from page skin.
      // Do not import a mixed global theme, markup, scripts or unrelated widgets.
      const fire=clean.includes('.mf-fire-widget')&&clean.includes('.mf-fire-panel');
      const state=clean.includes('.m-state-wrapper')&&clean.includes('.m-state-fold');
      const memory=clean.includes('.right-stable-sidebar')&&clean.includes('.right-sidebar-content');
      if(css.length>32768||(!fire&&!state&&!memory))continue;
      if(/<|(?:^|[{}])\s*(?:html|body|:root|\*)\s*[{,]/im.test(clean))continue;
      blocks.add(css);
    }
  }
  return [...blocks].join('\n');
}

export function withMufySharedComponentStyle(srcdoc:string,css:string): string {
  if(!css||!srcdoc.includes('data-mufy-source-skin')||!/class=["'][^"']*\b(?:mf-fire-widget|right-stable-sidebar|m-state-wrapper|m-state-fold)\b/.test(srcdoc))return srcdoc;
  // Source defaults precede explicit reply styles. The live terminal is rendered
  // once in a viewport portal, not once at the bottom of every message canvas.
  return `<style data-mufy-shared-component>${css}</style>`+srcdoc+
    '<style data-mufy-shared-component-layout>.mf-fire-widget{display:none!important}.right-stable-sidebar{display:none!important}</style>';
}
