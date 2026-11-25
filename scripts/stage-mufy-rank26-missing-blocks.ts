/** Public DOM only. Add missing source blocks to freshly observed owner baseline. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizePublicFrameReplay} from '../src/lib/import/mufy-public-frame-replay';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/26';
const source=JSON.parse(await readFile(`${dir}/source-missing-public-blocks.json`,'utf8'));
if(source.rank!==26||source.sourceUrl!=='https://chat.mufy.ai/chat?roleId=17c98395-44bc-49a1-b44f-7441cb549fd6'||JSON.stringify(source.blocks.map((b:{sourceFrameIndex:number})=>b.sourceFrameIndex))!=='[5,7,8]')throw Error('SOURCE_BINDING_MISMATCH');
const baseline=await readFile(`${dir}/owner-opening-baseline.txt`,'utf8');
if(baseline.includes('0e4ec6e33825aa0b6f96d9afcf23aab8')||baseline.includes('data-nj-restored-public-rank26'))throw Error('ALREADY_PRESENT');
const blocks=source.blocks.map((b:{html:string})=>normalizePublicFrameReplay(b.html).html);
if(!blocks[0].includes('0e4ec6e33825aa0b6f96d9afcf23aab8')||!blocks[1].includes('新开场白')||!blocks[2].includes('后台面具指令'))throw Error('SOURCE_COMPONENT_BODY_MISSING');
const suffix=blocks.map((html:string)=>`\n<div data-nj-restored-public-rank26>\n\`\`\`html\n${html}\n\`\`\`\n</div>`).join('\n');
// Exact nested fence in this observed first source document. It is not a new
// document boundary: it introduces the continuation script before </html>.
const nested='\n```html\n<script>\n(function(){\n  try {\n    const pDoc = window.parent.document;';
if(baseline.split(nested).length!==2)throw Error('OBSERVED_NESTED_FENCE_CHANGED');
const repairedBaseline=baseline.replace(nested,nested.replace('```html\n',''));
const candidate=repairedBaseline+suffix;
await writeFile(`${dir}/candidate-opening.txt`,candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(`${dir}/missing-components-staging.json`,JSON.stringify({observedAt:new Date().toISOString(),rank:26,baselineSha256:hash(baseline),candidateSha256:hash(candidate),originalBaselineCharacters:baseline.length,removedNestedFenceCharacters:8,allOtherOriginalCharactersPreserved:true,missingPublicBlocks:3,sourceNpcImages:4,ownerUiSaved:false,fullFidelityAccepted:false},null,2));
console.log(JSON.stringify({candidateCharacters:candidate.length,sourceBlocks:3,remoteWrites:0}));
