/** Merge actual public UI evidence without promoting an entire card. */
import {readFile, writeFile, appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028', tick=performance.now();
const read=async(p:string)=>JSON.parse(await readFile(`${root}/${p}`,'utf8'));
const proof=async(p:string)=>({path:p,sha256:createHash('sha256').update(await readFile(`${root}/${p}`)).digest('hex')});
const observedAt=new Date().toISOString();
const stylesPath='final-acceptance/43/visible-animation-styles-source-target-20261102.json';
const motionPath='final-acceptance/43/visible-animations-test-20261102.json';
const styles=await read(stylesPath), motion=await read(motionPath);
type StyleRow={sourceIndex:number;renderedTextExact:boolean;sampledStylesExact:boolean};
if(styles.rows.length!==2||!(styles.rows as StyleRow[]).every(r=>r.renderedTextExact&&r.sampledStylesExact)||!motion.rows.every((r:{motionObserved:boolean})=>r.motionObserved))throw Error('ACTUAL_ANIMATION_PROOF_INCOMPLETE');
const mappingPath='final-acceptance/43/component-ui-mapping.json', mapping=await read(mappingPath);
for(const row of mapping.rows as {sourceIndex:number;reason:string;postRuntimeFollowup?:unknown}[]){
 if(![1,2].includes(row.sourceIndex))continue;
 row.postRuntimeFollowup={observedAt,evidence:await proof(stylesPath),motionEvidence:await proof(motionPath),previousReason:row.reason,qualification:'Visible rendered text and sampled paint/font/animation parameters exact; actual changing opacity verified. Individual font glyph loading and full-card gates remain separate.'};
 row.reason='Reviewed runtime deployed. Actual visible TEST component has playing class and changing opacity; rendered text and sampled font/color/background/shadow/animation names,durations,iterations equal prior actual source playing-state observation. Earlier animation-none sample was outside equivalent visibility and does not prove regression. Remaining font qualification: individual loaded glyphs not independently verified. No whole-card certification.';
}
mapping.observedAt=observedAt;
await writeFile(`${root}/${mappingPath}`,JSON.stringify(mapping,null,2));
const commandsPath='final-acceptance/49/post-reviewed-runtime-command-draft-20261102.json',commands=await read(commandsPath);
if(new Set(commands.rows.map((r:{label:string})=>r.label)).size!==commands.rows.length||!commands.rows.every((r:{exact:boolean;actual:string;expected:string})=>r.exact&&r.actual===r.expected)||commands.messagesSent!==0)throw Error('COMMAND_PROOF_INVALID');
const report={observedAt,rank43:{visibleAnimations:2,renderedTextAndSampledStyleExact:2,evidence:await proof(stylesPath),motionEvidence:await proof(motionPath)},rank49:{requiredCommandDraftChecks:22,completed:commands.rows.length,remaining:22-commands.rows.length,evidence:await proof(commandsPath),finalDraftRestored:commands.finalDraftRestored===true,finalDraftQualification:commands.finalDraftRestored?'Actual empty draft verified after final command; no sends.':'Final draft inspection still required; do not send.',messagesSent:0,newModelRequests:0},connection:{chromeExtensionInstanceId:'db784410-6b15-4b26-bff7-0a605682d9c7',lastObservedBrowserId:'3',note:'After kernel reset Chrome/Edge numeric IDs swapped. Rediscover by family and extension instance; never assume numeric ID remains Chrome.',lastPageReadFailure:'Historical transient Debugger unattached; later actual command reads and clicks recovered',productOutageProven:false},fullFidelityAccepted:0,agentNetMs:null};
const modesPath='final-acceptance/49/post-reviewed-runtime-command-modes-20261102.json';
const groupsPath='final-acceptance/49/post-reviewed-runtime-command-groups-20261102.json';
const modes=await read(modesPath),groups=await read(groupsPath);
if(modes.rows.length!==4||!modes.rows.every((r:{exact:boolean})=>r.exact)||modes.rows.at(-1).mode!=='silence'||groups.rows.length!==5||!groups.rows.every((r:{closed:boolean;restored:boolean})=>r.closed&&r.restored))throw Error('MODE_GROUP_RESTORE_PROOF_INCOMPLETE');
Object.assign(report.rank49,{modeCycle:await proof(modesPath),groupsFoldRestore:await proof(groupsPath),restoredScreenshot:await proof('final-acceptance/49/command-check-restored-20261102.png')});
await writeFile(`${root}/actual-ui-followup-progress-20261102.json`,JSON.stringify(report,null,2));
const next=await read('continuation-next-20261031.json');
next.observedAt=observedAt;
next.actualUiFollowup={evidence:'actual-ui-followup-progress-20261102.json',visibleAnimations43:2,commandDraftChecks49:commands.rows.length,fullFidelityAccepted:0};
next.currentNextAction='Rank49 all22 public command draft insertions now exact; empty draft, original silence mode and five expanded groups restored. Do not repeat these checks. Continue rank35 actual native three-tab image island integration, then remaining toolkit drawing/media and other explicit interaction/media/font/generation gates. Rank43 visible animations proven. Do not rebuild unchanged patch or deploy unverified clipboard candidate.';
await writeFile(`${root}/continuation-next-20261031.json`,JSON.stringify(next,null,2));
const qa=await read('qa-progress.json');qa.observedAt=observedAt;qa.actualUiFollowup=next.actualUiFollowup;
await writeFile(`${root}/qa-progress.json`,JSON.stringify(qa,null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({observedAt,kind:'actual-ui-followup-checkpoint-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,browserTiming:'Separate per-observation evidence; process elapsed is not browser or agent net time'})+'\n');
console.log(JSON.stringify({visibleAnimations:2,commandsVerified:commands.rows.length,remainingCommands:22-commands.rows.length,fullFidelityAccepted:0}));
