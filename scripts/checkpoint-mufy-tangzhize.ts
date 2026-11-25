/** Local evidence merge; does not build, deploy or promote card acceptance. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const read=async(p:string)=>JSON.parse(await readFile(root+'/'+p,'utf8'));
const qa=await read('qa-progress.json'),controls=await read('final-acceptance/32/profile-and-state-controls-check.json'),mobile=await read('final-acceptance/32/mobile-state-check.json'),ghost=await read('final-acceptance/32/ghost-instructions-local-ui-check.json'),candidate=await read('rule-repairs/32/ghost-instructions/candidate-proof.json');
if(controls.profileFolds.length!==3||controls.states.length!==9||!controls.states.every((s:{before:boolean;during:{open:boolean};restored:boolean})=>s.before!==s.during.open&&s.restored)||!mobile.folds.every((f:{open:boolean;client:number;scroll:number})=>f.open&&f.client===f.scroll)||!ghost.desktop.escapeClosed||ghost.mobile.open!=='true'||!candidate.allNonDrawerCharactersPreserved)throw Error('TANGZHIZE_CHECK_INCOMPLETE');
const row=qa.rows.find((r:{rank:number})=>r.rank===32);if(!row||qa.imported!==28||qa.held!==2||qa.fullFidelityAccepted!==0)throw Error('BATCH_COUNTS_CHANGED');
row.targetedControlFollowup={observedAt:new Date().toISOString(),profileFolds:3,profileTextsMatched:controls.profileFolds.every((f:{source:{text:string};target:{text:string}})=>f.source.text===f.target.text),savedReplyAndOpeningFolds:9,mobileNoOverflow:true,musicPlaybackAccepted:false,musicEvidence:'final-acceptance/32/music-public-ui-check.json',nativeGhostCandidate:{localUiPassed:true,sourceListCount:5,noScripts:true,noHostRpc:true,parentRepaintStable:true,firstInputClickPass:true,ownerUiSaved:false,deployed:false,evidence:'final-acceptance/32/ghost-instructions-local-ui-check.json'},fullFidelityAccepted:false};
qa.observedAt=row.targetedControlFollowup.observedAt;await writeFile(root+'/qa-progress.json',JSON.stringify(qa,null,2)+'\n');
const repair27=await read('final-acceptance/27/favorability-owner-ui-repair.json');
if(!repair27.ownerReloadMatchesCandidate||!repair27.repairedFolds.every((f:{client:number;scroll:number})=>f.client===f.scroll))throw Error('FAVORABILITY_REPAIR_NOT_VERIFIED');
qa.rows.find((r:{rank:number})=>r.rank===27).targetedControlFollowup={observedAt:repair27.observedAt,sourceProfilePanelsMatched:4,savedStateControls:6,mobileExpandedFoldsNoOverflow:6,themeOwnerUiSaved:true,ownerReloadVerified:true,originalThemePreserved:true,musicPlaybackAccepted:false,evidence:['final-acceptance/27/controls-before-repair.json','final-acceptance/27/favorability-owner-ui-repair.json'],fullFidelityAccepted:false};
await writeFile(root+'/qa-progress.json',JSON.stringify(qa,null,2)+'\n');
const timing=await readFile(root+'/timing-runs.jsonl','utf8'),id='tangzhize-mobile-'+mobile.observedAt;
if(!timing.includes(id))await appendFile(root+'/timing-runs.jsonl',JSON.stringify({id,rank:32,observedAt:mobile.observedAt,elapsedMs:mobile.elapsedMs,kind:'browser-operation-wall-not-agent-net',agentNetMs:null})+'\n');
console.log(JSON.stringify({rank:32,profileFolds:3,stateControls:9,ghostLocalOnly:true,fullFidelityAccepted:0,buildStarted:false}));
