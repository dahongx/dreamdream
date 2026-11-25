/** A bounded box-model repair; public display content and author program stay intact. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {adaptMufySourceFrame} from '../src/lib/import/mufy-source-rule-envelope';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/21/inline-instruction-width';
const evidence=JSON.parse(await readFile(root+'/final-acceptance/21/source-public-component-inventory.json','utf8'));
const original=evidence.roots[0].frames[8].html as string;
const baseline=await readFile(root+'/rule-repairs/21/native-page-controls/candidate-opening.txt','utf8');
const needle='details.censy-glass-fold-v2 > summary {',replacement=needle+'\n    box-sizing: border-box;';
if(original.split(needle).length!==2||baseline.split(needle).length!==2)throw Error('UNIQUE_PUBLIC_SUMMARY_REQUIRED');
const html=adaptMufySourceFrame(original.replace(needle,replacement)),candidate=baseline.replace(needle,replacement);
if(candidate.replace(replacement,needle)!==baseline)throw Error('UNRELATED_BYTES_CHANGED');
await mkdir(out,{recursive:true});await writeFile(out+'/frame.json',JSON.stringify({rank:21,html},null,2));await writeFile(out+'/candidate-opening.txt',candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof={rank:21,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,baselineSha256:hash(baseline),candidateSha256:hash(candidate),changedOnlySummaryBoxSizing:true,authorProgramChanged:false,ownerUiSaved:false,baselineRequiresFreshOwnerUiVerification:true,buildStarted:false,fullFidelityAccepted:false};
await writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
