import { readFile, writeFile } from 'node:fs/promises';
const base='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const before=await readFile(base+'/chengfeng-theme-before-watermark-repair.css','utf8');
if(before.includes('VERIFIED_CHENGFENG_WATERMARK_CLIP'))throw Error('Already repaired');
const source=JSON.parse(await readFile(base+'/char_7e809d8db2ea655d204c-public-render-assets.json','utf8'));
if(!source.frames.some((f:{html?:string})=>f.html?.includes('ark-art-bg-watermark')&&/html\s*\{[^}]*overflow:\s*hidden/.test(f.html)))throw Error('Public source clipping evidence missing');
const after=before+'\n/* VERIFIED_CHENGFENG_WATERMARK_CLIP: restore source canvas clipping only for its decorative title block. */\n.ark-art-text-container { overflow: hidden !important; }\n';
await writeFile(base+'/chengfeng-theme-after-watermark-repair.css',after);
console.log(JSON.stringify({before:before.length,after:after.length,scope:'.ark-art-text-container'}));
