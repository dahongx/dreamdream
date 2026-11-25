import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now(),observedAt=new Date().toISOString();
const evidence='final-acceptance/44/black-box-model-diagnosis-20261103.json';
const proof=JSON.parse(await readFile(`${root}/${evidence}`,'utf8'));
if(proof.source.box!=='content-box'||proof.testBefore.box!=='border-box'||proof.localFixed.box!=='content-box'||proof.localFixed.rect.width<210)throw Error('ACTUAL_BOX_MODEL_EVIDENCE_MISSING');
const manifest=JSON.parse(await readFile('outputs/mufy-identity-controls-20261103/manifest.json','utf8'));
if(manifest.entries.length!==11||manifest.remoteWrites||manifest.buildStarted||manifest.deployed)throw Error('INVALID_PREPARED_DELTA');
const mapping=JSON.parse(await readFile(`${root}/final-acceptance/44/component-ui-mapping.json`,'utf8'));
const row=mapping.rows.find((r:{sourceIndex:number})=>r.sourceIndex===6);
row.reconciliationHistory=[...(row.reconciliationHistory??[]),{reconciledAt:observedAt,previous:{...row,reconciliationHistory:undefined}}];
Object.assign(row,{status:'pending',targetUiVerified:true,evidence,reason:'Actual TEST native sidebar exists and player loads. Source child content-box changed to border-box by two migration-owned mobile resets, shrinking outer width217 to179.5. Bounded local repair restores content-box/217.5 while preserving all author scripts/styles; tests2/7 assertions and production dependency typecheck pass. Subpixel width and font-height differences remain qualified; local media blocked, no playback certification. TEST release pending.',fidelityVerified:false});
mapping.observedAt=observedAt;await writeFile(`${root}/final-acceptance/44/component-ui-mapping.json`,JSON.stringify(mapping,null,2));
for(const file of ['qa-progress.json','continuation-next-20261031.json']){
 const d=JSON.parse(await readFile(`${root}/${file}`,'utf8'));d.observedAt=observedAt;
 d.blackPlayer44Followup={evidence,sourceBox:'content-box',testBox:'border-box',localFixedBox:'content-box',runtimeReleased:false,tests:{passed:2,failed:0,assertions:7},targetedProductionTypesPassed:true,uiDetectorFindings:0};
 d.currentRuntimeRepairCandidate={...d.currentRuntimeRepairCandidate,files:11,manifest:'outputs/mufy-identity-controls-20261103/manifest.json',basedOnImage:manifest.basedOnImage,buildStarted:false,deployed:false};
 if(file.startsWith('continuation'))d.currentNextAction='Continue remaining actual per-card source/TEST UI gates. Rank44 native sidebar actually integrated; bounded player content-box repair locally verified and eleven-file exact current TEST delta prepared. Whole-batch acceptance before build remains. Do not recertify local media playback: preview deliberately blocks media/connect and author onerror retries may change title. Both live players paused. Preserve successful298-frame CSS leak gate and rank38 owner repair. No database/production/security expansion.';
 await writeFile(`${root}/${file}`,JSON.stringify(d,null,2));
}
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'black-player-checkpoint-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,browserReadElapsedMs:proof.elapsedMs,buildStarted:false,deployed:false})+'\n');
console.log(JSON.stringify({rank:44,localBoxModelRepaired:true,runtimeFiles:11,fullCardAccepted:false}));
