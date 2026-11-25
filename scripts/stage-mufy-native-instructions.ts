/** Restore the source's native CSS-only details drawer without a duplicate. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {routeOpeningContentSplit,isSourceInstructionsSidebar} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=`${root}/final-acceptance/23`,out=`${root}/rule-repairs/23/native-instructions`;
const source=JSON.parse(await readFile(`${dir}/source-native-instructions.json`,'utf8'));
const baseline=await readFile(`${dir}/owner-opening-instructions-baseline.txt`,'utf8');
if(!source.sourceUrl.includes('roleId=0ef00336-1215-4b3b-a05a-8d91b84c7b44')||!isSourceInstructionsSidebar(source.html)||source.styles.length!==1||!baseline.startsWith(source.html))throw Error('SOURCE_NATIVE_INSTRUCTIONS_BINDING_FAILED');
const content=`<floating kind="details-right" pos="right-center" interactive="true"><style>${source.styles[0]}</style>${source.html}</floating>`;
const candidate=content+baseline.slice(source.html.length);
const routed=routeOpeningContentSplit(candidate,'instructions-23');
if(routed.floating.filter(w=>isSourceInstructionsSidebar(w.srcdoc)).length!==1||JSON.stringify(routed.inline).includes('censy-ins-container'))throw Error('INSTRUCTIONS_ROUTING_DUPLICATE');
await mkdir(out,{recursive:true});await writeFile(`${out}/source-program.json`,JSON.stringify({content},null,2));await writeFile(`${out}/candidate-opening.txt`,candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof={rank:23,observedAt:new Date().toISOString(),baselineSha256:hash(baseline),candidateSha256:hash(candidate),preservedSuffixCharacters:baseline.length-source.html.length,sourceStylesRestored:true,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};
await writeFile(`${out}/candidate-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
