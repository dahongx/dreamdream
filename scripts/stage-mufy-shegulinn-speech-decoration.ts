/** Current owner theme only; preserve all authored CSS and reserve its measured outset. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {adaptMufySpeechDecorationCss} from '../src/lib/import/mufy-speech-decoration';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/33';
const before=JSON.parse(await readFile(`${dir}/speech-decoration-overflow-before.json`,'utf8'));
if(before.rank!==33||before.bubble.before.right!=='-20px'||before.chat.scrollWidth<=before.chat.clientWidth)throw Error('ACTUAL_ORNAMENT_OVERFLOW_REQUIRED');
const baseline=await readFile(`${dir}/owner-theme-baseline.txt`,'utf8'),adapted=adaptMufySpeechDecorationCss(baseline);
if(adapted.paddingRightPx!==20||!adapted.changed||!adapted.css.startsWith(baseline))throw Error('EXACT_SOURCE_SPACE_NOT_REPRODUCED');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(`${dir}/candidate-theme.txt`,adapted.css);
const proof={rank:33,observedAt:new Date().toISOString(),sourceEvidence:'speech-decoration-overflow-before.json',baselineSha256:hash(baseline),candidateSha256:hash(adapted.css),allOriginalCharactersPreserved:true,preservedOriginalCharacters:baseline.length,insertedCharacters:adapted.css.length-baseline.length,paddingRightPx:20,hiddenOverflow:false,originalDecorationUnchanged:true,ownerUiSaved:false,fullFidelityAccepted:false};
await writeFile(`${dir}/speech-decoration-candidate-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
