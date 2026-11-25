import { readFile, writeFile, appendFile } from 'node:fs/promises';
const startedAt = new Date().toISOString(), start = performance.now();
const base = 'logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const before = await readFile(base + '/chengfeng-theme-after-watermark-repair.css', 'utf8');
const source = JSON.parse(await readFile(base + '/char_7e809d8db2ea655d204c-public-render-assets.json', 'utf8')) as { styles: string[] };
if (!source.styles.some(s => /\.stage-cn\s*\{[^}]*margin-right:\s*-8px/s.test(s))) throw Error('SOURCE_NEGATIVE_TRACKING_MARGIN_NOT_CONFIRMED');
// Preserve the source text/font/tracking; do not hide overflow or crop glyphs.
// Its negative trailing margin escapes the narrower preview iframe by 8px.
const after = before + '\n/* CHENGFENG_NARROW_STAGE: keep trailing letter spacing inside narrow canvases. */\n@media (max-width: 400px) { .pt-stage-title .stage-cn { margin-right: 0 !important; } }\n';
await writeFile(base + '/chengfeng-theme-after-narrow-stage-repair.css', after);
await appendFile(base + '/strict-acceptance-20261024/compute-timing.jsonl', JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-start,stage:'prepare-chengfeng-narrow-stage',network:false})+'\n');
console.log(JSON.stringify({before:before.length,after:after.length,scope:'.pt-stage-title .stage-cn at <=400px'}));
