/** Detect explicit custom XML output protocols; never invent their rendering rules. */
export function findMufyXmlRenderProtocols(texts: readonly string[]): string[] {
  const tags=new Set<string>();
  for(const text of texts){
    for(const match of text.matchAll(/<([a-z][a-z0-9]*_[a-z0-9_]+)(?:\s[^<>]*|\s*)>/gi)){
      const name=match[1].toLowerCase();
      if(new RegExp(`</${name}\\s*>`,'i').test(text))tags.add(name);
    }
  }
  return [...tags].sort();
}

export function assertMufyXmlRenderCoverage(texts:readonly string[],hasValidatedSourceRuleChain:boolean):void {
  // Narrow fail-closed gate for the renderer protocol actually observed broken.
  // Other paired tags can be instruction metadata or already styled HTML;
  // their presence alone is a review signal, not proof of a missing renderer.
  const tags=findMufyXmlRenderProtocols(texts).filter(t=>t==='c_post_system'||t==='matrix_pre_status');
  if(tags.length&&!hasValidatedSourceRuleChain){
    throw new Error(`MISSING_SOURCE_RENDER_RULES:${tags.join(',')}`);
  }
}
