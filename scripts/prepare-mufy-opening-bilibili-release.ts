/** Two exact files for the explicitly approved TEST-only official player. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const parent=process.argv.includes('--official-origin')?'outputs/mufy-opening-island-20261028':process.argv.includes('--single-layer')?'outputs/mufy-opening-bilibili-attempt2-20261028':process.argv.includes('--relative-url')?'outputs/mufy-opening-bilibili-attempt1-20261028':'outputs/mufy-opening-height-20261028',dir='outputs/mufy-opening-bilibili-20261028';
const m=JSON.parse(await readFile(`${parent}/manifest.json`,'utf8')),d=JSON.parse(await readFile(`${parent}/deployment.json`,'utf8'));
const paths=['src/lib/regex/iframe-bridge.ts','src/components/regex/RegexIframe.tsx'];
const all=[...m.entries,...m.preservedRenderer,{path:paths[1],after:'4c0594ee4a1f0cbe85fac6f4cece8c0024a94b72fd371b5036783c4589b26a53'}];
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const out=Buffer.from(await new Response(p.stdout).arrayBuffer());if(await p.exited)throw Error('READ_FAILED');return out;}
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
if((await read('cd /root/projects/yearn-chat && docker compose port app 3000')).toString().trim()!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
if((await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).toString().trim()!==d.image)throw Error('RUNNING_VERSION_CHANGED');
const entries=[];
for(const path of paths){const before=all.find(e=>e.path===path)?.after;if(!/^[a-f0-9]{64}$/.test(before))throw Error('BAD_GUARD');const baseline=await read(`cd /root/projects/yearn-chat && cat ${path}`);if(hash(baseline)!==before)throw Error('BASELINE_CHANGED');const candidate=await readFile(path);for(const [folder,bytes] of [['baseline',baseline],['patch',candidate]] as const){await mkdir(dirname(`${dir}/${folder}/${path}`),{recursive:true});await writeFile(`${dir}/${folder}/${path}`,bytes);}entries.push({path,before,after:hash(candidate)});}
await writeFile(`${dir}/patch/Dockerfile.cached-deps`,await readFile(`${parent}/patch/Dockerfile.cached-deps`));
await writeFile(`${dir}/manifest.json`,JSON.stringify({...m,observedAt:new Date().toISOString(),runningImage:d.image,entries,preservedRenderer:all.filter(e=>!paths.includes(e.path)),scope:'Explicit user approval: allow-same-origin only for standalone external official player.bilibili.com/player.html on http://115.29.213.73:8091; no Host bridge or host context; author srcdoc and all other sandbox restrictions unchanged'},null,2));console.log(JSON.stringify({files:2,remoteWrites:0}));
