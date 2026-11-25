/** Evidence-only ledger. No model, DB, build, deploy, or owner data write. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',read=async(p:string)=>JSON.parse(await readFile(root+'/'+p,'utf8'));
const qa=await read('qa-progress.json'),hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const current={component:hash(await readFile('src/components/chat/MufyPrefixPanel.tsx')),core:hash(await readFile('src/lib/opening/composer-prefix.ts'))};
if(qa.imported!==28||qa.held!==2||qa.fullFidelityAccepted!==0)throw Error('BATCH_COUNTS_CHANGED');
const old=await readFile(root+'/timing-runs.jsonl','utf8'),timings=[];
for(const rank of [38,46]){
 const e=await read(`final-acceptance/${rank}/prefix-local-ui-check.json`),proof=await read(`rule-repairs/${rank}/composer-prefix/candidate-proof.json`),f=e.finalCandidate;
 if(f.runtimeSha256.component!==current.component||f.runtimeSha256.core!==current.core||f.fontStatus!=='loaded'||f.viewport.client!==f.viewport.scroll||f.panel.client!==f.panel.scroll||f.panel.fontSize!=='13px'||!proof.allOriginalCharactersPreserved||proof.ownerUiSaved)throw Error('PREFIX_CURRENT_PROOF_NOT_READY:'+rank);
 if(rank===38&&(e.finalManualSubmit.count!=='1'||e.finalScopeB.text!=='本地测试正文'||e.finalScopeA.text!==e.finalManualSubmit.text||e.finalUndo.modeAfterUndo!=='后缀嵌入'))throw Error('PREFIX_SCOPE_OR_UNDO_CHECK_FAILED');
 const row=qa.rows.find((r:{rank:number})=>r.rank===rank);row.composerPrefixCandidate={observedAt:f.observedAt,sourcePublicPresets:proof.publicPresets,localUiEvidence:`final-acceptance/${rank}/prefix-local-ui-check.json`,runtimeSha256:current,sourceStorageRead:false,ownPreferenceScope:'session',manualLocalSubmitOnly:true,modelCalls:0,fontLoaded:true,mobileWidth:390,ownerUiSaved:false,deployed:false,baselineRequiresFreshOwnerUiVerification:true,fullFidelityAccepted:false};
 if(row.targetedControlFollowup?.fixedPrefixComponent)row.targetedControlFollowup.fixedPrefixComponent.status='local-candidate-verified-awaiting-runtime-and-fresh-owner-ui';
 const t=e.mobile;if(typeof t?.elapsedMs==='number'){const id=`prefix-mobile-${rank}-${t.observedAt}`;if(!old.includes(id))timings.push({id,rank,observedAt:t.observedAt,elapsedMs:t.elapsedMs,kind:'browser-operation-wall-not-agent-net',agentNetMs:null});}
}
qa.observedAt=new Date().toISOString();await writeFile(root+'/qa-progress.json',JSON.stringify(qa,null,2)+'\n');if(timings.length)await appendFile(root+'/timing-runs.jsonl',timings.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({ranks:[38,46],newTimingSteps:timings.length,imported:28,held:2,fullFidelityAccepted:0,ownerUiWrites:0,buildStarted:false}));
