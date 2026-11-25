/** Explicit migration compatibility, NOT a claimed source-author rule.
 * HTML sanitization escapes a leading Markdown > before CommonMark runs.
 * Limit this fallback to quoted dialogue in cards whose archive demonstrates it.
 * No model guidance, stored message, plain comparison or entity is rewritten. */
export function mufyQuoteCompatibilityRules(contracts: readonly string[]) {
  if (!contracts.some(text => /^ {0,3}>[ \t]*["“「]/m.test(text))) return [];
  return [{
    ruleName: '迁移兼容：台词引用（非来源作者规则）',
    regexPattern: '/^ {0,3}>[ \\t]*(["“「][^\\r\\n]*)$/gm',
    replaceString: '<blockquote style="border:none;padding:8px 15px;margin:0;color:inherit"><p>$1</p></blockquote>',
    enabled: true,
    visibility: false,
  }];
}
