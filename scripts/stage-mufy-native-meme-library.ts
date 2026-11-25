/** Restore the public host-styled drawer, without adding a second copy. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {routeOpeningContentSplit,isSourceMemeLibrary} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=`${root}/final-acceptance/30`,out=`${root}/rule-repairs/30/native-meme`;
const source=JSON.parse(await readFile(`${dir}/source-native-meme-library.json`,'utf8'));
const baseline=await readFile(`${dir}/owner-opening-meme-baseline.txt`,'utf8');
if(!source.sourceUrl.includes('roleId=5dfa2a55-0167-48af-8310-5c677db5809b')||!isSourceMemeLibrary(source.html)||source.styles.length!==1)throw Error('PUBLIC_MEME_BINDING_FAILED');
if(!baseline.startsWith(source.html)||baseline.indexOf(source.html,source.html.length)!==-1)throw Error('EXACT_CURRENT_OWNER_PREFIX_REQUIRED');
const content=`<floating kind="details-right" pos="right-center" interactive="true"><style>${source.styles[0]}</style>${source.html}</floating>`;
const candidate=content+baseline.slice(source.html.length);
const routed=routeOpeningContentSplit(candidate,'meme-30');
if(routed.floating.filter(w=>isSourceMemeLibrary(w.srcdoc)).length!==1||JSON.stringify(routed.inline).includes('meme-dock-mini'))throw Error('MEME_ROUTING_DUPLICATE');
await mkdir(out,{recursive:true});await writeFile(`${out}/source-program.json`,JSON.stringify({content},null,2));await writeFile(`${out}/candidate-opening.txt`,candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof={observedAt:new Date().toISOString(),baselineSha256:hash(baseline),candidateSha256:hash(candidate),preservedSuffixCharacters:baseline.length-source.html.length,sourceImages:(source.html.match(/<img\b/g)??[]).length,sourceStylesRestored:true,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};
await writeFile(`${out}/candidate-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
