/** Public render rules only. Never reads a character/runtime/private prompt file. */
import {parseExternalRulesJson} from '../src/lib/import/external-card';
export interface PublicReplayRuleInput {ruleName:string;regexPattern:string;replaceString:string;enabled?:boolean;visibility?:boolean}
export function completePublicReplayRules(source:PublicReplayRuleInput[],baseline:PublicReplayRuleInput[],attested:PublicReplayRuleInput[]=[]){
 const keys=new Set(['ruleName','regexPattern','replaceString','enabled','visibility']);
 for(const rule of [...source,...baseline,...attested])if(Object.keys(rule).some(key=>!keys.has(key)))throw Error('UNEXPECTED_PUBLIC_RULE_FIELD');
 const same=(a:PublicReplayRuleInput,b:PublicReplayRuleInput)=>a.ruleName===b.ruleName&&a.regexPattern===b.regexPattern&&a.replaceString===b.replaceString;
 if(source.some(rule=>!baseline.some(candidate=>same(rule,candidate))))throw Error('FULL_RULE_BASELINE_OMITS_SOURCE_CHAIN');
 const combined=[...baseline];
 for(const rule of attested){if(combined.some(existing=>same(existing,rule)))continue;if(combined.some(existing=>existing.ruleName===rule.ruleName))throw Error('ATTESTED_RULE_CONFLICT');combined.push(rule);}
 if(!combined.length)return [];
 const parsed=parseExternalRulesJson(JSON.stringify(combined));
 if(!parsed.ok||parsed.value.length!==combined.length)throw Error('PUBLIC_RULE_IMPORT_NORMALIZATION_FAILED');
 return parsed.value.map((rule,index)=>({name:rule.name,pattern:rule.pattern,replacement:rule.replacement,enabled:rule.enabled,visible:rule.visible,orderIndex:index}));
}
