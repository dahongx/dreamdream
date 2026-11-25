/** One reviewed owner-gate hunk, not the unrelated dirty MessageBubble edits. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-reply-pet-owner-20261028',path='src/components/chat/MessageBubble.tsx';
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const bytes=Buffer.from(await new Response(p.stdout).arrayBuffer());if(await p.exited)throw Error('REMOTE_READ_FAILED');return bytes;}
const previous=JSON.parse(await readFile('outputs/mufy-reply-pet-20261028/manifest.json','utf8'));
const runningImage=(await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).toString().trim();
if(runningImage!=='sha256:4382a4063e186224da354215374879cd8fa9126cf0296d4dad15eed87a50f848')throw Error('RUNNING_VERSION_CHANGED');
const before='65352533a68a241974d0cf14ec4dc8b5b7e1cbd6bc9fea09267dcf647413f9cc';
const baseline=await read(`cd /root/projects/yearn-chat && cat ${path}`);
const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
if(hash(baseline)!==before)throw Error('MESSAGE_BASELINE_CHANGED');
const anchor='mufySourceDefaults&&sourceComponentStyle&&<MufyReplySidebar';
if(baseline.toString().split(anchor).length!==2)throw Error('OWNER_GATE_NOT_UNIQUE');
const candidate=Buffer.from(baseline.toString().replace(anchor,'mufySourceDefaults&&<MufyReplySidebar'));
const preservedRenderer=[...previous.preservedRenderer,...previous.entries.map((e:{path:string;after:string})=>({path:e.path,after:e.after}))];
for(const e of [...previous.preservedTips,...preservedRenderer]){
 if(!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||!/^[a-f0-9]{64}$/.test(e.after))throw Error('INVALID_PRESERVED_ENTRY');
 if((await read(`cd /root/projects/yearn-chat && sha256sum ${e.path}`)).toString().split(/\s+/)[0]!==e.after)throw Error('PRESERVED_VERSION_CHANGED');
}
for(const [folder,data] of [['baseline',baseline],['patch',candidate]] as const){await mkdir(`${dir}/${folder}/src/components/chat`,{recursive:true});await writeFile(`${dir}/${folder}/${path}`,data);}
await writeFile(`${dir}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',observedAt:new Date().toISOString(),runningImage,entries:[{path,before,after:hash(candidate)}],preservedTips:previous.preservedTips,preservedRenderer,scope:'Remove shared fire/memory CSS prerequisite for latest Mufy reply viewport owner; sidebar itself still requires its own CSS, pet is self styled'},null,2));
console.log(JSON.stringify({remoteWrites:0,hunks:1}));
