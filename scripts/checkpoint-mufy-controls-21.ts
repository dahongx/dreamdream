/** Local evidence ledger only; no remote or model operation. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',read=async(p:string)=>JSON.parse(await readFile(root+'/'+p,'utf8'));
const qa=await read('qa-progress.json'),e=await read('final-acceptance/21/profile-music-controls-check.json'),c=await read('final-acceptance/21/command-drawer-local-ui-check.json'),stage=await read('rule-repairs/21/native-command-drawer/candidate-proof.json');
const runtimeSha256=createHash('sha256').update(await readFile('src/components/chat/MufyCommandDrawer.tsx')).digest('hex');
if(qa.imported!==28||qa.held!==2||qa.fullFidelityAccepted!==0||c.runtimeSha256!==runtimeSha256||c.finalReplay.length!==10||!c.finalReplay.every((x:{textEqual:boolean})=>x.textEqual)||c.finalRefresh.customRows!==1||c.finalRefresh.sendCount!=='0'||!c.escapeClosed||!c.outsideHeadingClosed||c.finalMobile.viewport.width!==c.finalMobile.viewport.scrollWidth||c.finalMobile.title.color!=='rgb(85, 85, 85)'||c.finalMobile.title.font!=='12px')throw Error('CURRENT_BROWSER_PROOF_REQUIRED');
const row=qa.rows.find((r:{rank:number})=>r.rank===21);
row.targetedControlFollowup={observedAt:c.observedAt,evidence:['final-acceptance/21/profile-music-controls-check.json','final-acceptance/21/command-drawer-local-ui-check.json'],profileFoldsMatched:6,relationshipCardsMatched:5,realMusicTracksObserved:2,remaining:[{sourceIndexes:[5],reason:'固定指令面板本地原生候选已验证，尚未写入TEST/部署。'},{sourceIndexes:[7],reason:'来源输入框旁三个快捷符号按钮仍待原生适配，不能与source5指令面板混算。'},{sourceIndexes:[9],reason:'独立回顶/到底按钮仍待原生适配。'}],resourceQualification:e.relationshipImageQualification,fullFidelityAccepted:false};
row.commandDrawerCandidate={evidence:'rule-repairs/21/native-command-drawer/candidate-proof.json',runtimeSha256,localUiVerified:true,commands:10,sourceStorageRead:false,authorProgramExecuted:false,ownerUiSaved:false,deployed:false,baselineRequiresFreshOwnerUiVerification:true,fullFidelityAccepted:false};
qa.observedAt=new Date().toISOString();await writeFile(root+'/qa-progress.json',JSON.stringify(qa,null,2)+'\n');
const old=await readFile(root+'/timing-runs.jsonl','utf8'),timings=[];
for(const [i,x]of [...e.steps,...e.mobile.regions,...c.steps].entries()){if(typeof x.elapsedMs==='number'){const id=`controls-21-${x.observedAt??e.mobile.observedAt}-${i}`;if(!old.includes(id))timings.push({id,rank:21,observedAt:x.observedAt??e.mobile.observedAt,elapsedMs:x.elapsedMs,kind:'browser-operation-wall-not-agent-net',agentNetMs:null});}}
const id=`command-stage-21-${stage.observedAt}`;if(!old.includes(id))timings.push({id,rank:21,observedAt:stage.observedAt,elapsedMs:stage.elapsedMs,kind:'local-process-wall-not-agent-net',agentNetMs:null});
if(timings.length)await appendFile(root+'/timing-runs.jsonl',timings.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({rank:21,newTimingSteps:timings.length,imported:28,held:2,fullFidelityAccepted:0,ownerUiWrites:0,buildStarted:false}));
