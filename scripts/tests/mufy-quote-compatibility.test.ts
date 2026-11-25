import {test,expect} from 'bun:test';
import {parseExternalRulesJson} from '../../src/lib/import/external-card';
import {buildRegExp} from '../../src/lib/regex/apply';
import {mufyQuoteCompatibilityRules} from '../../src/lib/import/mufy-quote-compatibility';
test('current-card compatibility wraps only source-style quoted speech, not comparisons or entities',async()=>{
 const raw=await Bun.file('logs/mufy-profiles/full-20261013/next-batch-5-20261019/jianglai-quote-compatibility.json').text();
 const parsed=parseExternalRulesJson(raw);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
 const r=parsed.value[0];
 const result='>"台词"\n\n> 3\n\n&gt;字面符号'.replace(buildRegExp(r.pattern),r.replacement);
 expect(result).toContain('<blockquote');expect(result).toContain('<p>"台词"</p>');
 expect(result).toContain('> 3');expect(result).toContain('&gt;字面符号');
 expect(r.outputGuidance).toBeNull();
});
test('future UI bundles add the named compatibility only for observed dialogue quote syntax',()=>{
 expect(mufyQuoteCompatibilityRules(['> 3'])).toEqual([]);
 expect(mufyQuoteCompatibilityRules(['&gt;"literal"'])).toEqual([]);
 expect(mufyQuoteCompatibilityRules(['>"台词"'])).toHaveLength(1);
});
