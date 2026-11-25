/** Recover an observed static decoration; all other current owner bytes stay put. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {routeOpeningContentSplit} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=`${root}/final-acceptance/24`,out=`${root}/rule-repairs/24/native-ornament`;
const source=JSON.parse(await readFile(`${dir}/source-native-ornament.json`,'utf8'));
const receipt=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8')).rows.find((r:{rank:number})=>r.rank===24);
const baseline=await readFile(`${dir}/owner-opening-ornament-baseline.txt`,'utf8');
if(source.sourceUrl!==receipt.sourceUrl||source.styles.length!==1||!baseline.startsWith(source.html)||!source.html.includes('censy-hanging-icon'))throw Error('NATIVE_ORNAMENT_SOURCE_BINDING_FAILED');
const content=`<floating kind="ornament-right" pos="top-right" interactive="false"><style>${source.styles[0]}</style>${source.html}</floating>`;
const candidate=content+baseline.slice(source.html.length);
const routed=routeOpeningContentSplit(candidate,'ornament-24');
if(routed.floating.filter(w=>w.meta.kind==='ornament-right').length!==1||JSON.stringify(routed.inline).includes('censy-hanging-ornament'))throw Error('ORNAMENT_ROUTING_DUPLICATE');
await mkdir(out,{recursive:true});await writeFile(`${out}/source-program.json`,JSON.stringify({content},null,2));await writeFile(`${out}/candidate-opening.txt`,candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof={rank:24,observedAt:new Date().toISOString(),baselineSha256:hash(baseline),candidateSha256:hash(candidate),preservedSuffixCharacters:baseline.length-source.html.length,opaqueFrame:true,parentShim:false,pointerEvents:false,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};
await writeFile(`${out}/candidate-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
