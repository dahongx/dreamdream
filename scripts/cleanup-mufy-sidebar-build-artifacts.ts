/** Remove only three untagged intermediates from the recorded sidebar TEST build. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const ids=['69cfe61a1f28d9c672e48adf35a2cd1413b66636062b09bc37603b91aca0e8ac','7a151071efbeadbf8b4cb8c469a1278da81c8021636507c650a231c1f8c0ccc3','0604cf5b5451b5833db6e9501dbfe255a0786c9e67954f1d251942ec4426c61d'].map(v=>'sha256:'+v);
const deploy=JSON.parse(await readFile('logs/mufy-profiles/full-20261013/pilot-5/sidebar-lifecycle-20261021095302705.json','utf8'));
const startedAt=new Date().toISOString(),t=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
async function run(s:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',s],{stdout:'pipe',stderr:'pipe'});const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(exit)throw Error('TEST_COMMAND_FAILED:'+exit+':'+err.slice(0,500));return out.trim();}
if(await run('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('EXACT_TEST_PORT_REQUIRED');
const before=await run('df -Pk /');
const used=(await run("docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}'")).split(/\r?\n/);
const plan=[];
for(const id of ids){
 const data=JSON.parse(await run(`docker image inspect ${id} --format '{"id":{{json .Id}},"tags":{{json .RepoTags}},"created":{{json .Created}},"workdir":{{json .Config.WorkingDir}}}'`));
 if(data.tags?.length||used.includes(id)||data.workdir!=='/app'||Date.parse(data.created)<Date.parse(deploy.startedAt)||Date.parse(data.created)>Date.parse(deploy.finishedAt))throw Error('IMAGE_NOT_PROVEN_DISPOSABLE');
 plan.push(data);
}
await writeFile(root+'/sidebar-build-cleanup-plan-20261022.json',JSON.stringify({startedAt,before,plan,scope:'Three exact untagged intermediates inside sidebar TEST deployment window; all tagged rollback images and container images preserved.'},null,2));
if(!process.argv.includes('--execute')){console.log(JSON.stringify({planned:plan.length}));process.exit(0);}
const removed=[];
for(const p of plan){const output=await run(`docker image inspect ${p.id} --format '{{len .RepoTags}}' | grep -qx 0 && docker image rm ${p.id}`);removed.push({id:p.id,output});}
const result={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,before,after:await run('df -Pk /'),removed,databaseCommands:0,volumeChanges:0,force:false};
await writeFile(root+'/sidebar-build-cleanup-result-20261022.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({runId:startedAt,stepId:'exact-build-intermediate-cleanup',kind:'maintenance',startedAt,finishedAt:result.finishedAt,elapsedMs:result.elapsedMs,status:'ok'})+'\n');console.log(JSON.stringify(result));
