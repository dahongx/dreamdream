/** Keep the running app and two newer rollback images; remove one exact old TEST tag. */
import {writeFile} from 'node:fs/promises';
const startedAt=new Date().toISOString(),t=performance.now();
const target='yearn-chat-app:statusbar-before-20261021041243056';
const expected='sha256:974e7a9951b6b369cc0fa1dab6bd707a30e5769d7007416374347c93d76fa5dd';
async function run(s:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',s],{stdout:'pipe',stderr:'pipe'});const [out,err,c]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(c)throw Error('TEST_COMMAND_FAILED:'+err.slice(0,400));return out.trim();}
if(await run('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const keep=await run("docker image inspect yearn-chat-app:latest yearn-chat-app:sidebar-before-20261021095302705 yearn-chat-app:stream-before-20261021065136229 --format '{{.Id}}'");
const used=await run("docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}'");
if(keep.split(/\r?\n/).includes(expected)||used.split(/\r?\n/).includes(expected)||await run(`docker image inspect ${target} --format '{{.Id}}'`)!==expected)throw Error('PROTECTED_IMAGE');
const output=await run(`docker image rm ${target}`);
const result={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-t,target,expected,output,preserved:keep.split(/\r?\n/),disk:await run('df -Pk /'),recovery:'Old source-before archives retained; removed image requires rebuilding.',databaseCommands:0,volumeChanges:0,force:false};
await writeFile('logs/mufy-profiles/full-20261013/next-batch-5-20261019/oldest-rollback-cleanup-20261022.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
