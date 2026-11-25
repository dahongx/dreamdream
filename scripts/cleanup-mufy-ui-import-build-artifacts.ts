/** Match untagged intermediates to this exact successful TEST build log. */
import {readFile,writeFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const reportName=process.argv.find(v=>v.startsWith('--report='))?.slice(9)??'ui-import-20261022042038463.json';
if(!/^ui-(?:import|native)-\d+\.json$/.test(reportName))throw Error('EXACT_TEST_REPORT_REQUIRED');
const report=JSON.parse(await readFile(root+'/'+reportName,'utf8'));
const outputPrefix=reportName.slice(0,-5);
if(!report.ok||report.databaseCommands!==0)throw Error('SUCCESSFUL_TEST_BUILD_REQUIRED');
const startedAt=new Date().toISOString(),t=performance.now();
async function run(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(exit)throw Error('TEST_COMMAND_FAILED:'+err.slice(0,300));return out.trim();}
if(await run('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const log=await run(`cat ${report.backup}/build.log`);
const builtIds=new Set([...log.matchAll(/^ ---> ([a-f0-9]{12})$/gm)].map(m=>m[1]));
const ids=(await run("docker image ls --filter dangling=true --no-trunc --format '{{.ID}}'")).split(/\r?\n/).filter(id=>/^sha256:[a-f0-9]{64}$/.test(id)&&builtIds.has(id.slice(7,19)));
const used=(await run("docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}'")).split(/\r?\n/);
const plan=[];
for(const id of ids){
 const meta=JSON.parse(await run(`docker image inspect ${id} --format '{"id":{{json .Id}},"tags":{{json .RepoTags}},"created":{{json .Created}},"workdir":{{json .Config.WorkingDir}},"layers":{{json .RootFS.Layers}}}'`));
 if(meta.tags?.length||used.includes(id)||meta.workdir!=='/app'||Date.parse(meta.created)<Date.parse(report.startedAt)||Date.parse(meta.created)>Date.parse(report.finishedAt))continue;
 plan.push(meta);
}
plan.sort((a,b)=>b.layers.length-a.layers.length);
const before=await run('df -Pk /');
await writeFile(root+'/'+outputPrefix+'-build-cleanup-plan.json',JSON.stringify({startedAt,plan,before,buildReport:reportName,policy:'Exact image IDs from successful TEST build log, within its time window. Tagged images and container images protected.'},null,2));
if(!process.argv.includes('--execute')){console.log({planned:plan.length});process.exit(0);}
const actions=[];
for(const p of plan){const output=await run(`docker image inspect ${p.id} --format '{{len .RepoTags}}' | grep -qx 0 && docker image rm ${p.id}`);actions.push({id:p.id,output});}
const result={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,before,after:await run('df -Pk /'),actions,databaseCommands:0,volumeChanges:0,force:false};
await writeFile(root+'/'+outputPrefix+'-build-cleanup-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({removed:actions.length,after:result.after,elapsedMs:result.elapsedMs}));
