import {readFile,writeFile} from 'node:fs/promises';
const base='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const before=await readFile(base+'/qie-theme-after-narrow-title-repair.css','utf8');
const source=JSON.parse(await readFile(base+'/char_05fea4746330353011b9-public-render-assets.json','utf8'));
const publicHtml=source.frames.map((f:{html:string})=>f.html).join('\n');
if(!publicHtml.includes('cen-the-entry-box')||!publicHtml.includes('hk-fold-head'))throw Error('PUBLIC_COMPONENTS_NOT_CONFIRMED');
const after=before+'\n/* QIE_CANVAS_WIDTH: responsive source typography and bounded password-card padding. */\n@media (max-width: 340px) { .hk-bottom-folds-area { padding-left: 6px !important; padding-right: 6px !important; } .hk-fold-head { font-size: 14px !important; } }\n#cen-the-entry-box { box-sizing: border-box !important; margin-right: 0 !important; }\n';
await writeFile(base+'/qie-theme-after-canvas-width-repair.css',after);
console.log(JSON.stringify({before:before.length,after:after.length}));
