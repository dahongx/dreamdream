/** Public beauty-only final candidates; hash bound. No account, model or network. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractNativeImageSidebars} from '../src/lib/opening/native-image-sidebar';
import {extractComposerPrefixes} from '../src/lib/opening/composer-prefix';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=root+'/candidate-composition-preview';
const audit=JSON.parse(await readFile(root+'/candidate-baseline-audit-20261031.json','utf8'));
const receipts=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8'));
if(audit.valid!==19||audit.invalid||audit.rows.length!==19)throw Error('CANDIDATE_BASELINES_NOT_VALID');
const cases=[];
for(const row of audit.rows){
 if(row.rank===37||!/^rule-repairs\/\d+\/[\w-]+\/candidate-opening\.txt$/.test(row.finalCandidate))throw Error('UNSAFE_CANDIDATE_PATH');
 const receipt=receipts.rows.find((r:{rank:number})=>r.rank===row.rank);if(!receipt?.imported)throw Error('IMPORT_RECEIPT_MISSING');
 const content=await readFile(root+'/'+row.finalCandidate,'utf8'),sha256=createHash('sha256').update(content).digest('hex');if(sha256!==row.finalSha256)throw Error('FINAL_CANDIDATE_HASH_CHANGED_'+row.rank);
 const native=extractNativeImageSidebars(content).sidebars,prefixes=extractComposerPrefixes(content).specs;
 cases.push({rank:row.rank,name:receipt.name,evidence:row.finalCandidate,sha256,content,native:native.map(s=>({variant:s.variant??'image-sidebar',documents:s.documents.length})),prefixes:prefixes.map(p=>({id:p.id})),scope:'Final public beauty candidate composition, not private character data'});
}
await mkdir(dir,{recursive:true});await writeFile(dir+'/fixtures.json',JSON.stringify({observedAt:new Date().toISOString(),cases},null,2));
const report={observedAt:new Date().toISOString(),cases:cases.map(({content,...row})=>row),elapsedMs:performance.now()-tick,agentNetMs:null,modelCalls:0,TESTBuildStarted:false,deployed:false,fullFidelityAccepted:false};await writeFile(dir+'/staging-report.json',JSON.stringify(report,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({kind:'candidate-composition-staging-process-wall',...report,cases:cases.length})+'\n');console.log(JSON.stringify({cases:cases.length,native:cases.map(c=>({rank:c.rank,native:c.native,prefixes:c.prefixes}))}));
