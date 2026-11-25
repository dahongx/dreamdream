import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {completePublicReplayRules} from '../mufy-saved-reply-rules';
const source={ruleName:'source',regexPattern:'/x/g',replaceString:'y',enabled:true,visibility:false};
test('replay must contain the source chain and all baseline/attested public compatibility rules in order',()=>{
 const avatar={...source,ruleName:'avatar',regexPattern:'/y/g',replaceString:'z'},compat={...source,ruleName:'compat',regexPattern:'/z/g',replaceString:'done'};
 expect(()=>completePublicReplayRules([source],[avatar])).toThrow('FULL_RULE_BASELINE_OMITS_SOURCE_CHAIN');
 const rules=completePublicReplayRules([source],[source,avatar],[compat,compat]);expect(rules.map(r=>r.name)).toEqual(['source','avatar','compat']);expect(rules.map(r=>r.orderIndex)).toEqual([0,1,2]);expect(rules.every(r=>r.enabled)).toBe(true);
 expect(()=>completePublicReplayRules([source],[source],[{...source,replaceString:'different'}])).toThrow('ATTESTED_RULE_CONFLICT');expect(()=>completePublicReplayRules([],[{...source,unexpected:'not public'}] as never)).toThrow('UNEXPECTED_PUBLIC_RULE_FIELD');expect(completePublicReplayRules([],[])).toEqual([]);
});
test('public replay client is pinned to the same full rule fingerprint and never consumes chain-only fields',()=>{
 const client=readFileSync('scripts/preview-mufy-batch30-saved-replies-client.tsx','utf8'),driver=readFileSync('scripts/mufy-saved-reply-ui-check.mjs','utf8');expect(client).toContain('data-rules-sha256={entry?.ruleSetSha256}');expect(driver).toContain('REPLAY_RULE_SET_HASH_MISMATCH');expect(client).not.toContain('rule.regexPattern');
});
