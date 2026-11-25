import postcss from 'postcss';

/** Restore public author-owned content styles without renaming them as host UI. */
export function restoreMufyPublicContentCss(styles: string[], contentClasses: string[]): string {
  const owned = new Set(contentClasses.filter(name => /^mufy_[\w-]+$/.test(name)));
  if (!owned.size) return '';
  const restored: string[] = [];
  for (const style of styles) {
    let parsed: postcss.Root;
    try { parsed = postcss.parse(style); } catch { continue; }
    let matched = false;
    parsed.walkRules(rule => {
      if (rule.parent?.type === 'atrule' && rule.parent.name.includes('keyframes')) return;
      const selectors = rule.selectors.filter(selector =>
        [...selector.matchAll(/\.([\w-]+)/g)].some(match => owned.has(match[1])),
      );
      if (!selectors.length) { rule.remove(); return; }
      matched = true;
      // Escape the literal underscore: these names belong to content markup,
      // whereas the legacy host-selector translator rewrites unescaped mufy_.
      rule.selectors = selectors.map(selector => '#nj_chat_messages ' +
        selector.replace(/\.([\w-]+)/g, (full, name: string) => owned.has(name)
          ? '.' + name.replace('mufy_', 'mufy\\_') : full));
    });
    parsed.walkAtRules(rule => {
      if (!['keyframes', 'media', 'supports'].includes(rule.name)) rule.remove();
    });
    if (matched) restored.push(parsed.toString());
  }
  return restored.length ? '/* PUBLIC_AUTHOR_CONTENT_STYLES */\n' + restored.join('\n') : '';
}
