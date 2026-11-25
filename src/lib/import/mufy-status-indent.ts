/** Display-only compatibility for the creator's named quad status template.
 * Do not globally dedent Markdown: ordinary code samples must remain code.
 */
export const MUFY_QUAD_DETAILS_PATTERN =
  '^[ \\t]+(<details(?:\\s[^>]*)?>)(?=\\s*<summary>\\s*<div class="censy-quad-title">)';

// This authored status template is HTML, not an intentional Markdown sample.
// A stray earlier end tag can reset the block-depth tracker before this opener.
export const MUFY_AQ_DETAILS_PATTERN =
  '^[ \\t]+(<details\\s+class="aq-v2-item"(?:\\s[^>]*)?>)(?=\\s*<summary\\s+class="aq-v2-title")';

/** Exact duplicated closure from the supplied aq-v2 template, before its BBS.
 * Removing it restores balance (three divs + one details) without changing text.
 */
export const MUFY_AQ_PREMATURE_CLOSE_PATTERN =
  '</div>\\s*</div>\\s*</details>\\s*</div>(?=\\s*<div class="aq-v2-label"><span>✦</span>\\s*校园匿名 BBS)';
// The normal pack importer rejects an empty replacement. An inert comment is
// stripped by the renderer and keeps this display-only repair importable.
export const MUFY_AQ_CLOSE_REPLACEMENT='<!-- mufy-aq-closure-recovered -->';

export function mufyStatusIndentRules(contracts: readonly string[]) {
  const templates=[
    {pattern:MUFY_QUAD_DETAILS_PATTERN,name:'迁移兼容：来源状态栏缩进',replacement:'$1'},
    {pattern:MUFY_AQ_DETAILS_PATTERN,name:'迁移兼容：来源状态栏缩进（aq-v2）',replacement:'$1'},
    {pattern:MUFY_AQ_PREMATURE_CLOSE_PATTERN,name:'迁移兼容：来源状态栏冗余结束标签（aq-v2）',replacement:MUFY_AQ_CLOSE_REPLACEMENT},
  ];
  return templates.filter(item=>contracts.some(text=>new RegExp(item.pattern,'m').test(text))).map(item=>({
    ruleName:item.name,regexPattern:`/${item.pattern}/gm`,replaceString:item.replacement,enabled:true,visibility:false,
  }));
}
