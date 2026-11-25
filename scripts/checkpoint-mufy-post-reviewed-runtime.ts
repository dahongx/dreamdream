/** Actual owner-UI saves and loaded TEST renders; never upgrades them to full-card acceptance. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const read=async(p:string)=>JSON.parse(await readFile(root+'/'+p,'utf8'));
const release=await read('controlled-runtime-release-20261101.json');
if(release.status!=='deployed-pending-browser-qa')throw Error('ACTUAL_DEPLOYMENT_REQUIRED');
const candidates=await read('candidate-baseline-audit-20261031.json');
const saves=[];
for(const row of candidates.rows){const proof=await read(`final-acceptance/${row.rank}/reviewed-owner-runtime-save-20261101.json`);if(!proof.saved||proof.persistedSha256!==row.finalSha256||proof.candidateSha256!==row.finalSha256)throw Error('FRESH_OWNER_SAVE_NOT_VERIFIED_'+row.rank);saves.push({rank:row.rank,evidence:`final-acceptance/${row.rank}/reviewed-owner-runtime-save-20261101.json`,sha256:row.finalSha256});}
if(saves.length!==19||new Set(saves.map(r=>r.rank)).size!==19)throw Error('EXACT_19_SAVES_REQUIRED');
const qa=await read('qa-progress.json'),mobileAttempts=await read('post-reviewed-runtime-mobile-attempts-20261101.json');
const rows=[];
for(const row of qa.rows.filter((r:{rank:number})=>!new Set([31,37,50]).has(r.rank))){
 // A later driver timeout does not erase an earlier actually completed UI observation.
 const mobile=mobileAttempts.rows.filter((r:{rank:number;error?:string;issues:string[]})=>r.rank===row.rank&&!r.error&&!r.issues?.length).at(-1);
 const desktop=await read(`final-acceptance/${row.rank}/post-reviewed-runtime-desktop-20261101.json`);
 if(!mobile||desktop.error||desktop.issues?.length)throw Error('LOADED_RENDER_OBSERVATION_INCOMPLETE_'+row.rank);
 const mobileEvidence=`final-acceptance/${row.rank}/post-reviewed-runtime-mobile-qualified-20261101.json`;
 await writeFile(root+'/'+mobileEvidence,JSON.stringify({...mobile,qualification:'Latest successful completed public UI observation retained separately from driver-error attempts. Mount/layout observation only, not full interaction or fidelity.'},null,2));
 const desktopEvidence=`final-acceptance/${row.rank}/post-reviewed-runtime-desktop-20261101.json`;
 const owner=saves.find(r=>r.rank===row.rank);
 row.reviewedRuntimeIntegration={observedAt:desktop.finishedAt,runtimeReleaseEvidence:'controlled-runtime-release-20261101.json',ownerSave:owner??null,mobileEvidence,desktopEvidence,loadedMobileRenderObserved:true,loadedDesktopRenderObserved:true,nativeMountsObserved:desktop.native,qualification:'Mounts and outer layout verified; source pixel/complete interaction/media/generation gates remain separate.',fullFidelityAccepted:false};
 rows.push({rank:row.rank,name:row.name,ownerSave:owner??null,mobileEvidence,desktopEvidence,native:desktop.native,prefixCount:desktop.prefixCount,fullFidelityAccepted:false});
}
if(rows.length!==27||new Set(rows.map(r=>r.rank)).size!==27)throw Error('EXACT_27_ELIGIBLE_REQUIRED');
const report={observedAt:new Date().toISOString(),target:'115.29.213.73:8091',patchSha256:release.patchSha256,image:String(release.remoteResult).split('|')[1],ownerCandidatesSavedAndFreshRead:19,actualMobileLoadedRenders:27,actualDesktopLoadedRenders:27,heldRanks:[31,37,50],fullFidelityAccepted:0,rows,remaining:'Actual per-component interactions/style comparison and qualified original media/generation. Do not equate save, render or mount to whole-card acceptance.',agentNetMs:null};
await writeFile(root+'/post-reviewed-runtime-progress-20261101.json',JSON.stringify(report,null,2));
qa.observedAt=report.observedAt;qa.postReviewedRuntime={evidence:'post-reviewed-runtime-progress-20261101.json',ownerCandidatesSavedAndFreshRead:19,actualMobileLoadedRenders:27,actualDesktopLoadedRenders:27,fullFidelityAccepted:0};
await writeFile(root+'/qa-progress.json',JSON.stringify(qa,null,2));
const next=await read('continuation-next-20261031.json');next.observedAt=report.observedAt;next.postReviewedRuntime=qa.postReviewedRuntime;next.currentNextAction='Continue actual post-update interactions/style comparison; do not reapply 19 successful owner saves or rebuild unchanged patch. Qualified external media and generation remain unresolved. Bilibili security expansion still unapproved.';await writeFile(root+'/continuation-next-20261031.json',JSON.stringify(next,null,2));
try{
 const clipboard=await read('http-clipboard-followup-20261101.json');
 next.clipboardFollowup={evidence:'http-clipboard-followup-20261101.json',permissionRequested:clipboard.clipboardReadPermission.requested,permissionAnswered:clipboard.clipboardReadPermission.answerReceived,candidateDeployed:false,result:clipboard.result};
 next.currentNextAction='Await the specific temporary localhost clipboard-read authorization before that verification. Other public UI follow-up may continue. Never ship the unverified src/lib/util/clipboard.ts candidate, reapply19 successful owner saves or rebuild the unchanged reviewed patch. Bilibili expansion remains unapproved.';
 await writeFile(root+'/continuation-next-20261031.json',JSON.stringify(next,null,2));
 qa.clipboardFollowup=next.clipboardFollowup;await writeFile(root+'/qa-progress.json',JSON.stringify(qa,null,2));
}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt:report.observedAt,kind:'post-reviewed-runtime-checkpoint-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null})+'\n');
console.log(JSON.stringify({ownerSaves:saves.length,mobile:27,desktop:27,fullFidelityAccepted:0}));
