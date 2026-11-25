/** Reusable narrow cleanup: one verified successful TEST release, no named/used images. */
import {readFile,writeFile} from 'node:fs/promises';
const phase=process.argv.includes('--opening-height')||process.argv.includes('--bilibili')||process.argv.includes('--island')?'opening-height':process.argv.includes('--fit-rejected')||process.argv.includes('--fit')?'fit':process.argv.includes('--drag')?'drag':'ready';
const dir=process.argv.includes('--island')?'outputs/mufy-opening-island-20261028':process.argv.includes('--bilibili')?'outputs/mufy-opening-bilibili-20261028':phase==='opening-height'?'outputs/mufy-opening-height-20261028':`outputs/mufy-reply-pet-${phase}-20261028`;
const op=JSON.parse(await readFile(`${dir}/operation.json`,'utf8'));
const release=JSON.parse(await readFile(`${dir}/deployment.json`,'utf8'));
const rollback=process.argv.includes('--fit-rejected')?JSON.parse(await readFile(`${dir}/ui-regression-rollback.json`,'utf8')):null;
if(rollback&&rollback.exitCode!==0)throw Error('ROLLBACK_NOT_VERIFIED');
const currentImage=rollback?JSON.parse(await readFile(`${dir}/manifest.json`,'utf8')).runningImage:release.image;
if(!/^sha256:[a-f0-9]{64}$/.test(currentImage))throw Error('INVALID_CURRENT_IMAGE');
if(!new RegExp('^/root/mufy-transfer-archive-20261015/reply-pet-'+phase+'-\\d+$').test(op.backup)||release.backup!==op.backup||!release.deployed||!/^sha256:[a-f0-9]{64}$/.test(release.image))throw Error('UNVERIFIED_RELEASE');
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'pipe'});const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(exitCode)throw Error('REMOTE_AUDIT_FAILED');return stdout;}
const startedAt=new Date().toISOString(),tick=performance.now();
if(!process.argv.includes('--execute')){
 const prefixes=new Set((await read(`sed -n -E 's/^ ---> ([a-f0-9]{12})$/\\1/p' ${op.backup}/build.log`)).trim().split(/\r?\n/));
 const instructions=new Map((await read(`awk '/^Step/ {if($0 ~ / (FROM|RUN|COPY)/) step=$0; else step="omitted non-content instruction"} /^ ---> [a-f0-9]+$/ {if(length($2)==12) print $2 "\\t" step}' ${op.backup}/build.log`)).trim().split(/\r?\n/).map(line=>{const index=line.indexOf('\t');return[line.slice(0,index),line.slice(index+1)] as [string,string];}));
 const used=new Set((await read("docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}'")).trim().split(/\r?\n/));
 const lines=await read("docker images --filter dangling=true -q --no-trunc | sort -u | xargs -r docker image inspect --format '{\"id\":{{json .Id}},\"created\":{{json .Created}},\"tags\":{{json .RepoTags}},\"workdir\":{{json .Config.WorkingDir}},\"layers\":{{len .RootFS.Layers}}}'");
 const candidates=lines.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)).filter(e=>!e.tags?.length&&e.workdir==='/app'&&!used.has(e.id)&&prefixes.has(e.id.slice(7,19))&&Date.parse(e.created)>=Date.parse(op.startedAt)&&Date.parse(e.created)<=Date.parse(release.serverCompletedAt)).map(e=>({...e,instruction:instructions.get(e.id.slice(7,19))??'unknown'}));
 const preservedDependencyStages=candidates.filter(e=>e.instruction.includes('RUN bun install'));
 const targets=candidates.filter(e=>!e.instruction.includes('RUN bun install')).sort((a,b)=>b.layers-a.layers);
 const plan={observedAt:new Date().toISOString(),backup:op.backup,image:release.image,targets,preservedDependencyStages,scope:'Only unused untagged /app stages listed in this successful TEST build log and deployment time window; retain freshly verified install cache'};
 await writeFile(`${dir}/owned-stage-cleanup-plan.json`,JSON.stringify(plan,null,2));console.log(JSON.stringify(plan));process.exit(0);
}
const plan=JSON.parse(await readFile(`${dir}/owned-stage-cleanup-plan.json`,'utf8'));
if(plan.backup!==op.backup||plan.image!==release.image||plan.targets.some((e:{id:string})=>!/^sha256:[a-f0-9]{64}$/.test(e.id)))throw Error('INVALID_PLAN');
const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${currentImage}'
used="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
${plan.targets.map((e:{id:string})=>`test "$(docker image inspect '${e.id}' --format '{{len .RepoTags}} {{.Config.WorkingDir}}')" = '0 /app'
grep -q '${e.id.slice(7,19)}' ${op.backup}/build.log
if printf '%s\\n' "$used" | grep -Fqx '${e.id}'; then echo ARTIFACT_NOW_USED; exit 1; fi`).join('\n')}
df -Pk /
${plan.targets.length?'docker image rm '+plan.targets.map((e:{id:string})=>e.id).join(' '):'true'}
df -Pk /
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${currentImage}'`;
const output=await read(command);
await writeFile(`${dir}/owned-stage-cleanup-result.json`,JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-cleanup-wall-not-agent-net',targets:plan.targets,output,databaseTouched:false,productionTouched:false,namedImagesPreserved:true,volumeChanges:0,recovery:'Rebuild disposable stages from retained source archives'},null,2));
console.log(output.trim());
