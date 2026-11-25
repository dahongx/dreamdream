import {readFile,writeFile,appendFile} from 'node:fs/promises';
import postcss from 'postcss';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const priorReview=Bun.file(root+'/cuizhiyu-source-ui-review.json');
if(await priorReview.exists()&&(await priorReview.json()).ok&&!process.argv.includes('--reopen'))throw Error('ALREADY_VERIFIED_USE_EXPLICIT_REOPEN');
const startedAt=new Date().toISOString(),t=performance.now();
const capture=JSON.parse(await readFile(root+'/cuizhiyu-additional-public-css-20261022.json','utf8')) as {styles:string[]};
const css=postcss.parse(capture.styles[0]);
css.walkRules(r=>{if(r.parent?.type==='atrule'&&r.parent.name.endsWith('keyframes'))return;r.selectors=r.selectors.map(s=>'#nj_chat_messages '+s)});
// Same public animation, mapped to an explicitly named render-only ornament.
const eye=postcss.parse(capture.styles[2]);
eye.walkRules(r=>{if(r.parent?.type==='atrule'&&r.parent.name.endsWith('keyframes'))return;r.selector=r.selector.replaceAll('.group.flex.w-fit.cursor-pointer.select-none','.mufy-source-think-indicator');r.selectors=r.selectors.map(s=>'#nj_chat_messages '+s)});
await writeFile(root+'/cuizhiyu-additional-host.css',css.toString()+'\n'+eye.toString());
await writeFile(root+'/cuizhiyu-public-memory-skin.html','<style data-mufy-public-memory-skin>'+capture.styles[1]+'</style>');
const rules=[
 {ruleName:'迁移兼容：崔稚玉来源思考动效（非作者原始正则）',regexPattern:'/^(?![\\s\\S]*ai生成地点)(?=[\\s\\S]*class=["\\\']Z_CONFIG_compact_wrap["\\\'])/',replaceString:'<div class="mufy-source-think-indicator" aria-label="思考提示"></div>\n',disabled:false},
 {ruleName:'迁移兼容：完成校验不显示在正文',regexPattern:'/^[ \\t]*☆已生成完整[ \\t]*(?:\\r?\\n|$)/gm',replaceString:'<!-- completion checked in raw reply -->',disabled:false},
];
await writeFile(root+'/cuizhiyu-source-presentation-rules.json',JSON.stringify(rules,null,2));
await writeFile(root+'/cuizhiyu-completion-presentation-only.json',JSON.stringify([rules[1]],null,2));
const report=JSON.parse(await readFile(root+'/scoped-trial-closeout-20261022.json','utf8'));
report.scopedVersionClosed=false;report.reopenedAt=startedAt;report.knownBlockingFindings=['scene skin missing','source eye animation missing','inline speech avatars absent','memory sidebar incorrectly inline','completion marker should not appear in visible UI'];
await writeFile(root+'/scoped-trial-closeout-20261022.json',JSON.stringify(report,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'prepare-source-ui-repair',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t})+'\n');
console.log('Reopened UI acceptance; public styles and render-only rules prepared.');
