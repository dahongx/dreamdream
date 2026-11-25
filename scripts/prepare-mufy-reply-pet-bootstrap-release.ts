/** Fix zero-area frame bootstrap with one guarded local measurement call. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-reply-pet-bootstrap-20261028',path='src/lib/import/mufy-reply-pet.ts';
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const result=Buffer.from(await new Response(p.stdout).arrayBuffer());if(await p.exited)throw Error('REMOTE_READ_FAILED');return result;}
const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const previous=JSON.parse(await readFile('outputs/mufy-reply-pet-owner-20261028/manifest.json','utf8'));
const runningImage=(await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).toString().trim();
if(runningImage!=='sha256:df707a4562e4765815bb603872fc54424be2bcb226108fe0d344d824d6f542d2')throw Error('RUNNING_VERSION_CHANGED');
const baseline=await read(`cd /root/projects/yearn-chat && cat ${path}`),before='b9941acc7eb481ff072e17c1788765d4b09f07ef627bd40e3761055b7c7072a3';
if(hash(baseline)!==before)throw Error('BOOTSTRAP_BASELINE_CHANGED');
const old='attributes:true});schedule();}',next='attributes:true});measure();}';
if(baseline.toString().split(old).length!==2)throw Error('BOOTSTRAP_HUNK_NOT_UNIQUE');
const candidate=Buffer.from(baseline.toString().replace(old,next));
const preservedRenderer=[...previous.preservedRenderer,...previous.entries].filter((e:{path:string})=>e.path!==path).map((e:{path:string;after:string})=>({path:e.path,after:e.after}));
for(const e of [...previous.preservedTips,...preservedRenderer]){
 if(!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||!/^[a-f0-9]{64}$/.test(e.after))throw Error('INVALID_GUARD');
 if((await read(`cd /root/projects/yearn-chat && sha256sum ${e.path}`)).toString().split(/\s+/)[0]!==e.after)throw Error('PRESERVED_SOURCE_CHANGED');
}
for(const [folder,data] of [['baseline',baseline],['patch',candidate]] as const){await mkdir(`${dir}/${folder}/src/lib/import`,{recursive:true});await writeFile(`${dir}/${folder}/${path}`,data);}
await writeFile(`${dir}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',observedAt:new Date().toISOString(),runningImage,entries:[{path,before,after:hash(candidate)}],preservedTips:previous.preservedTips,preservedRenderer,scope:'First bounds report must not wait for rAF in a fully clipped initial iframe; no other source program or host behavior changes'},null,2));
console.log(JSON.stringify({hunks:1,remoteWrites:0}));
