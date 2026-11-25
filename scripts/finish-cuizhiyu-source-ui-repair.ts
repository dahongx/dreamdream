/** Evidence-backed closeout of the reported source presentation regressions. */
import {readFile,writeFile,appendFile,stat} from 'node:fs/promises';
import {reviewMufyCompletion} from '../src/lib/import/mufy-completion-contract';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const startedAt=new Date().toISOString(),t=performance.now();
const json=async(f:string)=>JSON.parse(await readFile(root+'/'+f,'utf8'));
const live=await json('cuizhiyu-source-ui-real-reply-final.json'),stream=await json('cuizhiyu-streaming-sidebar-proof.json');
const eye=await json('cuizhiyu-source-ui-eye-second-observation.json'),deployment=await json('source-presentation-deploy.json'),regression=await json('source-presentation-regression.json');
const raw=reviewMufyCompletion(await readFile(root+'/cuizhiyu-source-ui-new-reply-raw.txt','utf8'));
if(!deployment.ok||!regression.ok||!raw.ok)throw Error('DEPLOYMENT_REGRESSION_AND_RAW_COMPLETION_REQUIRED');
const last=live.last[0];
if(live.viewport!==390||last.foldCount!==3||!last.avatars.length||last.avatars.some((a:{loaded:boolean,width:number})=>!a.loaded||a.width!==36)||last.visibleMarker||last.inlineMemory.some((d:string)=>d!=='none'))throw Error('MOBILE_SOURCE_PRESENTATION_PROOF_REQUIRED');
if(last.scene[0].padding!=='12px'||last.scene[0].width>390||!eye.animation.includes('Ks_Censy_Float_v2')||eye.transform===last.eyes[0].transform)throw Error('SCENE_AND_ACTUAL_ANIMATION_REQUIRED');
if(live.sidebar.length!==1||live.memory.open!==true||live.memory.protocolHidden!==true||!live.memory.titles[0].includes('2/15'))throw Error('LATEST_REPLY_MEMORY_REQUIRED');
if(!stream.streaming||stream.portal.length!==1||stream.portal[0].open!=='true')throw Error('STREAMING_SIDEBAR_CONTINUITY_REQUIRED');
for(const device of ['mobile','desktop']){
 const proof=await json(`cuizhiyu-source-ui-${device}-folds.json`);
 if(proof.length!==3||proof.some((p:{viewport:number,folds:{open:boolean,width:number}[]},i:number)=>p.folds.length!==3||p.folds.some(f=>f.open!==(i!==1)||f.width<=0||f.width>p.viewport)))throw Error('FOLD_INTERACTION_REQUIRED:'+device);
}
if((await stat(root+'/cuizhiyu-source-ui-final-mobile.png')).size<1000)throw Error('SCREENSHOT_REQUIRED');
const result={observedAt:new Date().toISOString(),ok:true,sceneStyled:true,eyeAnimationObserved:true,speechAvatarsVerified:true,memorySidebarVerified:true,visibleCompletionMarker:false,rawCompletionVerified:raw.ok,stage:'reported-source-ui-regressions-fixed',scope:'The five reported Cui presentation issues; not exhaustive source feature identity',liveNewRepliesThisRepair:1,liveReplyTotalLedger:15,sourcePublicCss:'cuizhiyu-additional-public-css-20261022.json',liveEvidence:'cuizhiyu-source-ui-real-reply-final.json',streamingEvidence:'cuizhiyu-streaming-sidebar-proof.json',screenshot:'cuizhiyu-source-ui-final-mobile.png',regression:'source-presentation-regression.json',deployment:'source-presentation-deploy.json',foldInteraction:'native summary keyboard Enter; coordinate-based automation did not reliably activate summaries',remainingReportedFindings:[],databaseCommands:0,productionWrites:0,historyMessageEdits:0,sourceArchiveChanges:0,fullSourceFidelityClosed:false};
await writeFile(root+'/cuizhiyu-source-ui-review.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'finish-reported-source-ui-regressions',kind:'compute',startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,status:'ok'})+'\n');
console.log(JSON.stringify(result));
