/** Exact two routing hunks on the verified TEST baseline, not a dirty-tree upload. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const parent='outputs/mufy-opening-bilibili-20261028',dir='outputs/mufy-opening-island-20261028';
const m=JSON.parse(await readFile(`${parent}/manifest.json`,'utf8')),d=JSON.parse(await readFile(`${parent}/deployment.json`,'utf8'));
const path='src/lib/opening/content.ts',ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function read(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const out=await new Response(p.stdout).text();if(await p.exited)throw Error('READ_FAILED');return out;}
if((await read('cd /root/projects/yearn-chat && docker compose port app 3000')).trim()!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
if((await read('cd /root/projects/yearn-chat && docker inspect "$(docker compose ps -q app)" --format "{{.Image}}"')).trim()!==d.image)throw Error('RUNNING_VERSION_CHANGED');
const baseline=await read(`cd /root/projects/yearn-chat && cat ${path}`);
if(baseline.includes('function isWrappedIsland'))throw Error('ALREADY_PATCHED');
const local=await readFile(path,'utf8');
const helper=local.match(/\/\*\* Captured public Mufy frames[\s\S]*?function isWrappedIsland\(html:string\):boolean \{[\s\S]*?\n\}/)?.[0];
const anchor="const FLOATING_EXCLUDE_RE = /parent\\s*\\.\\s*document|window\\s*\\.\\s*parent/i;";
const branch='floating = { ...SIDEBAR_FLOATING_META };\n    } else if (';
if(!helper||baseline.split(anchor).length!==2||baseline.split(branch).length!==2)throw Error('BASELINE_ANCHOR_MISMATCH');
const candidate=baseline.replace(anchor,anchor+'\n\n'+helper).replace(branch,'floating = { ...SIDEBAR_FLOATING_META };\n    } else if (!floating && isWrappedIsland(html)) {\n      floating = { ...DEFAULT_FLOATING_META, needsShim:true };\n    } else if (');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
for(const [folder,value] of [['baseline',baseline],['patch',candidate]] as const){await mkdir(dirname(`${dir}/${folder}/${path}`),{recursive:true});await writeFile(`${dir}/${folder}/${path}`,value);}
await writeFile(`${dir}/patch/Dockerfile.cached-deps`,await readFile(`${parent}/patch/Dockerfile.cached-deps`));
const preservedRenderer=[...m.entries,...m.preservedRenderer].filter(e=>e.path!==path);
await writeFile(`${dir}/manifest.json`,JSON.stringify({...m,recordedAt:new Date().toISOString(),runningImage:d.image,entries:[{path,before:hash(baseline),after:hash(candidate)}],preservedRenderer,scope:'Only known source bookkeeping wrapper plus actual non-script island node; existing opaque local shim. All media restrictions unchanged.'},null,2));
console.log(JSON.stringify({files:1,baselineHash:hash(baseline),candidateHash:hash(candidate),remoteWrites:0}));
