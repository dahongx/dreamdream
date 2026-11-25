/** Only public beauty code already read through owner UI; no network or DB. */
import {readFile,writeFile,appendFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditCandidateHashChain,type CandidateHashStage} from '../src/lib/import/mufy-candidate-baseline';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',hash=(s:string)=>createHash('sha256').update(s).digest('hex'),read=async(p:string)=>JSON.parse(await readFile(root+'/'+p,'utf8'));
type StageFile={proof:string;candidate:string};
const s=(rank:number,dir:string,proof='candidate-proof.json'):StageFile=>({proof:`rule-repairs/${rank}/${dir}/${proof}`,candidate:`rule-repairs/${rank}/${dir}/candidate-opening.txt`});
const plans:{rank:number;stages:StageFile[]}[]=[
 {rank:21,stages:[s(21,'native-command-drawer'),s(21,'native-page-controls'),s(21,'inline-instruction-width','proof.json')]},
 {rank:22,stages:[s(22,'native-quick-symbols','proof.json'),s(22,'native-island-music','proof.json'),s(22,'native-capsule','proof.json')]},
 {rank:23,stages:[s(23,'native-instructions')]},{rank:24,stages:[s(24,'native-ornament')]},
 {rank:26,stages:[s(26,'native-page-controls','proof.json')]},
 {rank:30,stages:[s(30,'native-meme')]},{rank:32,stages:[s(32,'ghost-instructions')]},{rank:34,stages:[s(34,'native-pixel-music')]},{rank:36,stages:[s(36,'avatar-copy','owner-candidate-proof.json')]},
 {rank:35,stages:[s(35,'native-image-island')]},
 {rank:38,stages:[s(38,'native-zen-music'),s(38,'composer-prefix')]},
 {rank:41,stages:[{proof:'final-acceptance/41/mask-form-candidate-proof.json',candidate:'final-acceptance/41/mask-form-candidate-opening.txt'},s(41,'composer-prefix'),s(41,'native-static-music'),s(41,'native-heart-navigation'),s(41,'public-timeline')]},
 {rank:43,stages:[s(43,'fullscreen-story'),s(43,'missing-divider'),s(43,'native-multimodule-island'),s(43,'native-narrow-navigation')]},{rank:44,stages:[s(44,'native-black-sidebar'),s(44,'public-plate-font')]},{rank:45,stages:[s(45,'native-ins-music')]},
 {rank:46,stages:[s(46,'composer-prefix'),s(46,'native-cloud-music'),s(46,'fullscreen-profile')]},{rank:47,stages:[s(47,'native-sidebar')]},{rank:48,stages:[s(48,'native-music')]},{rank:49,stages:[s(49,'native-toolkit','opening-proof.json')]},
];
const rows=[];
const historicalCandidates=new Set(['22/missing-short-components','28/native-host-style','46/native-host-style','49/native-film-profile'].map(p=>'rule-repairs/'+p+'/candidate-opening.txt'));
const stagedCandidates=new Set(plans.flatMap(p=>p.stages.map(s=>s.candidate)));
const candidateFiles=(await readdir(root+'/rule-repairs',{recursive:true})).map(p=>'rule-repairs/'+p.replaceAll('\\','/')).filter(p=>p.endsWith('/candidate-opening.txt'));
const unaccountedCandidates=candidateFiles.filter(p=>!stagedCandidates.has(p)&&!historicalCandidates.has(p));
if(unaccountedCandidates.length)throw Error('UNACCOUNTED_CANDIDATE_FILES:'+unaccountedCandidates.join(','));
for(const plan of plans){
 const meta=await read(plan.rank===49?'final-acceptance/49/film-profile-owner-ui-save-20261031.json':`final-acceptance/${plan.rank}/owner-baseline-current-20261031.json`);
 const file=plan.rank===49?'final-acceptance/49/owner-opening-film-saved-20261031.txt':`final-acceptance/${plan.rank}/owner-opening-current-20261031.txt`,owner=await readFile(root+'/'+file,'utf8');
 if(!owner.length||hash(owner)!==meta.sha256||meta.characters!==owner.length||(plan.rank===49?(!meta.saved||!meta.observedAfterFreshNavigation):(!meta.codeEditorConfirmedByReturnToList||!meta.unrelatedComposerExcluded)))throw Error('OWNER_ARTIFACT_UNVERIFIED_'+plan.rank);
 const stages:CandidateHashStage[]=[];
 for(const step of plan.stages){const proof=await read(step.proof),candidate=await readFile(root+'/'+step.candidate,'utf8');
  // Rank 47 predates the common receipt field names. Normalize this one known
  // schema explicitly; missing fields elsewhere must still fail the guard.
  if(plan.rank===47&&proof.sourceKey!=='char_27af964e770887667873')throw Error('KNOWN_LEGACY_RECEIPT_REQUIRED');
  stages.push({id:step.proof,baselineSha256:plan.rank===47?proof.originalOpeningSha256:proof.baselineSha256,candidateSha256:plan.rank===47?proof.candidateOpeningSha256:proof.candidateSha256,actualCandidateSha256:hash(candidate)});}
 rows.push({rank:plan.rank,ownerObservedAt:meta.observedAt,ownerCharacters:owner.length,ownerSha256:hash(owner),stages,finalCandidate:plan.stages.at(-1)!.candidate,...auditCandidateHashChain(hash(owner),stages),ownerUiWrites:0,fullFidelityAccepted:false});
}
const result={observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'offline-baseline-and-candidate-chain-check',agentNetMs:null,candidates:rows.length,valid:rows.filter(r=>r.ok).length,invalid:rows.filter(r=>!r.ok).length,inventory:{candidateFiles:candidateFiles.length,unaccountedCandidates,historicalCandidates:[...historicalCandidates],historicalPolicy:'Preserved evidence only; never use historical candidates as release inputs. Current pending chains use fresh owner baselines.'},rows,buildStarted:false,deployed:false,wholeBatchPreflightComplete:false,fullFidelityAccepted:0};
await mkdir(root+'/candidate-baseline-audit-runs',{recursive:true});
try{const prior=await read('candidate-baseline-audit-20261031.json');if(typeof prior.observedAt==='string')await writeFile(root+'/candidate-baseline-audit-runs/'+prior.observedAt.replace(/[^0-9TZ-]/g,'-')+'.json',JSON.stringify(prior,null,2));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
await writeFile(root+'/candidate-baseline-audit-runs/'+result.observedAt.replace(/[:.]/g,'-')+'.json',JSON.stringify(result,null,2));
await writeFile(root+'/candidate-baseline-audit-20261031.json',JSON.stringify(result,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({id:'candidate-baseline-audit-'+result.observedAt,observedAt:result.observedAt,elapsedMs:result.elapsedMs,kind:result.kind,agentNetMs:null,valid:result.valid,invalid:result.invalid})+'\n');
console.log(JSON.stringify({candidates:result.candidates,valid:result.valid,invalid:result.invalid,failures:rows.filter(r=>!r.ok).map(r=>({rank:r.rank,issues:r.issues})),buildStarted:false,wholeBatchPreflightComplete:false}));if(result.invalid)process.exitCode=1;
