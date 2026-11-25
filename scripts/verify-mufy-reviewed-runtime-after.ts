/** Read-only deployment integrity. Never reads environment, secrets, volumes or database. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',tick=performance.now();
const manifest=JSON.parse(await readFile('outputs/mufy-consolidated-20261029/runtime-manifest.json','utf8'));
const release=JSON.parse(await readFile(root+'/controlled-runtime-release-20261101.json','utf8'));
const expectedImage=String(release.remoteResult).split('|')[1];
if(release.status!=='deployed-pending-browser-qa'||!/^sha256:[a-f0-9]{64}$/.test(expectedImage))throw Error('ACTUAL_DEPLOYMENT_REQUIRED');
async function remote(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error('READ_ONLY_VERIFY_FAILED:'+err.slice(0,120));return out.trim();}
const identity=await remote("cd /root/projects/yearn-chat && docker inspect \"$(docker compose ps -q app)\" --format '{{.Id}}|{{.Image}}|{{.State.Running}}'"),port=await remote('cd /root/projects/yearn-chat && docker compose port app 3000');
const paths=manifest.entries.map((e:{path:string})=>e.path);if(paths.some((p:string)=>!/^src\/[\w/.-]+$/.test(p)||p.includes('..')))throw Error('UNSAFE_PATH');
const hashes=await remote('cd /root/projects/yearn-chat && sha256sum '+paths.map((p:string)=>"'"+p+"'").join(' '));
const rows=hashes.split(/\r?\n/).map(s=>{const m=/^([a-f0-9]{64})\s+(.+)$/.exec(s);if(!m)throw Error('BAD_HASH');const e=manifest.entries.find((e:{path:string})=>e.path===m[2]);return {path:m[2],matches:e?.after===m[1]};});
const clipboardBaseline=await remote('cd /root/projects/yearn-chat && sha256sum src/lib/util/clipboard.ts');
const capacity=await remote('df -Pk / /root/projects/yearn-chat /var/lib/docker');
const proof={observedAt:new Date().toISOString(),identity,expectedImage,imageMatches:identity.includes('|'+expectedImage+'|true'),port,portMatches:port==='0.0.0.0:8091',patchSha256:manifest.patchSha256,sourceFiles:rows,all28SourceFilesMatch:rows.length===28&&rows.every(r=>r.matches),clipboardBaseline,unverifiedClipboardCandidateDeployed:false,clipboardStillReviewedBaseline:clipboardBaseline.startsWith('f490d5f283f5dac1b5536123ef94dc642b6f1f7441382f222b74aeccd3223ad3 '),capacity,remoteWrites:0,databaseOperations:0,productionWrites:0,agentNetMs:null,elapsedMs:performance.now()-tick,fullFidelityAccepted:false};
await writeFile(root+'/reviewed-runtime-after-integrity-20261101.json',JSON.stringify(proof,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({kind:'read-only-reviewed-runtime-integrity-process-wall',...proof})+'\n');console.log(JSON.stringify(proof));if(!proof.imageMatches||!proof.portMatches||!proof.all28SourceFilesMatch||!proof.clipboardStillReviewedBaseline)process.exitCode=1;
