/** Exact two owned files; preserve every reviewed source/UI change on TEST. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const drag=process.argv.includes('--drag');
const fit=process.argv.includes('--fit');
const dir=fit?'outputs/mufy-reply-pet-fit-20261028':drag?'outputs/mufy-reply-pet-drag-20261028':'outputs/mufy-reply-pet-ready-20261028';
const paths=drag||fit?['src/lib/import/mufy-reply-pet.ts']:['src/components/chat/MufyReplyPet.tsx','src/lib/import/mufy-reply-pet.ts'];
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const b=Buffer.from(await new Response(p.stdout).arrayBuffer());if(await p.exited)throw Error('REMOTE_READ_FAILED');return b;}
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const parentDir=fit?'outputs/mufy-reply-pet-drag-20261028':drag?'outputs/mufy-reply-pet-ready-20261028':'outputs/mufy-reply-pet-bootstrap-20261028';
const previous=JSON.parse(await readFile(`${parentDir}/manifest.json`,'utf8'));
const all=[...previous.preservedRenderer,...previous.entries] as {path:string;after:string}[];
const runningImage=(await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).toString().trim();
const expectedImage=drag||fit?JSON.parse(await readFile(`${parentDir}/deployment.json`,'utf8')).image:'sha256:ef8463766f30484280f7b075ef8cd1e54d18dd229a43352d1e7084f050e62d2e';
if(runningImage!==expectedImage)throw Error('RUNNING_VERSION_CHANGED');
const entries=[];
for(const path of paths){
 const before=all.find(e=>e.path===path)!.after,baseline=await read(`cd /root/projects/yearn-chat && cat ${path}`);
 if(hash(baseline)!==before)throw Error('OWNED_FILE_CHANGED');
 const candidate=await readFile(path);
 for(const [folder,data] of [['baseline',baseline],['patch',candidate]] as const){await mkdir(dirname(`${dir}/${folder}/${path}`),{recursive:true});await writeFile(`${dir}/${folder}/${path}`,data);}
 entries.push({path,before,after:hash(candidate)});
}
const preservedRenderer=all.filter(e=>!paths.includes(e.path));
for(const e of [...previous.preservedTips,...preservedRenderer]){
 if(!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||!/^[a-f0-9]{64}$/.test(e.after))throw Error('INVALID_GUARD');
 if((await read(`cd /root/projects/yearn-chat && sha256sum ${e.path}`)).toString().split(/\s+/)[0]!==e.after)throw Error('PRESERVED_SOURCE_CHANGED');
}
if(drag||fit)await writeFile(`${dir}/patch/Dockerfile.cached-deps`,await readFile(`${parentDir}/patch/Dockerfile.cached-deps`));
await writeFile(`${dir}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',observedAt:new Date().toISOString(),runningImage,entries,preservedTips:previous.preservedTips,preservedRenderer,...drag||fit?{cachedDeps:previous.cachedDeps}:{},scope:fit?'Keep prose responsive sizing out of fixed pet canvas; restore neutral source preflight before authored styles; fit menu edge and release out-of-viewport pointer bounds':drag?'Only while a pet pointer is active, expand hitbox to preserve drag beyond the clipped edge; release on up/cancel/blur':'Reset before replacing program; repeat bounds at host-ready; dismiss menus on focus return; fit food control at right edge'},null,2));
console.log(JSON.stringify({files:paths.length,remoteWrites:0}));
