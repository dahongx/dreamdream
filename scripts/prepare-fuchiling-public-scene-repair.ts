/** Derive a display-only rule from saved public DOM; never edit character prompts. */
import { JSDOM } from 'jsdom';
import { writeFile } from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const content=await Bun.file(`${root}/char_021f4c82c451d07b21a0-public-content.json`).json();
if(!content.lengthVerified)throw Error('UNVERIFIED_PUBLIC_SOURCE');
const doc=new JSDOM(content.markdownBlocks[1].html).window.document;
const scene=doc.querySelector('.tutu-statusbar-wrapper');
if(!scene)throw Error('PUBLIC_SCENE_MISSING');
let template=scene.outerHTML;
for(const [label,value] of [['在场人物姓名','$1'],['吐槽短句','$2'],['具体时间','$3'],['具体地点','$4']]){
 if(!template.includes(label))throw Error('PUBLIC_FIELD_MISSING');
 template=template.replace(label,value);
}
const pattern='<时间栏>\\s*<名字>([\\s\\S]*?)<\\/名字>\\s*<吐槽>([\\s\\S]*?)<\\/吐槽>\\s*<时间>([\\s\\S]*?)<\\/时间>\\s*<地点>([\\s\\S]*?)<\\/地点>\\s*<\\/时间栏>';
const local=await Bun.file(`${root}/prepared/char_021f4c82c451d07b21a0/prepared.json`).json();
const re=new RegExp(pattern,'g');
if((local.character.opening.match(re)||[]).length!==1)throw Error('OPENING_MATCH_REQUIRED');
const result=local.character.opening.replace(re,template);
if(result.includes('<时间栏>')||!result.includes('tutu-statusbar-wrapper'))throw Error('REPLACEMENT_FAILED');
const rules=[{ruleName:'迁移兼容：公开来源时间栏',regexPattern:`/${pattern}/g`,replaceString:template,disabled:false}];
await writeFile(`${root}/fuchiling-public-scene-rule.json`,JSON.stringify(rules,null,2));
console.log(JSON.stringify({rules:rules.length,templateChars:template.length,openingMatches:1,promptChanged:false}));
