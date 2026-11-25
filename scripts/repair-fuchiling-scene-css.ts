import postcss from 'postcss';
import { sanitizeAndScopeCss } from '../src/lib/styling/whitelist';
import { writeFile, appendFile } from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const startedAt=new Date().toISOString(), tick=performance.now();
const assets=await Bun.file(`${root}/char_021f4c82c451d07b21a0-public-render-assets.json`).json();
const matches=(assets.styles as string[]).filter(s=>s.includes('.tutu-statusbar-wrapper'));
if(matches.length!==1)throw Error('EXACT_PUBLIC_SCENE_STYLE_REQUIRED');
// The public source has a malformed opening comment; repair this one known typo.
const parsed=postcss.parse(matches[0].replace('/时间栏*','/* 时间栏'));
parsed.walkRules(rule=>{
 if(rule.parent?.type==='atrule'&&rule.parent.name==='keyframes')return;
 rule.selectors=rule.selectors.map(s=>s==='.tutu-statusbar-wrapper'
  ? '#nj_chat_messages .tutu-statusbar-wrapper'
  : `#nj_chat_messages .tutu-statusbar-wrapper ${s}`);
});
const css=parsed.toString();
const disclosureMatches=(assets.styles as string[]).filter(s=>s.includes('.censy-summary'));
if(disclosureMatches.length!==1)throw Error('EXACT_PUBLIC_DISCLOSURE_STYLE_REQUIRED');
const disclosure=postcss.parse(disclosureMatches[0]);
disclosure.walkRules(rule=>{
 if(rule.parent?.type==='atrule'&&rule.parent.name==='keyframes')return;
 rule.selectors=rule.selectors.map(s=>`#nj_chat_messages ${s}`);
});
const disclosureCss=disclosure.toString();
// Generated replies sometimes spell the same public class family chensy-.
const disclosureAliases=disclosureCss.replaceAll('.censy-', '.chensy-');
// A verified first reply omitted classes on one direct child of the source
// accordion container. Recover only that component's public presentation;
// nested comment disclosures and unrelated plain details remain untouched.
const missingClassAliases=postcss.parse(disclosureCss);
missingClassAliases.walkRules(rule=>{
 if(!rule.selector.includes('.censy-summary')&&!/\.censy-accordion(?=\[|\s|$)/.test(rule.selector)){rule.remove();return;}
 rule.selector=rule.selector
  .replace(/\.censy-accordion(?=\[|\s|$)/g,'.censy-accordion-container > details:not([class])')
  .replaceAll('.censy-summary','.censy-accordion-container > details:not([class]) > summary:not([class])')
  .replaceAll('.censy-content','div');
});
missingClassAliases.walkAtRules(rule=>rule.remove());
const memoryMatches=(assets.styles as string[]).filter(s=>s.includes('.mem-box'));
if(memoryMatches.length!==1)throw Error('EXACT_PUBLIC_MEMORY_STYLE_REQUIRED');
const memory=postcss.parse(memoryMatches[0]);
memory.walkRules(rule=>{
 if(rule.parent?.type==='atrule'&&rule.parent.name==='keyframes')return;
 rule.selectors=rule.selectors.map(s=>`#nj_chat_messages ${s}`);
});
const memoryCss=memory.toString();
if(!sanitizeAndScopeCss(memoryCss,'memory-repair').css.includes('.mem-scroll'))throw Error('MEMORY_STYLE_CONTRACT_LOST');
const disclosureProbe=sanitizeAndScopeCss(disclosureCss,'disclosure-repair');
if(disclosureProbe.warnings.length||!disclosureProbe.css.includes('.censy-summary'))throw Error('DISCLOSURE_STYLE_CONTRACT_LOST');
const probe=sanitizeAndScopeCss(css,'scene-repair');
if(probe.warnings.length)throw Error(JSON.stringify(probe.warnings));
if(!probe.css.includes('display: flex')||!probe.css.includes('blink-live'))throw Error('STYLE_CONTRACT_LOST');
const before=await Bun.file(`${root}/fuchiling-theme-before-scene-repair.css`).text();
const marker='/* PUBLIC_SCENE_REPAIR_FUCHILING */';
if(before.includes(marker))throw Error('ALREADY_APPLIED');
// Put the independently parsed block first: malformed legacy CSS must not absorb it.
await writeFile(`${root}/fuchiling-theme-after-scene-repair.css`,marker+'\n'+css+'\n/* PUBLIC_DISCLOSURE_REPAIR_FUCHILING */\n'+disclosureCss+'\n'+disclosureAliases+'\n/* VERIFIED_MISSING_CLASS_COMPATIBILITY */\n'+missingClassAliases.toString()+'\n/* PUBLIC_MEMORY_REPAIR_FUCHILING */\n'+memoryCss+'\n'+before);
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({stepId:'fu-scene-css-repair',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'local-processing-with-file-io',netWorkMs:null})+'\n');
console.log(JSON.stringify({sourceStyleCount:matches.length,scopedCssChars:css.length,warnings:probe.warnings,existingThemePreserved:true}));
