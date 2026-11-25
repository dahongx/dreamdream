/** One bridge file only, with exact current TEST and other feature guards. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-opening-height-20261028',parent='outputs/mufy-reply-pet-fit-20261028';
const prior=JSON.parse(await readFile(`${parent}/manifest.json`,'utf8')),release=JSON.parse(await readFile(`${parent}/deployment.json`,'utf8'));
const all=[...prior.entries,...prior.preservedRenderer],path='src/lib/regex/iframe-bridge.ts',expected=all.find(e=>e.path===path)?.after;
if(expected!=='0a0757c75da1d6246151efa2533cdd35e4569a47e430edd7bb854212209ad53c')throw Error('WRONG_BASELINE');
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const out=Buffer.from(await new Response(p.stdout).arrayBuffer());if(await p.exited)throw Error('READ_FAILED');return out;}
const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
if((await read('cd /root/projects/yearn-chat && docker compose port app 3000')).toString().trim()!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
if((await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).toString().trim()!==release.image)throw Error('RUNNING_VERSION_CHANGED');
const baseline=await read(`cd /root/projects/yearn-chat && cat ${path}`),candidate=await readFile(path);
if(hash(baseline)!==expected)throw Error('BASELINE_CHANGED');
for(const [folder,bytes] of [['baseline',baseline],['patch',candidate]] as const){await mkdir(dirname(`${dir}/${folder}/${path}`),{recursive:true});await writeFile(`${dir}/${folder}/${path}`,bytes);}
const preservedRenderer=all.filter(e=>e.path!==path);
for(const e of [...preservedRenderer,...prior.preservedTips]){if(!/^src\/[\w./-]+$/.test(e.path)||!/^[a-f0-9]{64}$/.test(e.after))throw Error('INVALID_GUARD');if((await read(`cd /root/projects/yearn-chat && sha256sum ${e.path}`)).toString().split(/\s+/)[0]!==e.after)throw Error('OTHER_RELEASE_CHANGED');}
await writeFile(`${dir}/patch/Dockerfile.cached-deps`,await readFile(`${parent}/patch/Dockerfile.cached-deps`));
await writeFile(`${dir}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',observedAt:new Date().toISOString(),runningImage:release.image,entries:[{path,before:expected,after:hash(candidate)}],preservedRenderer,preservedTips:prior.preservedTips,cachedDeps:prior.cachedDeps,scope:'Repeat resize at host-ready; body-content sizing only for in-flow opening canvases. No CSP/sandbox/data/author-content change.'},null,2));
console.log(JSON.stringify({files:1,remoteWrites:0}));
