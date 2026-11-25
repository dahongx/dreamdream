/** Only untagged intermediates from the recorded successful 8091 build. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/next-batch-5-20261019';
const report=JSON.parse(await readFile(root+'/source-presentation-deploy.json','utf8'));
if(!report.ok||report.databaseCommands!==0||!/^\/root\/mufy-transfer-archive-20261015\/source-presentation-\d+$/.test(report.backup))throw Error('SUCCESSFUL_TEST_BUILD_REQUIRED');
const startedAt=new Date().toISOString(),t=performance.now();
async function run(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const [out,err,exit]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(exit)throw Error('TEST_COMMAND_FAILED:'+err.slice(0,200));return out.trim();}
const script=`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
df -Pk /
allowed="$(sed -nE 's/^ ---> ([a-f0-9]{12})$/\\1/p' ${report.backup}/build.log)"
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
for round in 1 2 3 4 5 6 7 8; do
 changed=0
 for id in $(docker image ls --filter dangling=true --no-trunc --format '{{.ID}}'); do
  short=$(printf '%s' "$id" | cut -c8-19)
  if ! printf '%s\\n' "$allowed" | grep -Fxq "$short"; then continue; fi
  if printf '%s\\n' "$used" | grep -Fxq "$id"; then continue; fi
  test "$(docker image inspect "$id" --format '{{.Config.WorkingDir}}')" = /app || continue
  test "$(docker image inspect "$id" --format '{{len .RepoTags}}')" = 0 || continue
  docker image rm "$id"
  changed=1
 done
 test "$changed" = 1 || break
done
df -Pk /
`;
const output=await run(script),result={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,output,buildReport:'source-presentation-deploy.json',databaseCommands:0,volumeChanges:0,force:false};
await writeFile(root+'/source-presentation-build-cleanup.json',JSON.stringify(result,null,2));
await appendFile(root+'/timing-runs.jsonl',JSON.stringify({stepId:'cleanup-source-presentation-intermediates',kind:'compute',...result})+'\n');
console.log(JSON.stringify(result));
