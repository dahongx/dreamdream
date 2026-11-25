import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {publicRootComponentCoverage,type PublicComponentDisposition} from '../src/lib/import/mufy-public-component-coverage';
const base='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now(),rows=[];
for(const rank of [21,22,25,26,28,29,35,43,45]){
 const path=`${base}/final-acceptance/${rank}/component-ui-mapping.json`;
 const mapping=JSON.parse(await readFile(path,'utf8')) as {rows:PublicComponentDisposition[];rootCoverage:unknown};
 const inventory=JSON.parse(await readFile(`${base}/final-acceptance/${rank}/source-public-component-inventory.json`,'utf8'));
 mapping.rootCoverage=publicRootComponentCoverage(inventory.roots,mapping.rows);
 await writeFile(path,JSON.stringify(mapping,null,2));
 rows.push({rank,additional: mapping.rows.filter(row=>row.sourceRootIndex===1).map(({sourceIndex,status,fidelityVerified})=>({sourceIndex,status,fidelityVerified})),coverage:mapping.rootCoverage});
}
const pending=rows.reduce((sum,row)=>sum+row.additional.filter(component=>component.status==='pending').length,0);
const observedAt=new Date().toISOString();
await writeFile(`${base}/public-root-coverage-after-classification-20261104.json`,JSON.stringify({observedAt,rows,pendingAdditionalFrames:pending,wholeCardAcceptanceChanged:false,sourceRoot0EvidencePreserved:true},null,2));
for(const file of ['qa-progress.json','continuation-next-20261031.json']){
 const path=`${base}/${file}`,value=JSON.parse(await readFile(path,'utf8'));
 value.publicRootCoverageFollowup.pendingAdditionalFrames=pending;
 value.publicRootCoverageFollowup.classificationEvidence='public-root-classification-20261104.json';
 value.publicRootCoverageFollowup.currentCoverageEvidence='public-root-coverage-after-classification-20261104.json';
 await writeFile(path,JSON.stringify(value,null,2));
}
await appendFile(`${base}/timing-runs.jsonl`,JSON.stringify({stepId:'reconcile-public-root-classification-20261104',observedAt,elapsedMs:performance.now()-tick,kind:'local-processing',agentNetMs:null,browserElapsedMs:0,serverWrites:0})+'\n');
console.log(JSON.stringify({cards:rows.length,pendingAdditionalFrames:pending}));
