import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const began=performance.now();
const qa=JSON.parse(await readFile(root+'/qa-progress.json','utf8'));
const entries=[
 {rank:34,evidence:['remaining-folds-actual-20261107.json','relationship-images-qualified-20261107.json','mobile-final-layout-20261107.json'],scope:'Seven remaining opening folds open/close and exact public bodies; relationship tail portraits; final390 layout matches356px widths and220/266.667/491.281 heights.'},
 {rank:33,evidence:['player-post-release-20261107.json'],scope:'Published player content-box geometry source/target331.927x65.333 at390; no duplicate playback.'},
 {rank:40,evidence:['companion-expanded-post-release-20261107.json'],scope:'Published expanded first companion source/target356x481.333 and exact public body after transition settled.'},
 {rank:25,evidence:['navigation-autoclose-post-release-20261107.json'],scope:'Published top/bottom navigation both autoclose; target settled top0 / bottom6406; source top sample498.667 retained, not declared exact offset parity.'},
 {rank:42,evidence:['empty-wrapper-post-release-finding-20261107.json'],scope:'Actual five empty wrapper frames remain; narrow markerless-chain repair tested and test-only build in progress, not a passing browser result.'},
];
for(const entry of entries){
 const observations=[];
 for(const name of entry.evidence){const p=`final-acceptance/${entry.rank}/${name}`;const data=JSON.parse(await readFile(root+'/'+p,'utf8'));observations.push({path:p,observedAt:data.observedAt,elapsedMs:data.elapsedMs??null});}
 const row=qa.rows.find((r:{rank:number})=>r.rank===entry.rank);
 row.latestActualFollowup20261107={scope:entry.scope,evidence:observations,wholeCardAccepted:false};
}
qa.observedAt=new Date().toISOString();
await writeFile(root+'/qa-progress.json',JSON.stringify(qa,null,2));
const continuation=JSON.parse(await readFile(root+'/continuation-next-20261031.json','utf8'));
continuation.latestBrowserQa20261107={observedAt:qa.observedAt,actualPagesRestored:true,doNotRepeat:entries.filter(r=>r.rank!==42),remainingCandidate:'outputs/mufy-empty-wrapper-20261107/manifest.json',buildSession:14936,wholeBatchAccepted:false,sourceTab:1586146824,targetTab:1586146798,tabsMarkedForUnfinishedWorkflow:true};
await writeFile(root+'/continuation-next-20261031.json',JSON.stringify(continuation,null,2));
await writeFile('outputs/mufy-empty-wrapper-20261107/validation.json',JSON.stringify({observedAt:qa.observedAt,targetedWorkspace:{passed:67,failed:0,assertions:237},rebasedCandidate:{passed:2,failed:0,assertions:9},broaderPatternRun:{passed:518,failed:1,errors:1,note:'An initial path-pattern invocation also selected historical archived copies; not used as a passing release gate.'},candidateRebasedOntoExactLiveContent:true,databaseOperations:0,productionWrites:0,actualBrowserAfterReleaseRequired:true},null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt:qa.observedAt,phase:'local-qa-checkpoint-update',elapsedMs:performance.now()-began,browserElapsedStoredPerEvidence:true,buildWallExcludedFromNet:true})+'\n');
console.log(JSON.stringify({updatedRanks:entries.map(r=>r.rank),fullFidelityAccepted:qa.fullFidelityAccepted,computeElapsedMs:performance.now()-began}));
