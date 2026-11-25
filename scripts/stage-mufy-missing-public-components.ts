/** Explicit verified source indices only; never overwrites prepared or owner UI. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {normalizePublicFrameReplay,repairPublicOpeningContinuationFence} from '../src/lib/import/mufy-public-frame-replay';
const rank=Number(process.argv[2]),indices=(process.argv[3]??'').split(',').map(Number);
if(!Number.isInteger(rank)||!indices.length||indices.some(i=>!Number.isInteger(i)||i<0)||new Set(indices).size!==indices.length)throw Error('EXPLICIT_SOURCE_INDICES_REQUIRED');
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=`${root}/final-acceptance/${rank}`;
const receipts=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8'));
const receipt=receipts.rows.find((r:{rank:number})=>r.rank===rank);
const source=JSON.parse(await readFile(`${dir}/source-public-component-inventory.json`,'utf8'));
if(!receipt||source.url!==receipt.sourceUrl||source.sourceKey!==receipt.sourceKey||!source.roleNamePresent)throw Error('SOURCE_IDENTITY_MISMATCH');
const baseline=await readFile(`${dir}/owner-opening-baseline.txt`,'utf8');
const text=(html:string)=>{const d=new JSDOM(html.replace(/<(script|style|template|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,''));const t=d.window.document.body.textContent??'';d.window.close();return t.replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();};
const existing=text(baseline),blocks=[];
for(const index of indices){
 const frame=source.roots[0]?.frames[index];
 if(!frame?.rawLength||frame.collapsedDrawer||frame.width<=2||frame.height<=2)throw Error('PUBLIC_COMPONENT_NOT_OBSERVED');
 const body=text(frame.html);
 const samples=[body.slice(0,28),body.slice(Math.floor(body.length/2),Math.floor(body.length/2)+28),body.slice(-28)].filter(s=>s.length>=20);
 if(samples.length<2||samples.some(s=>existing.includes(s)))throw Error(`COMPONENT_ALREADY_PRESENT_OR_PARTIALLY_MATCHED_${index}`);
 const html=normalizePublicFrameReplay(frame.html).html;
 blocks.push({sourceFrameIndex:index,html});
}
const suffix=blocks.map(b=>`\n<div data-nj-restored-source-rank="${rank}" data-source-frame="${b.sourceFrameIndex}">\n\`\`\`html\n${b.html}\n\`\`\`\n</div>`).join('\n');
const repaired=repairPublicOpeningContinuationFence(baseline);
const candidate=repaired.html+suffix,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(`${dir}/candidate-opening.txt`,candidate);
const proof={rank,sourceUrl:source.url,sourceObservedAt:source.observedAt,observedAt:new Date().toISOString(),sourceIndices:indices,baselineSha256:hash(baseline),candidateSha256:hash(candidate),originalCharacters:baseline.length,removedNestedFenceCharacters:repaired.removed*8,allOtherOriginalCharactersPreserved:true,candidateCharacters:candidate.length,ownerUiSaved:false,fullFidelityAccepted:false};
await writeFile(`${dir}/missing-components-staging.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
