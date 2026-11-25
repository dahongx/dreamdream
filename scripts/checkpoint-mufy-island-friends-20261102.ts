/** Hash-bind actual TEST integration evidence; retain remaining acceptance gates. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028', tick=performance.now(),observedAt=new Date().toISOString();
const read=async(p:string)=>JSON.parse(await readFile(`${root}/${p}`,'utf8'));
const hash=async(p:string)=>({path:p,sha256:createHash('sha256').update(await readFile(`${root}/${p}`)).digest('hex')});
const tabsPath='final-acceptance/35/post-reviewed-runtime-image-island-tabs-20261102.json';
const mobilePath='final-acceptance/35/post-reviewed-runtime-image-island-mobile-20261102.json';
const sourcePath='final-acceptance/35/image-island-public-source-20261031.json';
const tabs=await read(tabsPath),mobile=await read(mobilePath),source=await read(sourcePath);
const originals=[...source.publicWidget.avatars,...source.publicWidget.emojis].map((r:{src:string})=>r.src);
if(originals.length!==25||tabs.rows.length!==3||mobile.rows.length!==3||mobile.restored.viewport!==390||!mobile.restored.collapsed||mobile.restored.contentHidden!=='true')throw Error('ISLAND_UI_PROOF_INCOMPLETE');
for(const row of tabs.rows){
 if(JSON.stringify(row.state.images.map((i:{src:string})=>i.src))!==JSON.stringify(originals)||!row.state.images.every((i:{complete:boolean;width:number})=>i.complete&&i.width>0)||row.state.rect.width!==320||row.state.rect.height!==480)throw Error('ORIGINAL_IMAGE_MISMATCH');
 if(row.state.tabs.filter((t:{selected:string})=>t.selected==='true').length!==1||!row.state.tabs.some((t:{text:string;selected:string})=>t.text===row.label&&t.selected==='true'))throw Error('TAB_SELECTION_MISMATCH');
}
if(!mobile.rows.every((r:{selected:string})=>r.selected==='true'))throw Error('MOBILE_TAB_MISMATCH');
const friendsPath='final-acceptance/41/post-reviewed-runtime-friends-settled-20261102.json',friends=await read(friendsPath);
if(friends.rows.length!==3||!friends.rows.every((r:{name:string;visibleName:string;nameExact:boolean})=>r.nameExact&&r.name===r.visibleName))throw Error('FRIEND_HEADING_MISMATCH');
const updates=[{rank:35,index:4,reason:'Reviewed owner candidate and runtime now deployed. Actual TEST desktop and390x844 mobile switch all three tabs;320x480 expanded shell,25 original URLs equal prior source inventory and all decode; music stays unstarted. Mobile close restores collapsed state and music tab. TEST clipboard, external audio playback and physical touch remain unverified; previous local copy proof retained separately.',proofs:[await hash(tabsPath),await hash(mobilePath),await hash(sourcePath)]},{rank:41,index:6,reason:'Reviewed owner candidate and runtime now deployed. Actual TEST friend fold opens and all three selectors update the profile heading/body after the original timed transition. Initial immediate previous-body reads preserved separately; no stale-body defect inferred from transition alone. Restored 黄镜旻 and closed fold. Complete source-body/style/mobile correspondence still requires separate verification; no whole-card certification.',proofs:[await hash(friendsPath),await hash('final-acceptance/41/post-reviewed-runtime-friends-20261102.json')]}];
for(const update of updates){const path=`final-acceptance/${update.rank}/component-ui-mapping.json`,mapping=await read(path);const row=mapping.rows.find((r:{sourceIndex:number})=>r.sourceIndex===update.index);if(!row)throw Error('MAPPING_MISSING');row.postRuntimeFollowup={observedAt,previousReason:row.reason,evidence:update.proofs};row.reason=update.reason;row.targetUiVerified=true;row.fidelityVerified=false;mapping.observedAt=observedAt;await writeFile(`${root}/${path}`,JSON.stringify(mapping,null,2));}
const report={observedAt,island35:{sourceOriginalUrlsExact:25,actualDecoded:25,desktopTabs:3,mobileTabs:3,mobileWidth:390,closed:true,mediaPlaybackAccepted:false,clipboardAccepted:false},friends41:{actualSelectedProfiles:3,settledHeadingsExact:true,sourceBodyComparisonAccepted:false},updates,fullFidelityAccepted:0,agentNetMs:null};
const textProofPath='final-acceptance/41/friends-source-test-text-20261102.json';
const paintProofPath='final-acceptance/41/friends-source-test-paint-20261102.json';
try {
 const textProof=await read(textProofPath),paintProof=await read(paintProofPath);
 if(textProof.rows.length!==3||!textProof.rows.every((r:{sourceText:string;targetText:string;textExact:boolean})=>r.textExact&&r.sourceText===r.targetText)||paintProof.rows.length!==3||!paintProof.rows.every((r:{exact:boolean})=>r.exact))throw Error('SOURCE_FRIEND_PROOF_INCOMPLETE');
 report.friends41.sourceBodyComparisonAccepted=true;
 Object.assign(report.friends41,{textEvidence:await hash(textProofPath),sampledPaintEvidence:await hash(paintProofPath),mobileAttemptEvidence:await hash('final-acceptance/41/friends-mobile-attempt-20261102.json'),mobileAccepted:false});
 const path='final-acceptance/41/component-ui-mapping.json',mapping=await read(path);
 const row=mapping.rows.find((r:{sourceIndex:number})=>r.sourceIndex===6);
 row.sourceBodyFollowup={observedAt,textEvidence:await hash(textProofPath),sampledPaintEvidence:await hash(paintProofPath)};
 row.reason='Reviewed owner candidate and runtime deployed. Actual source and TEST all three settled friend headings and complete bodies match exactly; sampled header/name/list font,color,background,shadow,radius match. Original timed transition verified without misclassifying immediate old-body samples. Both restored first profile and closed. TEST mobile remains unaccepted: first override affected source; fresh target navigation returned ERR_HTTP_RESPONSE_CODE_FAILURE. Physical touch and complete descendant paint/glyphs not certified.';
 await writeFile(`${root}/${path}`,JSON.stringify(mapping,null,2));
} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
await writeFile(`${root}/island-friends-integration-followup-20261102.json`,JSON.stringify(report,null,2));
for(const file of ['qa-progress.json','continuation-next-20261031.json']){const data=await read(file);data.observedAt=observedAt;data.islandFriendsFollowup={evidence:'island-friends-integration-followup-20261102.json',fullFidelityAccepted:false};if(file.startsWith('continuation'))data.currentNextAction='Do not repeat rank49 completed22 command draft checks, mode cycle/group folds or rank35 actual three-tab mobile/desktop and25 original image decode. Rank41 three complete source/TEST friend bodies and sampled paint now match; target mobile remains pending after one fresh navigation HTTP error. Continue other explicit gates without rebuilding unchanged runtime or deploying unverified clipboard candidate.';if(report.friends41.sourceBodyComparisonAccepted)data.sourceLogin={status:'recovered',evidence:'source-auth-recovered-20261102.json',role:'谢闽',allSiteClaim:false};await writeFile(`${root}/${file}`,JSON.stringify(data,null,2));}
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'island-friends-proof-reconciliation-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null})+'\n');
console.log(JSON.stringify({originalUrlsMatched:25,friendProfilesSwitched:3,fullFidelityAccepted:0}));
