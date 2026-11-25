/** Read-only TEST-host image graph and exact legacy build provenance. No secrets or DB access. */
import {mkdir,writeFile} from 'node:fs/promises';
const dir='outputs/mufy-consolidated-20261029';await mkdir(dir,{recursive:true});
async function remote(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error('READ_ONLY_AUDIT_FAILED:'+err.slice(0,300));return out.trim();}
if(await remote('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const images=(await remote(`docker images -a -q --no-trunc | sort -u | xargs -r docker image inspect --format '{"id":{{json .Id}},"parent":{{json (index . "Parent")}},"tags":{{json .RepoTags}},"workdir":{{json (index .Config "WorkingDir")}},"size":{{json .Size}},"layers":{{json .RootFS.Layers}}}'`)).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
const containers=(await remote(`docker ps -aq --no-trunc | xargs -r docker inspect --format '{"id":{{json .Id}},"image":{{json .Image}},"name":{{json .Name}},"status":{{json .State.Status}},"workdir":{{json .Config.WorkingDir}},"mounts":{{len .Mounts}}}'`)).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
const metadata=await remote(`for p in /root/referral-release-20261029013644759 /root/referral-release-20261029014019403 /root/referral-release-20261028180635418 /root/referral-release-20261029025450074; do if test -d "$p"; then printf 'DIRECTORY %s\\n' "$p"; find "$p" -maxdepth 1 -type f -printf '%f %s bytes\\n'; fi; done
find /root/mufy-transfer-archive-20261015 /root -maxdepth 3 -type f -name build.log -exec grep -l -E '3cfb3c63335e|2fe2835cffbd|9a41825fa647' {} + 2>/dev/null || true`);
const result={observedAt:new Date().toISOString(),images,containers,metadata,capacity:await remote('df -Pk /'),remoteWrites:0};
await writeFile(dir+'/capacity-current-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({images:images.length,containers:containers.length,metadata,capacity:result.capacity}));
