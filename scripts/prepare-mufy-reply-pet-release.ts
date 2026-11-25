/** Read-only TEST capture. Stage three reviewed UI files; preserve mask/Tips. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-reply-pet-20261028';
const files=['src/components/chat/MufyReplySidebar.tsx','src/components/chat/MufyReplyPet.tsx','src/lib/import/mufy-reply-pet.ts'];
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const result=Buffer.from(await new Response(p.stdout).arrayBuffer());if(await p.exited)throw Error('REMOTE_READ_FAILED');return result;}
const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
if((await read('cd /root/projects/yearn-chat && docker compose port app 3000')).toString().trim()!=='0.0.0.0:8091')throw Error('WRONG_TEST_TARGET');
const runningImage=(await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).toString().trim();
if(runningImage!=='sha256:1cd27daa828b8ef7e4187caff5099b62adc19465bef8faa6870370b69857780d')throw Error('RUNNING_VERSION_CHANGED');
const entries=[];
for(const [i,path] of files.entries()){
 const baseline=i===0?await read(`cd /root/projects/yearn-chat && cat ${path}`):null;
 if(baseline&&hash(baseline)!=='de1f379b86c3ad1f77785219603fd47a67abfbc9559346088d458a72ed122739')throw Error('SIDEBAR_BASELINE_CHANGED');
 if(!baseline)await read(`cd /root/projects/yearn-chat && test ! -e ${path}`);
 const candidate=await readFile(path);
 if(baseline){await mkdir(dirname(`${dir}/baseline/${path}`),{recursive:true});await writeFile(`${dir}/baseline/${path}`,baseline);}
 await mkdir(dirname(`${dir}/patch/${path}`),{recursive:true});await writeFile(`${dir}/patch/${path}`,candidate);
 entries.push({path,before:baseline?hash(baseline):'ABSENT',after:hash(candidate)});
}
const readJson=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const tips=(await readJson('outputs/mufy-source-envelope-form-newlines-20261028/manifest.json')).preservedTips as {path:string;after:string}[];
const mask=(await readJson('outputs/mask-release-20261028/manifest.json')).entries as {path:string;after:string}[];
const masks=new Map(mask.map(e=>[e.path,e.after]));
const preservedTips=tips.map(e=>({path:e.path,after:masks.get(e.path)??e.after}));
const renderer=(await readJson('outputs/mufy-artifact-resize-20261028/manifest.json')).entries as {path:string;after:string}[];
const preservedRenderer=[...renderer,...mask.filter(e=>!tips.some(t=>t.path===e.path)),{path:'src/lib/import/mufy-source-rule-envelope.ts',after:'5838a84521c85cdf095d821db5b10f4b30db8e8a321ceeff3393f56712681ccc'}].map(e=>({path:e.path,after:e.after}));
for(const e of [...preservedTips,...preservedRenderer]){
 if(!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||!/^[a-f0-9]{64}$/.test(e.after))throw Error('INVALID_PRESERVATION_ENTRY');
 if((await read(`cd /root/projects/yearn-chat && sha256sum ${e.path}`)).toString().split(/\s+/)[0]!==e.after)throw Error('PRESERVED_VERSION_CHANGED:'+e.path);
}
await writeFile(`${dir}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',observedAt:new Date().toISOString(),runningImage,entries,preservedTips,preservedRenderer,scope:'Known GP reply pet only; reuse opaque parent shim and draft relay; fixed viewport clipped to visible interaction bounds',reviewRequired:true},null,2));
console.log(JSON.stringify({entries,preservedTips:preservedTips.length,preservedRenderer:preservedRenderer.length,remoteWrites:0}));
