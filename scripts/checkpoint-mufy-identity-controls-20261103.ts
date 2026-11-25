import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now(),observedAt=new Date().toISOString();
const read=async(p:string)=>JSON.parse(await readFile(`${root}/${p}`,'utf8'));
const layout=await read('final-acceptance/26/quick-symbol-local-responsive-20261103.json'),epi=await read('final-acceptance/26/epilogue-post-deploy-20261103.json');
if(layout.rows.length!==3||!layout.rows.every((r:{viewport:number;overflow:boolean;panel:{right:number};composer:{right:number}})=>!r.overflow&&Math.abs(r.composer.right-r.panel.right-10)<1)||layout.draftProof.value!==layout.expectedDraft||layout.draftProof.sends!=='发送次数：0')throw Error('LAYOUT_OR_DRAFT_PROOF_FAILED');
if(!epi.textExact||!epi.samplesExact)throw Error('EPILOGUE_SOURCE_COMPARISON_FAILED');
const patch=await read('player-name-local-patch-20261103.json');
patch.status='local-unit-types-and-production-component-browser-checks-passed-not-deployed';patch.observedAt=observedAt;
patch.validation={...patch.validation,latestTests:{passed:10,failed:0,assertions:82,reportedProcessWallSeconds:55.38,agentNetMs:null},targetedProductionTypecheck:{exitCode:0,scope:'identity helper, presentation, source controls, toolbar, RegexIframe and imported dependencies; not full worktree'},uiDetector:{findings:0},realBrowserEvidence:['final-acceptance/26/player-name-real-renderer-local-20261103.json','final-acceptance/26/player-name-mobile-local-20261103.json','final-acceptance/26/quick-symbol-local-responsive-20261103.json']};
patch.remaining=['Whole-batch acceptance before build, as requested','Reviewed six-file TEST delta prepared from actual deployed image; not deployed','Actual 8091 ChatRoom mobile/desktop name and controls verification after future release'];
await writeFile(`${root}/player-name-local-patch-20261103.json`,JSON.stringify(patch,null,2));
const mapping=await read('final-acceptance/26/component-ui-mapping.json'),plate=mapping.rows.find((r:{sourceIndex:number})=>r.sourceIndex===3);
plate.postDeploymentTypography={evidence:'final-acceptance/26/epilogue-post-deploy-20261103.json',textExact:true,sampledPaintExact:true,bodyFontDeclarationExact:true,loadedGlyphProof:false};
plate.reason='Actual current source/TEST complete body text and ten sampled leaf font declarations,size,weight,color match; inherited body Noto Sans SC now matches after reviewed runtime deployment. Old integration-only font gate resolved. Literal mufyer is a separate known user defect, fixed and verified locally but not TEST deployed; no loaded-glyph or whole-card pass inferred.';
mapping.observedAt=observedAt;await writeFile(`${root}/final-acceptance/26/component-ui-mapping.json`,JSON.stringify(mapping,null,2));
for(const file of ['qa-progress.json','continuation-next-20261031.json']){
 const data=await read(file);data.observedAt=observedAt;data.identityControlsRepair={status:patch.status,evidence:'player-name-local-patch-20261103.json',candidateManifest:'../../../../outputs/mufy-identity-controls-20261103/manifest.json',deployed:false,fullFidelityAccepted:false};
 if(file.startsWith('continuation'))data.currentNextAction='Continue actual per-component source/TEST acceptance; stale font gates need new browser verification. Rank26 EPILOGUE current text and ten sampled typography/paint exact. User name and responsive shortcut repairs passed 10 tests/82 assertions, scoped production typecheck and real component browser checks; six-file delta prepared from current8091 baseline, no build or remote writes. Respect whole-batch-before-build and no unapproved Bili/clipboard changes. Five-hour scheduling still not created: tool unavailable.';
 await writeFile(`${root}/${file}`,JSON.stringify(data,null,2));
}
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'identity-controls-checkpoint-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,fullFidelityAccepted:0})+'\n');
console.log(JSON.stringify({localRepairVerified:true,targetTypographySampleExact:true,deployed:false,fullFidelityAccepted:0}));
