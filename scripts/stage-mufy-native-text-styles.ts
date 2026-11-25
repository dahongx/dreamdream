/** A public host-native prefix needs its own author styles in an isolated frame. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const rank=Number(process.argv[2]);if(![28,46].includes(rank))throw Error('EXPLICIT_NATIVE_TEXT_RANK_REQUIRED');
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=`${root}/final-acceptance/${rank}`,out=`${root}/rule-repairs/${rank}/native-host-style`;
const source=JSON.parse(await readFile(`${dir}/source-native-text.json`,'utf8'));
const receipt=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8')).rows.find((r:{rank:number})=>r.rank===rank);
const baseline=await readFile(`${dir}/owner-opening-native-style-baseline.txt`,'utf8');
if(source.sourceUrl!==receipt.sourceUrl||source.styles.length!==1||!baseline.startsWith(source.html)||baseline.includes('data-nj-restored-native-host-style'))throw Error('NATIVE_HOST_STYLE_BINDING_FAILED');
if(/<script\b|<\/style/i.test(source.styles[0]))throw Error('INVALID_PUBLIC_STYLE_BLOCK');
const candidate=`<style data-nj-restored-native-host-style="${rank}">\n${source.styles[0]}\n</style>\n`+baseline;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await mkdir(out,{recursive:true});await writeFile(`${out}/candidate-opening.txt`,candidate);
const proof={rank,observedAt:new Date().toISOString(),sourceObservedAt:source.observedAt,sourceUrl:source.sourceUrl,baselineSha256:hash(baseline),candidateSha256:hash(candidate),originalCharacters:baseline.length,candidateCharacters:candidate.length,allOriginalCharactersPreserved:true,scope:'only host-native prefix author stylesheet, no theme injection into independent documents',ownerUiSaved:false,fullFidelityAccepted:false};
await writeFile(`${out}/candidate-proof.json`,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
