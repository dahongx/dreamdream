import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {sanitizeAndScopeCss} from '../src/lib/styling/whitelist';
const base='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const startedAt=new Date().toISOString(),tick=performance.now();
const before=await readFile(`${base}/qie-theme-after-status-css-repair.css`,'utf8');
// Public DOM: 328px body, 40px side padding, 300px single-line heading.
// Preserve font and nowrap; reclaim only narrow-frame padding (not host UI).
const patch='\n/* QIE_NARROW_ARCHIVE_PADDING: preserve source single-line headings */\n@media (max-width: 400px) { .hk-bottom-folds-area { padding-left: 10px !important; padding-right: 10px !important; } }\n';
const source=await readFile(`${base}/char_05fea4746330353011b9-public-render-assets.json`,'utf8');
if(!source.includes('.hk-bottom-folds-area'))throw Error('SOURCE_COMPONENT_REQUIRED');
const result=sanitizeAndScopeCss(patch,'qie-narrow-title');
if(result.warnings.length)throw Error(JSON.stringify(result.warnings));
await writeFile(`${base}/qie-theme-after-narrow-title-repair.css`,before+patch);
await appendFile(`${base}/timing-runs.jsonl`,JSON.stringify({stepId:'qie-narrow-title-css',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'local-processing-with-file-io',netWorkMs:null})+'\n');
console.log(JSON.stringify({before:before.length,after:(before+patch).length,promptChanged:false}));
