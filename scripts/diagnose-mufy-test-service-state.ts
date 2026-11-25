/** TEST read-only service metadata only. Never inspect Env or connect to a database. */
import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),start=performance.now();
async function read(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const out=await new Response(p.stdout).text();if(await p.exited)throw Error('READ_ONLY_COMMAND_FAILED');return out.trim();}
if(await read('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('EXACT_TEST_PORT_REQUIRED');
const containers=await read(`docker ps -a --filter name=yearn --format '{{.Names}} | {{.Status}} | {{.Ports}}'`);
const dependencyContainers=await read(`docker ps -a --filter name=supabase --format '{{.Names}} | {{.Status}}'`);
const appNetwork=await read(`docker inspect yearn-chat-app-1 --format '{{range $name,$net := .NetworkSettings.Networks}}{{$name}} | {{json $net.Aliases}}{{println}}{{end}}'`);
const dependencyState=await read(`docker inspect supabase-db --format 'status={{.State.Status}} restartCount={{.RestartCount}} oomKilled={{.State.OOMKilled}} exitCode={{.State.ExitCode}} startedAt={{.State.StartedAt}} finishedAt={{.State.FinishedAt}}'`);
const disk=await read('df -h / /var/lib/docker');
const errorClasses=await read(`cd /root/projects/yearn-chat && docker compose logs --since 15m --no-color app 2>&1 | grep -Eo 'ENOTFOUND|EAI_AGAIN|ECONNREFUSED|AuthRetryableFetchError|AuthApiError|fetch failed|Failed query' | sort | uniq -c`);
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,scope:'TEST-8091-read-only-service-metadata',containers,dependencyContainers,dependencyState,disk,appNetwork,errorClasses,credentialReads:0,databaseConnections:0,mutations:0};
await writeFile('logs/mufy-profiles/full-20261013/pilot-5/stream-regression-20261021/read-only-service-state.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
