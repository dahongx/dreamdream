/** Record controller failures separately from website or role-card failures. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const observedAt=new Date().toISOString();
const proof={observedAt,browser:'Chrome',browserId:'4',userReportedExtensionReconnected:true,userRequestedFullBrowserRestart:true,restartConfirmed:false,
 observations:[
  {action:'blank-tab DOM control probe',outcome:'success',toolWallSeconds:11.5015},
  {action:'existing TEST tag binding after reported extension reconnect',outcome:'Debugger unattached',toolWallSeconds:2.8707},
  {action:'new TEST tab navigation after reconnect',outcome:'navigation returned; no UI acceptance',toolWallSeconds:45.2739},
  {action:'new TEST relation-image DOM check',outcome:'operation deadline before dispatch; no new result',toolWallSeconds:13.1703},
  {action:'new TEST screenshot check',outcome:'focus emulation command timeout; no image',toolWallSeconds:37.3324}
 ],targetUrl:'http://115.29.213.73:8091/chat/6a1adf13-8ff8-4726-9620-684b00e2a0af',
 diagnosis:'Browser control unavailable on loaded TEST page. These are controller errors, not proof that TEST or Mufy is unavailable. No role media/status acceptance from failed actions.',
 nextAction:'After user confirms full Chrome restart, inventory same selected Chrome and bind fresh existing TEST/Mufy tabs; verify one small visible read before resuming pending UI. Do not repeat passed local tests or reload owner candidates.',
 timingQualification:'Returned tool-call wall duration, not page-load duration and not Agent net labor. Never add restart/user waiting to Agent net labor.',agentNetMs:null,buildStarted:false,deployed:false,fullFidelityAccepted:false};
await writeFile(root+'/browser-control-recovery-pending-20261031.json',JSON.stringify(proof,null,2));
const path=root+'/continuation-next-20261031.json',cursor=JSON.parse(await readFile(path,'utf8'));
cursor.observedAt=observedAt;cursor.activeBrowserBlocker={evidence:'browser-control-recovery-pending-20261031.json',awaiting:'user full Chrome restart',sourceWebsiteFailure:false};
cursor.closeoutDependencies={evidence:'closeout-dependencies-20261031.json',countsOverlap:true,notAcceptance:true};
await writeFile(path,JSON.stringify(cursor,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({observedAt,kind:'browser-control-recovery-evidence-process-wall',elapsedMs:performance.now()-tick,agentNetMs:null,browserToolTimingsSeparate:true,userWaitingExcluded:true})+'\n');
console.log(JSON.stringify({controllerUnavailable:true,siteFailureProven:false,awaiting:'full Chrome restart',buildStarted:false}));
