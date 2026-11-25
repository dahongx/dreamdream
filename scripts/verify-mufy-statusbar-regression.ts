/** Offline verification of the exact user-reported defects, not a replacement
 * for complete five-card source fidelity acceptance. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rendererFingerprint} from './mufy-renderer-fingerprint.js';
const root='logs/mufy-profiles/full-20261013/pilot-5/statusbar-regression-20261021';
const deployment=JSON.parse(await readFile('logs/mufy-profiles/full-20261013/pilot-5/statusbar-20261021041243056.json','utf8'));
const evidence:Array<{path:string;sha256:string}>=[];
async function artifact(name:string){const bytes=await readFile(`${root}/${name}`);evidence.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex')});return bytes;}
async function json(name:string){const r=JSON.parse((await artifact(name)).toString());if(Date.parse(r.observedAt)<Date.parse(deployment.finishedAt))throw Error('STALE:'+name);return r;}
function requireThat(value:boolean,reason:string){if(!value)throw Error(reason);}
const alignment=[];
for(const key of ['qyn','zys'])for(const width of [390,1280]){
 const r=await json(`${key}-${width}-collapsed.json`);
 requireThat(r.width===width&&r.folds.length===3,'THREE_FOLDS_REQUIRED');
 requireThat(r.folds.every((f:{open:boolean;x:number;width:number;summaryX:number})=>!f.open&&f.width>100&&Math.abs(f.x-r.folds[0].x)<1&&Math.abs(f.width-r.folds[0].width)<1&&Math.abs(f.summaryX-r.folds[0].summaryX)<1),'COLLAPSED_ALIGNMENT_FAILED');
 await artifact(`${key}-${width}-collapsed.jpg`);alignment.push({key,width,ok:true});
}
for(const width of [390,1280]){
 const skin=await json(`fml-${width}-state-skin.json`);
 requireThat(skin.rows.length===3&&skin.rows.every((r:{open:boolean;color:string;bg:string;padding:string;border:string})=>!r.open&&r.color==='rgb(165, 224, 208)'&&r.bg==='rgba(0, 0, 0, 0.3)'&&r.padding==='12px 16px'&&!r.border.startsWith('0px none')),'SOURCE_STATE_SKIN_MISSING');
 requireThat(skin.inlineFire.length===1&&skin.inlineFire[0].display==='none','DUPLICATE_INLINE_FIRE');
 const scroll=await json(`fml-${width}-fixed-scroll.json`);
 requireThat(Math.abs(scroll.before.scrollTop-scroll.after.scrollTop)>100,'ACTUAL_SCROLL_REQUIRED');
 requireThat(scroll.before.position==='fixed'&&scroll.after.position==='fixed','FIXED_POSITION_REQUIRED');
 requireThat(Math.abs(scroll.before.rect.x-scroll.after.rect.x)<1&&Math.abs(scroll.before.rect.y-scroll.after.rect.y)<1&&scroll.after.rect.right===width,'VIEWPORT_ANCHOR_MOVED');
 await artifact(`fml-${width}-state-expanded.jpg`);await artifact(`fml-${width}-fire-open.jpg`);
}
for(const [i,f]of deployment.files.entries())requireThat(createHash('sha256').update(await readFile(f)).digest('hex')===deployment.candidateHashes[i],'LOCAL_SOURCE_DIFFERS_FROM_DEPLOYED:'+f);
const report={version:1,scope:'user-reported-statusbar-regressions-only',generatedAt:new Date().toISOString(),passed:true,rendererSha256:await rendererFingerprint(process.cwd()),deployment:'../statusbar-20261021041243056.json',alignment,evidence,allFiveFullyAccepted:false,policy:'Original release acceptance remains revoked. This targeted repair report does not relabel the old 160 observations or certify unobserved histories.',databaseOperations:0,productionWrites:0};
await writeFile(`${root}/regression-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
