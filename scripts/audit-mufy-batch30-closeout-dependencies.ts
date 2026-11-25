/** Completion dependency audit. Reads explicit public-UI mappings only.
 * Never promotes a component/card from local tests or narrative classification. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const start=performance.now(),read=async(p:string)=>JSON.parse(await readFile(root+'/'+p,'utf8'));
const receipts=await read('normal-ui-import-receipts.json');
const rows=[];
for(const receipt of receipts.rows as {rank:number;name:string}[]){
 if(receipt.rank===37)continue; // Existing imported scope hold: no content inspection.
 const mapping=await read(`final-acceptance/${receipt.rank}/component-ui-mapping.json`);
 const components=[];
 for(const entry of mapping.rows as {sourceIndex:number;status:string;evidence:string;reason:string;targetUiVerified?:boolean;localUiVerified?:boolean;fidelityVerified?:boolean;mediaFollowupEvidence?:{path:string;sha256:string}}[]){
  if(!entry.evidence||entry.evidence.includes('..')||!entry.evidence.startsWith('final-acceptance/')&&!entry.evidence.startsWith('rule-repairs/'))throw Error('UNSAFE_OR_MISSING_PUBLIC_PROOF_PATH');
  const bytes=await readFile(root+'/'+entry.evidence);
  let mediaFollowupEvidence=null;if(entry.mediaFollowupEvidence){const followup=entry.mediaFollowupEvidence;if(!followup.path.startsWith('final-acceptance/')||followup.path.includes('..'))throw Error('UNSAFE_MEDIA_PROOF_PATH');const digest=createHash('sha256').update(await readFile(root+'/'+followup.path)).digest('hex');if(digest!==followup.sha256)throw Error('MEDIA_FOLLOWUP_HASH_CHANGED');mediaFollowupEvidence={path:followup.path,sha256:digest};}
  const pending=entry.status==='pending',reason=entry.reason??'';
  components.push({sourceIndex:entry.sourceIndex,status:entry.status,evidence:entry.evidence,evidenceSha256:createHash('sha256').update(bytes).digest('hex'),targetUiVerified:entry.targetUiVerified===true,localUiVerified:entry.localUiVerified===true,fidelityVerified:entry.fidelityVerified===true,
   dependencyFlags:pending?{TESTIntegration:/integrat|deploy|runtime|owner.saved|release/i.test(reason),mediaQualification:/audio|music|media|track|playback|video|decode|image|resource/i.test(reason),fontQualification:/font|typograph/i.test(reason),permission:/approval|permission|sandbox|restriction/i.test(reason)}:null,
   reason,mediaFollowupEvidence});
 }
 rows.push({rank:receipt.rank,name:receipt.name,components,pending:components.filter(c=>c.status==='pending').length,fullFidelityAccepted:false});
}
if(rows.length!==27||new Set(rows.map(r=>r.rank)).size!==27)throw Error('ELIGIBLE_LOCAL_BASE_MISMATCH');
const pending=rows.flatMap(r=>r.components.filter(c=>c.status==='pending').map(c=>({rank:r.rank,...c})));
const report={observedAt:new Date().toISOString(),eligibleCards:27,importedCards:28,notImportedHolds:2,importedScopeHoldRank:37,components:rows.reduce((n,r)=>n+r.components.length,0),pendingComponents:pending.length,dependencyCounts:{TESTIntegration:pending.filter(c=>c.dependencyFlags?.TESTIntegration).length,mediaQualification:pending.filter(c=>c.dependencyFlags?.mediaQualification).length,fontQualification:pending.filter(c=>c.dependencyFlags?.fontQualification).length,permission:pending.filter(c=>c.dependencyFlags?.permission).length},countsOverlap:true,classificationMeaning:'Reason routing only; not a new browser observation, not proof of playback, not pre-build or whole-card acceptance. Existing proof files are hash-bound. No source/private prompts inspected.',rows,wholeBatchPreflightComplete:false,fullFidelityAccepted:0,buildStarted:false,deployed:false,agentNetMs:null};
await writeFile(root+'/closeout-dependencies-20261031.json',JSON.stringify(report,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt:report.observedAt,kind:'offline-closeout-dependency-audit-process-wall',elapsedMs:performance.now()-start,agentNetMs:null,buildStarted:false,deployed:false})+'\n');
console.log(JSON.stringify({eligibleCards:27,components:report.components,pendingComponents:pending.length,dependencyCounts:report.dependencyCounts,wholeBatchPreflightComplete:false}));
