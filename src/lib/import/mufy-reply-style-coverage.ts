import postcss from 'postcss';

/** Preflight only: a classed disclosure without any captured selector is not
 * visually verified. Never invent CSS to fill a missing public capture. */
export function missingMufyDisclosureStyles(contracts: readonly string[], css: string): string[] {
  const required = new Set<string>();
  for (const html of contracts) {
    for (const match of html.matchAll(/<(?:details|summary)\b([^>]*)>/gi)) {
      if (/\bstyle\s*=/.test(match[1])) continue;
      const classes = /\bclass\s*=\s*["']([^"']+)["']/i.exec(match[1]);
      for (const token of classes?.[1].split(/\s+/) ?? []) {
        if (/^[a-zA-Z_][\w-]*$/.test(token)) required.add(token);
      }
    }
  }
  const covered = new Set<string>();
  try {
    postcss.parse(css.replace(/<\/?style\b[^>]*>/gi, '')).walkRules(rule => {
      if (!rule.nodes.some(node => node.type === 'decl')) return;
      for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) covered.add(match[1]);
    });
  } catch { return [...required]; }
  return [...required].filter(token => !covered.has(token));
}
