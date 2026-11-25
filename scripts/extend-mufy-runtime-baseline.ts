/** Append missing integration source baselines; TEST-only read, no remote writes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-consolidated-20261029',manifest=JSON.parse(await readFile(dir+'/baseline-manifest.json','utf8'));
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'pipe'});const[o,e,c]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(c)throw Error('TEST_SOURCE_READ_FAILED:'+e.slice(0,120));return o;}
const startedAt=new Date().toISOString(),tick=performance.now();
if((await read('cd /root/projects/yearn-chat && docker compose port app 3000')).trim()!=='0.0.0.0:8091'||(await read(`docker inspect ${manifest.container} --format '{{.Image}}'`)).trim()!==manifest.image)throw Error('TEST_BASELINE_CHANGED');
const additions=[];
for(const path of ['src/components/chat/ChatRoom.tsx','src/lib/import/mufy-source-rule-envelope.ts']){
 const source=await read(`cd /root/projects/yearn-chat && cat ${path}`),sha256=createHash('sha256').update(source).digest('hex'),prior=manifest.entries.find((x:{path:string})=>x.path===path);
 if(prior){if(prior.sha256!==sha256)throw Error('EXISTING_INTEGRATION_BASELINE_CHANGED:'+path);continue;}
 const file=dir+'/baseline/'+path;await mkdir(dirname(file),{recursive:true});await writeFile(file,source);const entry={path,sha256};manifest.entries.push(entry);additions.push(entry);
}
const dependencyPath='src/lib/ai/model-status-events.ts',dependencySource=await read(`cd /root/projects/yearn-chat && cat ${dependencyPath}`),dependencyHash=createHash('sha256').update(dependencySource).digest('hex');
await mkdir(dirname(dir+'/baseline-dependencies/'+dependencyPath),{recursive:true});await writeFile(dir+'/baseline-dependencies/'+dependencyPath,dependencySource);
manifest.readOnlyDependencies=[{path:dependencyPath,sha256:dependencyHash}];
if((await read(`docker inspect ${manifest.container} --format '{{.Image}}'`)).trim()!==manifest.image)throw Error('TEST_CHANGED_DURING_READ');
const proof={startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'ssh-workspace-source-read-wall-not-agent-net',agentNetMs:null,additions,remoteWrites:0,buildStarted:false,deployed:false};manifest.integrationBaselineExtension=proof;
await writeFile(dir+'/baseline-manifest.json',JSON.stringify(manifest,null,2));await writeFile(dir+'/integration-baseline-extension.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
