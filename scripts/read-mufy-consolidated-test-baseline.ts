/** TEST renderer source snapshot only. No remote writes, build or DB access. */
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code!==0)throw Error(`TEST_READ_FAILED: ${err.slice(0,160)}`);return out;}
const tick=performance.now(),startedAt=new Date().toISOString();
if((await read('cd /root/projects/yearn-chat && docker compose port app 3000')).trim()!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const container=(await read('cd /root/projects/yearn-chat && docker compose ps -q app')).trim();
if(!/^[a-f0-9]{64}$/.test(container))throw Error('INVALID_TEST_CONTAINER');
const image=(await read(`docker inspect ${container} --format '{{.Image}}'`)).trim();
if(!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('INVALID_TEST_IMAGE');
const disk=(await read('df -B1 --output=avail,pcent /')).trim();
const dir='outputs/mufy-consolidated-20261029',entries=[];
for(const path of ['src/components/chat/OpeningSlot.tsx','src/components/chat/ChatMessagesList.tsx','src/components/chat/FloatingSlot.tsx','src/components/regex/RegexIframe.tsx','src/lib/regex/iframe-bridge.ts','src/lib/opening/content.ts']){
 const source=await read(`cd /root/projects/yearn-chat && cat ${path}`);
 const file=`${dir}/baseline/${path}`;await mkdir(dirname(file),{recursive:true});await writeFile(file,source);
 entries.push({path,sha256:createHash('sha256').update(source).digest('hex')});
}
if((await read(`docker inspect ${container} --format '{{.Image}}'`)).trim()!==image)throw Error('TEST_BASELINE_CHANGED_DURING_READ');
const manifest={startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,timingKind:'ssh-source-read-wall-not-agent-net',agentNetMs:null,target:'115.29.213.73:8091',container,image,disk,entries,remoteWrites:0,databaseTouched:false,productionTouched:false,buildStarted:false};
await writeFile(`${dir}/baseline-manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
