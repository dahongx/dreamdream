/** Explicit retired TEST images + proven failed build containers only. Never prune or touch volumes. */
import {readFile,writeFile} from 'node:fs/promises';
const dir='outputs/mufy-consolidated-20261029';
const current='sha256:6ab6cb9cbe89b961df52f6ce15641521e14718896a78253b35e48b04ffa6a791';
const oldTags=['yearn-chat-app:before-referral-20261029013644759','yearn-chat-app:before-referral-20261029014019403','yearn-chat-app:before-referral-20261028180635418'];
const oldIds=['sha256:1757f90288af7face87ccdea3599be396c926bca4c9057017f2d07f1a8422a9d','sha256:70e598c3ece89f5709d4ef10118b83e7ea896829b44ed7e549cde086c5124907'];
const failed=[{id:'3cfb3c63335e583dc0773a6d1479892e6c33275f75a1e4e674a4a75b69774a82',image:'sha256:511e03319f7dcd21d18ebac96ae70dfa5ce40f11e6e690eef8cbb93cf80045b8',log:'/root/referral-release-20261029013644759/build.log'},{id:'2fe2835cffbdb3d147c04d884656638fe281c866a1df088d9342d1c127df53dc',image:'sha256:4489032f9df26da200f1dd70973b3dcdfc7e46a8ecf611d93deb57c087f5857d',log:'/root/mufy-transfer-archive-20261015/chat-skin-20261027133443728/build.log'},{id:'9a41825fa647e707611b62be85fc25d8c4c2169ccf3d2b9cbafcf29b7348c54e',image:'sha256:76929512b7693c70e938bf56d620e43a9448d987ce153b77928ef10bd729d948',log:'/root/mufy-transfer-archive-20261015/font-20261026154418726/build.log'}];
async function remote(command:string){const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73','sh','-s'],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});p.stdin.write(command+'\n');p.stdin.end();const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code){await writeFile(dir+'/capacity-operation-failure.json',JSON.stringify({observedAt:new Date().toISOString(),exitCode:code,out,err,partialMutationPossible:process.argv.includes('--execute')},null,2));throw Error('CAPACITY_OPERATION_FAILED:'+err.slice(0,400)+' '+out.slice(-800));}return out.trim();}
type Image={id:string;tags:string[]|null;workdir:string;layers:string[];size:number};
if(process.argv.includes('--verify')){
 const plan=JSON.parse(await readFile(dir+'/capacity-cleanup-plan.json','utf8'));
 const before=JSON.parse(await readFile(dir+'/capacity-current-audit.json','utf8'));
 const images=new Set((await remote('docker images -a -q --no-trunc')).split(/\r?\n/));
 const containers=new Set((await remote('docker ps -aq --no-trunc')).split(/\r?\n/));
 const missingProtected=plan.protectedIds.filter((id:string)=>!images.has(id));
 const retainedImages:Image[]=(await remote(`docker images -a -q --no-trunc | sort -u | xargs -r docker image inspect --format '{"id":{{json .Id}},"tags":{{json .RepoTags}},"layers":{{json .RootFS.Layers}}}'`)).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
 const retainedContainerImages=new Set(before.containers.filter((c:{id:string})=>!failed.some(f=>f.id===c.id)).map((c:{image:string})=>c.image));
 const protectedRoots:Image[]=before.images.filter((i:Image)=>retainedContainerImages.has(i.id)||i.tags?.some(t=>!oldTags.includes(t)));
 const missingRoots=protectedRoots.filter(i=>!images.has(i.id));
 const changedTags=protectedRoots.flatMap(i=>(i.tags??[]).filter(t=>!oldTags.includes(t)&&!retainedImages.some(r=>r.id===i.id&&r.tags?.includes(t))));
 // Docker removes unused intermediate image configurations automatically. A
 // layer-equivalent config can disappear while its layers remain in tagged
 // roots. Verify the actual root image/tag and layer content, not config count.
 const protectedLayersPresent=missingProtected.every((id:string)=>{const i:Image=before.images.find((i:Image)=>i.id===id);return retainedImages.some(r=>i.layers.length<=r.layers.length&&i.layers.every((l,n)=>l===r.layers[n]));});
 const unexpectedMissingContainers=before.containers.filter((c:{id:string})=>!failed.some(f=>f.id===c.id)&&!containers.has(c.id)).map((c:{id:string})=>c.id);
 const leftovers=plan.targets.filter((i:Image)=>images.has(i.id)).map((i:Image)=>i.id);
 if(missingRoots.length||changedTags.length||!protectedLayersPresent||unexpectedMissingContainers.length||leftovers.length||failed.some(f=>containers.has(f.id))){console.log(JSON.stringify({missingRoots,changedTags,protectedLayersPresent,unexpectedMissingContainers,leftovers}));throw Error('CLEANUP_RECONCILIATION_FAILED');}
 if(await remote('cd /root/projects/yearn-chat && docker compose port app 3000')!=='0.0.0.0:8091'||await remote('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')!==current)throw Error('CURRENT_TEST_CHANGED');
 const capacity=await remote('df -Pk /'),line=capacity.split(/\r?\n/).at(-1)!.trim().split(/\s+/),freeBytes=Number(line[3])*1024,usedPercent=Number(line[4].replace('%',''));
 const proof={observedAt:new Date().toISOString(),removedPlannedImages:plan.targets.length,removedFailedContainers:failed.length,allProtectedTaggedAndContainerImagesPresent:true,allProtectedTagsUnchanged:true,protectedLayersPresent,automaticallyRemovedLayerEquivalentIntermediateConfigs:missingProtected,allOtherContainersPresent:true,currentImageUnchanged:true,recentTwoRollbacksPreserved:true,freeBytes,usedPercent,capacityGatePassed:freeBytes>=20*1024**3&&usedPercent<=80,databaseTouched:false,productionTouched:false,volumeChanges:0};
 await writeFile(dir+'/capacity-cleanup-verification.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));process.exit(0);
}
if(!process.argv.includes('--execute')){
 const audit=JSON.parse(await readFile(dir+'/capacity-current-audit.json','utf8'));
 const prefixes=new Set((await remote(`find /root/mufy-transfer-archive-20261015 -maxdepth 2 -type f -name build.log -exec sed -n -E 's/^ ---> ([a-f0-9]{12})$/\\1/p' {} +; find /root -maxdepth 2 -type f -path '/root/referral-release-*/build.log' -exec sed -n -E 's/^ ---> ([a-f0-9]{12})$/\\1/p' {} +`)).split(/\r?\n/));
 const images:Image[]=audit.images,used=new Set(audit.containers.filter((c:{id:string})=>!failed.some(f=>f.id===c.id)).map((c:{image:string})=>c.image));
 const roots=images.filter(i=>used.has(i.id)||(i.tags?.some(t=>!oldTags.includes(t))??false));
 const protectedIds=new Set(images.filter(i=>roots.some(r=>i.layers.length<=r.layers.length&&i.layers.every((l,n)=>l===r.layers[n]))).map(i=>i.id));
 for(const f of failed){const c=audit.containers.find((c:{id:string})=>c.id===f.id);if(!c||c.image!==f.image||c.status!=='exited'||c.mounts!==0||c.workdir!=='/app')throw Error('FAILED_BUILD_NOT_PROVEN');if(await remote(`grep -l '${f.id.slice(0,12)}' '${f.log}'`)!==f.log)throw Error('BUILD_LOG_MISMATCH');}
 for(const id of oldIds){const i=images.find(i=>i.id===id);if(!i||i.workdir!=='/app'||i.tags?.some(t=>!oldTags.includes(t))||used.has(id)||protectedIds.has(id))throw Error('OLD_ROLLBACK_PROTECTED');}
 const targets=images.filter(i=>!protectedIds.has(i.id)&&i.workdir==='/app'&&(oldIds.includes(i.id)||(!(i.tags?.length)&&prefixes.has(i.id.slice(7,19))))).sort((a,b)=>b.layers.length-a.layers.length);
 const plan={observedAt:new Date().toISOString(),current,oldTags,oldIds,failed,targets,protectedIds:[...protectedIds],preserveRollbackTags:['yearn-chat-app:before-referral-20261029025450074','yearn-chat-app:before-referral-20261029020138943'],scope:'exact retired TEST tags + failed mountless build containers + unused untagged /app stages found in TEST build logs; all remaining tags/containers and layer ancestors protected',databaseTouched:false,productionTouched:false,volumeChanges:0};
 await writeFile(dir+'/capacity-cleanup-plan.json',JSON.stringify(plan,null,2));console.log(JSON.stringify({targets:targets.length,failedContainers:failed.length,retiredImageIds:oldIds.length,protectedImages:protectedIds.size}));
}else{
 const plan=JSON.parse(await readFile(dir+'/capacity-cleanup-plan.json','utf8'));
 if(plan.current!==current||JSON.stringify(plan.oldTags)!==JSON.stringify(oldTags)||plan.targets.some((i:Image)=>!/^sha256:[a-f0-9]{64}$/.test(i.id)))throw Error('INVALID_PLAN');
 const command=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
${failed.map(f=>`test "$(docker inspect '${f.id}' --format '{{.State.Status}} {{.Image}} {{.Config.WorkingDir}} {{len .Mounts}}')" = 'exited ${f.image} /app 0'
grep -q '${f.id.slice(0,12)}' '${f.log}'`).join('\n')}
${plan.preserveRollbackTags.map((t:string)=>`docker image inspect '${t}' --format '{{.Id}}' >/dev/null`).join('\n')}
test -s /root/referral-release-20261029014019403/source-before.tar
test -s /root/referral-release-20261028180635418/source-before.tar
df -Pk /
docker rm ${failed.map(f=>f.id).join(' ')}
${oldTags.map(t=>`docker image rm '${t}'`).join('\n')}
${plan.targets.filter((i:Image)=>!oldIds.includes(i.id)).map((i:Image)=>`if docker image inspect '${i.id}' >/dev/null 2>&1; then
 test "$(docker image inspect '${i.id}' --format '{{len .RepoTags}} {{.Config.WorkingDir}}')" = '0 /app'
 if docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}' | grep -Fqx '${i.id}'; then exit 1; fi
 docker image rm '${i.id}'
fi`).join('\n')}
df -Pk /
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${current}'
${plan.preserveRollbackTags.map((t:string)=>`docker image inspect '${t}' --format '{{.Id}}'`).join('\n')}`;
 const startedAt=new Date().toISOString(),tick=performance.now(),output=await remote(command);
 await writeFile(dir+'/capacity-cleanup-result.json',JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,timingKind:'remote-cleanup-process-wall-not-agent-net',agentNetMs:null,output,targets:plan.targets.map((i:Image)=>i.id),removedFailedContainers:failed.map(f=>f.id),retiredTags:oldTags,currentImagePreserved:true,recentTwoRollbacksPreserved:true,volumeChanges:0,databaseTouched:false,productionTouched:false,recovery:'Disposable build state and retired images removed; not restorable directly. Rebuild from retained source archives/build logs and retained dependency caches.'},null,2));console.log(output.slice(-1800));
}
