import postcss from "postcss";
import { sanitizeAndScopeCss } from "../styling/whitelist";

/** Recover safe host/reply skin, retaining an explicit ledger of nonportable decorations. */
export function adaptMufyHostCss(css: string, contracts: string[]) {
  const root = postcss.parse(css);
  const tokens = new Set<string>();
  for (const html of contracts) {
    for (const match of html.matchAll(/\b(class|id)\s*=\s*["']([^"']+)["']/gi))
      for (const token of match[2].split(/\s+/))
        if (/^[\w-]+$/.test(token))
          tokens.add((match[1].toLowerCase() === "id" ? "#" : ".") + token);
  }
  const deferred: { selector: string; reasons: string[] }[] = [];
  root.walkAtRules((rule) => {
    if (!/^(?:keyframes|media|supports)$/i.test(rule.name)) {
      deferred.push({
        selector: `@${rule.name}`,
        reasons: [
          "external font/import or unsupported host rule; source kept in original snapshot",
        ],
      });
      rule.remove();
    }
  });
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name))
      return;
    const kept: string[] = [];
    for (const selector of rule.selectors) {
      const usesReply = [...selector.matchAll(/[.#][\w-]+/g)].some((match) =>
        tokens.has(match[0]),
      );
      const adapted =
        usesReply && !/[.#]nj_[\w-]+/.test(selector)
          ? `#nj_chat_messages ${selector.replace(/^body\s+/, "")}`
          : selector;
      const safeRule = rule.clone({ selector: adapted });
      safeRule.walkDecls((decl) => {
        const single = postcss.rule({ selector: adapted });
        single.append(decl.clone());
        const reasons = sanitizeAndScopeCss(
          single.toString(),
          "migration-adaptation",
        ).warnings;
        if (
          reasons.length &&
          !reasons.some((reason) => reason.startsWith("selector blocked:"))
        ) {
          deferred.push({ selector: `${selector} [${decl.prop}]`, reasons });
          decl.remove();
        }
      });
      const probe = safeRule.toString();
      const warnings = sanitizeAndScopeCss(
        probe,
        "migration-adaptation",
      ).warnings;
      if (warnings.length) deferred.push({ selector, reasons: warnings });
      else {
        kept.push(adapted);
        rule.removeAll();
        for (const node of safeRule.nodes ?? []) rule.append(node.clone());
      }
    }
    if (!kept.length) rule.remove();
    else rule.selectors = kept;
  });
  return { css: root.toString(), deferred };
}
