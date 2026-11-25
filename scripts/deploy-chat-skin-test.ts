/** Deploy only the reviewed eight-file TEST candidate; no database operations. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { requireTestDiskCapacity } from './mufy-test-disk-preflight';
const followup = process.argv.includes('--mask-skin-followup');
const layoutFix = process.argv.includes('--control-layout');
const shellFix = layoutFix || process.argv.includes('--model-shell');
const dir = layoutFix ? 'outputs/chat-skin-upgrade/control-layout' : shellFix ? 'outputs/chat-skin-upgrade/model-shell' : followup ? 'outputs/chat-skin-upgrade/mask-skin-followup' : 'outputs/chat-skin-upgrade/release-candidate';
const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8')) as {entries: {path: string; before: string|null; after: string}[]};
const allowed = followup ? ['src/components/chat/MaskDialog.tsx', ...['types','zh','zh-TW','en','ja-JP','th-TH'].map(x=>`src/i18n/${x}.ts`),'src/lib/styling/whitelist.ts'] : ['src/components/chat/ChatStage.tsx','src/components/chat/OpeningSlot.tsx','src/lib/styling/whitelist.ts','src/components/chat/ChatRoom.tsx','src/lib/import/mufy-migration.ts','src/components/chat/source-stage.module.css','src/lib/styling/style-block-boundary.ts','src/lib/import/mufy-component-presentation.ts'];
if (shellFix) allowed.splice(0, allowed.length, 'src/lib/styling/whitelist.ts');
if(manifest.entries.length !== allowed.length || new Set(manifest.entries.map(e=>e.path)).size !== allowed.length || manifest.entries.some(e=>!allowed.includes(e.path))) throw Error('INVALID_MANIFEST');
const ssh = ['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false,input?:Uint8Array) {
  const p=Bun.spawn(args,{stdin:input??'ignore',stdout:capture?'pipe':'inherit',stderr:'inherit'});
  const out=capture?await new Response(p.stdout).text():'';
  if(await p.exited)throw Error('COMMAND_FAILED');
  return out.trim();
}
if(await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true)!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
for(const entry of manifest.entries){
  const body=await readFile(`${dir}/patch/${entry.path}`);
  if(createHash('sha256').update(body).digest('hex')!==entry.after)throw Error('CANDIDATE_CHANGED');
  const actual=await run([...ssh,entry.before?`sha256sum /root/projects/yearn-chat/${entry.path}`:`test -e /root/projects/yearn-chat/${entry.path} && echo exists || echo absent`],true);
  if(entry.before ? !actual.startsWith(entry.before+' ') : actual!=='absent')throw Error('REMOTE_CHANGED: '+entry.path);
}
await requireTestDiskCapacity(run,ssh);
if(!process.argv.includes('--deploy'))process.exit(0);
const start=performance.now(),startedAt=new Date().toISOString(),stamp=startedAt.replace(/\D/g,'');
const backup=`/root/mufy-transfer-archive-20261015/chat-skin-${stamp}`;
await run(['tar','-cf',`${dir}/patch.tar`,'-C',`${dir}/patch`,...allowed]);
await run([...ssh,`umask 077; mkdir -p ${backup}/patch`]);
await run([...ssh,`tar -xf - -C ${backup}/patch`],false,new Uint8Array(await readFile(`${dir}/patch.tar`)));
for(const e of manifest.entries){
  if(!(await run([...ssh,`sha256sum ${backup}/patch/${e.path}`],true)).startsWith(e.after+' '))throw Error('UPLOAD_MISMATCH');
}
const existing=manifest.entries.filter(e=>e.before).map(e=>e.path);
const added=manifest.entries.filter(e=>!e.before).map(e=>e.path);
const guards=manifest.entries.map(e=>e.before?`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.before}'`:`test ! -e ${e.path}`).join('; ');
const copies=allowed.map(p=>`cp ${backup}/patch/${p} ${p}`).join('; ');
const rollback=`tar -xf ${backup}/source-before.tar${added.length ? '; rm -f '+added.join(' ') : ''}`;
await run([...ssh,`set -e; cd /root/projects/yearn-chat; ${guards}; tar -cf ${backup}/source-before.tar ${existing.join(' ')}; docker tag yearn-chat-app:latest yearn-chat-app:before-chat-skin-${stamp}; ${copies}; if docker compose build app >${backup}/build.log 2>&1; then if docker compose up -d --no-deps app; then echo CHAT_SKIN_DEPLOYED; else ${rollback}; docker tag yearn-chat-app:before-chat-skin-${stamp} yearn-chat-app:latest; docker compose up -d --no-deps app; exit 1; fi; else ${rollback}; echo CHAT_SKIN_BUILD_FAILED; exit 1; fi`]);
const port=await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true);
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,backup,port,deployed:true,visualAccepted:false,productionTouched:false,databaseTouched:false};
await writeFile(`${dir}/deployment.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
