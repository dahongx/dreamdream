/** Local artifact audit only; normal website UI is the persistence boundary. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {missingMufyDisclosureStyles} from '../src/lib/import/mufy-reply-style-coverage';
import {adaptMufyCompletionContract} from '../src/lib/import/mufy-completion-contract';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019',t=performance.now(),startedAt=new Date().toISOString();
const receipts=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8'));
const rows=[];
for(const r of receipts.rows as Array<{name:string,sourceKey:string,characterId:string}>){
 const prepared=JSON.parse(await readFile(`${root}/prepared/${r.sourceKey}/prepared.json`,'utf8'));
 const original=prepared.character.outputSetting??'';
 const currentCss=r.name==='崔稚玉'?await readFile(root+'/cuizhiyu-pack-style-after-repair.css','utf8'):prepared.beautification.globalCss??'';
 rows.push({name:r.name,characterId:r.characterId,missingDisclosureStyleClasses:missingMufyDisclosureStyles([prepared.character.opening??'',original],currentCss),requiresCompletionAdapter:adaptMufyCompletionContract(original)!==original,originalArchiveChanged:false});
}
const result={observedAt:new Date().toISOString(),kind:'advisory-selector-coverage-not-visual-failure',interpretation:'A class lacking its own CSS rule can inherit generic/ancestor styling; these candidates require existing source/target visual evidence, not invented CSS or automatic failure.',rows,sourceArchiveMutations:0};
await writeFile(root+'/five-contract-audit.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'five-card-contract-audit',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok'})+'\n');console.log(JSON.stringify(result));
