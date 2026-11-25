/** Retired TEST build ancestors: protect every tagged/used image and its parents. */
import {readFile,writeFile} from 'node:fs/promises';
const more=process.argv.includes('--more-pet-stages'),suffix=more?'-more':'';
const dir='outputs/mufy-opening-bilibili-20261028',current=JSON.parse(await readFile(more?`${dir}/deployment.json`:'outputs/mufy-opening-height-20261028/deployment.json','utf8')).image;
const sources=more?['outputs/mufy-reply-pet-bootstrap-20261028','outputs/mufy-reply-pet-ready-20261028','outputs/mufy-reply-pet-drag-20261028','outputs/mufy-reply-pet-fit-20261028','outputs/mufy-opening-height-20261028']:['outputs/mufy-reply-pet-owner-20261028','outputs/mufy-source-envelope-form-newlines-20261028','outputs/mufy-source-component-isolation-20261028'];
const archivePattern=/^\/root\/mufy-transfer-archive-20261015\/(reply-pet-(?:owner|bootstrap|ready|drag|fit|opening-height)|source-component-isolation)-\d+$/;
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const out=await new Response(p.stdout).text();if(await p.exited)throw Error('AUDIT_FAILED');return out;}
const hash=/^sha256:[a-f0-9]{64}$/;
if(!hash.test(current))throw Error('INVALID_CURRENT');
if(!process.argv.includes('--execute')&&!process.argv.includes('--verify-cleanup')){
 const images=(await read(`docker images -a -q --no-trunc | sort -u | xargs -r docker image inspect --format '{"id":{{json .Id}},"created":{{json .Created}},"tags":{{json .RepoTags}},"workdir":{{json (index .Config "WorkingDir")}},"layers":{{json .RootFS.Layers}}}'`)).trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
 const used=new Set((await read("docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}'")).trim().split(/\r?\n/));
 const protectedIds=new Set<string>();
 const roots=images.filter(e=>e.tags?.length||used.has(e.id));
 for(const image of images)if(roots.some(root=>image.layers.length<=root.layers.length&&image.layers.every((layer:string,i:number)=>layer===root.layers[i])))protectedIds.add(image.id);
 const targets=new Map<string,{id:string;layers:string[];backup:string}>();
 for(const source of sources){
  const op=JSON.parse(await readFile(`${source}/operation.json`,'utf8')),d=JSON.parse(await readFile(`${source}/deployment.json`,'utf8'));
  if(!d.deployed||op.backup!==d.backup||!archivePattern.test(op.backup))throw Error('UNVERIFIED_HISTORY');
  const prefixes=new Set((await read(`sed -n -E 's/^ ---> ([a-f0-9]{12})$/\\1/p' ${op.backup}/build.log`)).trim().split(/\r?\n/));
  for(const image of images)if(!protectedIds.has(image.id)&&!image.tags?.length&&image.workdir==='/app'&&prefixes.has(image.id.slice(7,19))&&Date.parse(image.created)>=Date.parse(op.startedAt)&&Date.parse(image.created)<=Date.parse(d.serverCompletedAt))targets.set(image.id,{...image,backup:op.backup});
 }
 const plan={observedAt:new Date().toISOString(),current,targets:[...targets.values()].sort((a: {layers:string[]},b: {layers:string[]})=>b.layers.length-a.layers.length),protectedIds:[...protectedIds],scope:'Only unused untagged /app ancestors present in verified retired TEST build logs/time windows; all tagged/used images and their ancestors protected'};
 await writeFile(`${dir}/retired-graph${suffix}-plan.json`,JSON.stringify(plan,null,2));console.log(JSON.stringify({targets:plan.targets,protectedCount:protectedIds.size}));process.exit(0);
}
const plan=JSON.parse(await readFile(process.argv.includes('--verify-cleanup')&&more?'outputs/mufy-opening-bilibili-attempt2-20261028/retired-graph-more-plan.json':`${dir}/retired-graph${suffix}-plan.json`,'utf8'));
if(plan.current!==current||plan.targets.some((e:{id:string;parent:string;backup:string})=>!hash.test(e.id)||!archivePattern.test(e.backup)))throw Error('INVALID_PLAN');
if(process.argv.includes('--verify-cleanup')){
 const remaining=new Set((await read('docker images -a -q --no-trunc')).trim().split(/\r?\n/));
 const left=plan.targets.filter((e:{id:string})=>remaining.has(e.id));
 const running=(await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).trim();
 if(left.length||running!==current)throw Error('CLEANUP_POSTCHECK_FAILED');
 const capacity=await read('df -Pk /');
 await writeFile(`${dir}/retired-graph${suffix}-cleanup.json`,JSON.stringify({recordedAt:new Date().toISOString(),targets:plan.targets,targetsAbsent:true,currentImageUnchanged:true,initialCommandReportedErrors:true,reason:'Docker automatically removed untagged parent stages before their later explicit IDs were processed; read-only inventory verifies every planned target absent.',capacity,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Rebuild disposable layers from retained source archives and protected dependency cache'},null,2));
 console.log(JSON.stringify({verifiedRemoved:plan.targets.length,currentImageUnchanged:true,capacity}));process.exit(0);
}
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
${plan.targets.map((e:{id:string;backup:string})=>`test "$(docker image inspect '${e.id}' --format '{{len .RepoTags}} {{.Config.WorkingDir}}')" = '0 /app'
grep -q '${e.id.slice(7,19)}' ${e.backup}/build.log
if printf '%s\\n' "$used" | grep -Fqx '${e.id}'; then exit 1; fi`).join('\n')}
df -Pk /
${plan.targets.map((e:{id:string})=>`if docker image inspect '${e.id}' >/dev/null 2>&1; then docker image rm '${e.id}'; else echo RETIRED_PARENT_ALREADY_REMOVED; fi`).join('\n')}
df -Pk /`;
const tick=performance.now(),out=await read(command);
await writeFile(`${dir}/retired-graph${suffix}-cleanup.json`,JSON.stringify({observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',targets:plan.targets,output:out,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'Rebuild unused intermediate layers from retained TEST source archives; tagged runtimes and dependency cache unchanged'},null,2));console.log(out);
