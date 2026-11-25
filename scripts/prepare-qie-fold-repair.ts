import { writeFile } from 'node:fs/promises';
import { prepareForMarkdown } from '../src/lib/markdown-prep';
const root='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
// Only creator's named status-panel template, not arbitrary indented code.
const pattern='^[ \\t]+(<details(?:\\s[^>]*)?>)(?=\\s*<summary>\\s*<div class="censy-quad-title">)';
const re=new RegExp(pattern,'gm');
const fixture='    <details>\n        <summary><div class="censy-quad-title">状态</div></summary>\n        <div>内容</div>\n    </details>';
const repaired=prepareForMarkdown(fixture.replace(re,'$1'));
if(!repaired.startsWith('<details>\n<summary>')||repaired.includes('    '))throw Error('DEINDENT_FAILED');
const code='    <details>\n        example code\n    </details>';
if(code.replace(re,'$1')!==code)throw Error('UNRELATED_CODE_CHANGED');
await writeFile(`${root}/qie-status-fold-repair.json`,JSON.stringify([{ruleName:'迁移兼容：亓厄状态栏缩进',regexPattern:`/${pattern}/gm`,replaceString:'$1',disabled:false}],null,2));
console.log(JSON.stringify({targetedFixturePassed:true,unrelatedCodePreserved:true,promptChanged:false}));
