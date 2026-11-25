/** Append two missing public display-only components to the fresh owner baseline. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizePublicFrameReplay} from '../src/lib/import/mufy-public-frame-replay';
const startedAt=new Date().toISOString(),tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/22/missing-short-components';
const baseline=await readFile(out+'/owner-baseline.txt','utf8'),source=JSON.parse(await readFile(root+'/final-acceptance/22/source-public-component-inventory.json','utf8'));
if(baseline.includes('需要我提醒你是谁的吗')||baseline.includes('发誓再也不当舔狗了'))throw Error('SHORT_COMPONENTS_ALREADY_PRESENT_REVIEW');
const parts=[6,7].map(i=>{const html=source.roots[0].frames[i].html as string;if(/<script\b/i.test(html))throw Error('DISPLAY_ONLY_SOURCE_EXPECTED');return{index:i,html:normalizePublicFrameReplay(html).html};});
const candidate=baseline+parts.map(p=>`\n<div data-nj-restored-source-rank="22" data-source-frame="${p.index}">\n\x60\x60\x60html\n${p.html}\n\x60\x60\x60\n</div>\n`).join(''),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(out+'/candidate-opening.txt',candidate);await writeFile(out+'/frames.json',JSON.stringify({rank:22,parts},null,2));
const proof={rank:22,startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceIndexes:[6,7],displayOnly:true,sourceOrderPreserved:true,baselineSha256:hash(baseline),candidateSha256:hash(candidate),allOriginalCharactersPreserved:candidate.startsWith(baseline),baselineCharacters:baseline.length,candidateCharacters:candidate.length,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};await writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
