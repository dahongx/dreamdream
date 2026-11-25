/** Exact single-card canvas repair from observed source/target geometry. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/40';
const before=JSON.parse(await readFile(`${dir}/music-canvas-before.json`,'utf8'));
if(before.rank!==40||before.source.canvasHeight!==100||before.target.canvasHeight!==1||before.source.src!==before.target.src||before.source.rect.y<0||before.target.rect.y>=0)throw Error('OBSERVED_CANVAS_MISMATCH_REQUIRED');
const baseline=await readFile(`${dir}/owner-opening-baseline.txt`,'utf8');
const marker='id="newEraPlayerContainer"',start=baseline.indexOf(marker),end=baseline.indexOf('</body>',start);
if(start<0||end<start||baseline.indexOf(marker,start+marker.length)>=0||baseline.includes('data-mufy-new-era-canvas'))throw Error('UNIQUE_UNREPAIRED_PLAYER_REQUIRED');
const addition='<style data-mufy-new-era-canvas>body[data-nj-opening-canvas]{min-height:100px!important}</style>\n';
const candidate=baseline.slice(0,end)+addition+baseline.slice(end);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof={rank:40,observedAt:new Date().toISOString(),baselineSha256:hash(baseline),candidateSha256:hash(candidate),preservedOriginalCharacters:baseline.length,insertedCharacters:addition.length,allOriginalCharactersPreserved:candidate.replace(addition,'')===baseline,scope:'one existing newEra source document; restore observed100px minimum canvas, no global theme, URL, program or prompt rewrite',ownerUiSaved:false,fullFidelityAccepted:false};
await writeFile(`${dir}/candidate-opening.txt`,candidate);await writeFile(`${dir}/music-canvas-candidate-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
