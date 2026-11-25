import postcss from 'postcss';
import { sanitizeAndScopeCss } from '../src/lib/styling/whitelist';
import { writeFile, appendFile } from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const startedAt=new Date().toISOString(), tick=performance.now();
const assets=await Bun.file(`${root}/char_74f0f9f5249f6fb2280f-public-render-assets.json`).json();
const matches=(assets.styles as string[]).filter(s=>s.includes('div.mufy_subscroll_censy_clean_v2'));
if(matches.length!==1)throw Error('EXACT_PUBLIC_STATUS_STYLE_REQUIRED');
const parsed=postcss.parse(matches[0]);
parsed.walkRules(rule=>{
 if(rule.parent?.type==='atrule'&&rule.parent.name.includes('keyframes'))return;
 // These are author-owned content classes, not host platform selectors.
 // CSS identifier escaping preserves their literal underscore through legacy host-prefix translation.
 rule.selectors=rule.selectors.map(s=>`#nj_chat_messages ${s.replaceAll('mufy_', 'mufy\\_')}`);
});
const css=parsed.toString();
// Rotating the source's 14px diamond extends its painted bounds about 6px.
// Reserve that space inside the summary instead of causing row-level overflow.
const rotationContainment='\n#nj_chat_messages summary.mufy\\_foldable_summary_censy::after { margin-inline-end: 8px; flex-shrink: 0; }\n';
const probe=sanitizeAndScopeCss(css,'xie-status-repair');
if(!probe.css.includes('overflow-y: auto')||!probe.css.includes('mufy\\_foldable_summary_censy'))throw Error('STATUS_CONTRACT_LOST');
const local=await Bun.file(`${root}/prepared/char_74f0f9f5249f6fb2280f/prepared.json`).json();
const before=local.beautification.globalCss as string;
await writeFile(`${root}/xieyan-theme-before-status-repair.css`,before);
await writeFile(`${root}/xieyan-theme-after-status-repair.css`,'/* PUBLIC_STATUS_REPAIR_XIEYAN */\n'+css+rotationContainment+'\n'+before);
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({stepId:'xie-public-status-css-repair',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'local-processing-with-file-io',netWorkMs:null})+'\n');
console.log(JSON.stringify({sourceStyleCount:matches.length,cssChars:css.length,warnings:probe.warnings,existingThemePreserved:true}));
