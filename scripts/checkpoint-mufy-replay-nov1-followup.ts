/** Reconcile explicit new public evidence only; never mark cards or release gates passed. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const narrow=JSON.parse(await readFile(root+'/saved-reply-preview/narrow-layout-progress.json','utf8'));
const images=JSON.parse(await readFile(root+'/final-acceptance/24/sidebar-images-current-source-target-20261031.json','utf8'));
const test43=JSON.parse(await readFile(root+'/final-acceptance/43/current-test-reply-folds-20261101.json','utf8'));
const test29=JSON.parse(await readFile(root+'/final-acceptance/29/current-test-reply-folds-20261101.json','utf8'));
if(test43.final.some((open:boolean)=>open)||test43.actions.filter((action:{index?:number})=>action.index!==undefined).some((action:{index:number;states:{open:boolean}[]})=>!action.states[action.index].open))throw Error('TEST43_POINTER_OR_RESTORE_FAILED');
if(test29.scopes.length!==2||test29.scopes.some((scope:{error?:string;restored:boolean;actions:{open:boolean}[]})=>scope.error||!scope.restored||scope.actions.length!==2||scope.actions.some(action=>!action.open)))throw Error('TEST29_POINTER_OR_RESTORE_FAILED');
if(images.source.length!==29||images.target.length!==29||!images.sourceRolePresent||!images.targetRolePresent)throw Error('IMAGE_EVIDENCE_IDENTITY_OR_COUNT_MISMATCH');
let decoded=0,failed=0,pending=0;
if(images.finalPairs.length!==29)throw Error('FINAL_IMAGE_PAIRS_MISSING');
for(const pair of images.finalPairs){const a=pair.source,b=pair.target;if(!a.complete||!b.complete)pending++;else if(a.naturalWidth>0&&b.naturalWidth>0)decoded++;else if(a.naturalWidth===0&&b.naturalWidth===0)failed++;else throw Error('UNCLASSIFIED_IMAGE_PAIR');}
if(decoded!==12||failed!==17||pending!==0)throw Error('IMAGE_COUNTS_CHANGED_REQUIRES_REVIEW');
if(narrow.checked!==52||narrow.pending.length||narrow.issues.length)throw Error('NARROW_LAYOUT_NOT_COMPLETE_OR_HAS_ISSUES');
const now=new Date().toISOString();
for(const file of ['qa-progress.json','continuation-next-20261031.json']){
 const data=JSON.parse(await readFile(root+'/'+file,'utf8'));data.observedAt=now;
 data.savedPublicReplyNarrowLayout={evidence:'saved-reply-preview/narrow-layout-progress.json',checked:52,viewportWidth:390,issues:0,scope:'Initial collapsed local saved-reply layout only; expanded/source/media/TEST/touch acceptance excluded',fullFidelityAccepted:false};
 data.currentTestReplyPointerFollowup={ranks:[29,43],evidence:['final-acceptance/29/current-test-reply-folds-20261101.json','final-acceptance/43/current-test-reply-folds-20261101.json'],normalPointerOpenedAndRestored:8,keyboardFallbackUsed:false,localRapidMiss43NotReproducedOnTEST:true,scope:'Only four controls in rank29 two replies and four controls in rank43 second reply; not whole-card/source/mobile touch acceptance',fullFidelityAccepted:false};
 const current={observedAt:images.observedAt,evidence:'final-acceptance/24/sidebar-images-current-source-target-20261031.json',originalUrlsPaired:29,decodedBoth:decoded,completedButFailedBoth:failed,pending:0,substitutions:0,allImagesRestored:false,permanentOutageProven:false,fullFidelityAccepted:false};
 if(file==='qa-progress.json'){const row=data.rows.find((row:{rank:number})=>row.rank===24);row.currentOriginalImageReview=current;row.sidebarMenuFollowup.historicalImageQualification='Earlier 17 unconfirmed retained as original observation; currentOriginalImageReview supersedes current loading classification, not full-fidelity acceptance';}else data.currentOriginalImageReview24=current;
 await writeFile(root+'/'+file,JSON.stringify(data,null,2));
}
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt:now,kind:'public-replay-followup-reconciliation-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,buildStarted:false,deployed:false,modelCalls:0})+'\n');
console.log(JSON.stringify({savedReplyNarrowLayouts:52,rank24:{decoded,failed,pending},wholeBatchPreflightComplete:false}));
