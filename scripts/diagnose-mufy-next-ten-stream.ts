import {writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-10-20261023';
const startedAt=new Date().toISOString(),start=performance.now();
async function read(command:string){
 const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
 const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 if(code)throw Error(`READ_ONLY_DIAGNOSTIC_FAILED:${code}:${err.slice(0,120)}`);
 return out.trim();
}
if(await read('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('WRONG_TEST_PORT');
const state=await read("docker inspect yearn-chat-app-1 --format 'status={{.State.Status}} restarts={{.RestartCount}} oom={{.State.OOMKilled}}'");
const disk=await read('df -h /');
// Filter at the server boundary; never return raw request bodies, SQL, Env or credentials.
const events=await read("cd /root/projects/yearn-chat && docker compose logs --tail 350 --timestamps --no-color app 2>&1 | grep -Eo '[0-9TZ:.+-]+ .*\\[chat\\] (TTFT|finished|UI stream error).*|TimeoutError: The operation timed out' || true");
const report={startedAt,finishedAt:new Date().toISOString(),state,disk,events,qualification:'finished log has no sessionId; adjacent events alone cannot prove the same request',databaseConnections:0,mutations:0};
await writeFile(`${root}/stream-readonly-latest.json`,JSON.stringify(report,null,2));
await appendFile(`${root}/timing-runs.jsonl`,JSON.stringify({stepId:'read-only-stream-diagnostic',startedAt,finishedAt:report.finishedAt,elapsedMs:performance.now()-start,kind:'ssh-diagnostic-with-network-wait',netWorkMs:null})+'\n');
console.log(JSON.stringify(report));
