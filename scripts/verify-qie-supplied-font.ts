import { createHash } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
const startedAt = new Date().toISOString(), tick = performance.now();
const supplied = 'C:/Users/14343/Downloads/op_ticket_1_5677168484_1772019524134_qdqqd_7zgmfh.woff2';
const root = 'logs/mufy-profiles/full-20261013/next-batch-10-20261023/strict-acceptance-20261024';
const bytes = await Bun.file(supplied).bytes();
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== '51271b875de0235ba75bdf5f7e13f9ff885990147c7c742c115c58368693d34b' || new TextDecoder().decode(bytes.slice(0,4)) !== 'wOF2') throw Error('UNEXPECTED_FONT_FILE');
const decoded = Bun.spawnSync(['python', '-c',
  "from fontTools.ttLib import TTFont; import json,sys; f=TTFont(sys.argv[1]); c=f.getBestCmap(); print(json.dumps({'flavor':f.flavor,'glyphCount':len(c),'coverage':{hex(cp):cp in c for cp in [0x1065a,0x208a,0x2da,0x22b9,0xa673,0x90a3,0x4f60,0x53d1,0x8a93]}}))", supplied]);
if (decoded.exitCode !== 0) throw Error('FONT_DECODE_FAILED');
const inspection = JSON.parse(new TextDecoder().decode(decoded.stdout));
await mkdir(`${root}/supplied-assets`, {recursive:true});
const preservedPath = `${root}/supplied-assets/qie-original-title.woff2`;
await copyFile(supplied, preservedPath);
await writeFile(`${root}/supplied-font-validation.json`, JSON.stringify({
  startedAt, observedAt:new Date().toISOString(), elapsedMs:performance.now()-tick,
  source:'user-supplied-original-public-font', supplied, preservedPath,
  bytes:bytes.length, sha256, ...inspection,
  originalFontAcquired:true, deployed:false, visualAccepted:false,
  conclusion:'Original font bytes verified and preserved. It lacks U+1065A, U+22B9, U+A673; restoring this face alone cannot guarantee decorative glyph parity. Source fallback rendering remains to be verified.'
}, null, 2));
console.log(JSON.stringify({bytes:bytes.length, sha256, ...inspection, preservedPath, deployed:false}));
