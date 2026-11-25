import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
const dir='outputs/mask-release-20261028';
const manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8')) as {target:string;entries:{path:string;before:string|null;after:string}[]};
const allowed=['src/components/chat/MaskDialog.tsx','src/lib/masks/actions.ts','src/lib/masks/limits.ts',...['types','zh','zh-TW','en','ja-JP','th-TH'].map(x=>`src/i18n/${x}.ts`)];
if(manifest.target!=='115.29.213.73:8091'||manifest.entries.length!==9||new Set(manifest.entries.map(e=>e.path)).size!==9||manifest.entries.some(e=>!allowed.includes(e.path)||! /^[a-f0-9]{64}$/.test(e.after)||(e.before!==null&&! /^[a-f0-9]{64}$/.test(e.before))))throw Error('BAD_MANIFEST');
for(const e of manifest.entries)if(createHash('sha256').update(await readFile(`${dir}/patch/${e.path}`)).digest('hex')!==e.after)throw Error('CANDIDATE_CHANGED');
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false,input?:Uint8Array){const p=Bun.spawn(args,{stdin:input??'ignore',stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('COMMAND_FAILED');return out.trim();}
await requireTestDiskCapacity(run,ssh);
const stamp=new Date().toISOString().replace(/\D/g,''),backup=`/root/mufy-transfer-archive-20261015/mask-${stamp}`;
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
const guards=(after:boolean)=>manifest.entries.map(e=>!after&&e.before===null?`test ! -e ${e.path}`:`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${after?e.after:e.before}'`).join('\n');
const restore=`tar -xf ${backup}/source-before.tar
${manifest.entries.filter(e=>e.before===null).map(e=>`mv ${e.path} ${backup}/failed-added/`).join('\n')}`;
const build=`set -eu
cd /root/projects/yearn-chat
running_image() { docker inspect yearn-chat-app-1 --format '{{.Image}}'; }
original_image=$(cat ${backup}/running-image-before.txt)
candidate_image=''
rollback() {
  current_image=$(running_image)
  test "$current_image" = "$original_image" || test "$current_image" = "$candidate_image" || { echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status; exit 1; }
  ${guards(true)}
  ${restore}
  docker tag "$original_image" yearn-chat-app:latest
  docker compose up -d --no-deps app
  echo FAILED_ROLLED_BACK > ${backup}/status
}
echo BUILDING > ${backup}/status
if docker compose build app >${backup}/build.log 2>&1; then
  test "$(running_image)" = "$original_image" || { echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status; exit 1; }
  ${guards(true)}
  sha256sum -c ${backup}/preserved.sha256 >${backup}/preserved-check.log
  candidate_image=$(docker image inspect yearn-chat-app:latest --format '{{.Id}}')
  printf '%s\\n' "$candidate_image" > ${backup}/candidate-image.txt
  echo SWITCHING > ${backup}/status
  if docker compose up -d --no-deps app; then
    test "$(running_image)" = "$candidate_image"
    test "$(docker compose port app 3000)" = '0.0.0.0:8091'
    healthy=0
    for attempt in $(seq 1 30); do
      if curl -fsS --max-time 5 http://127.0.0.1:8091/explore >/dev/null; then healthy=1; break; fi
      sleep 2
    done
    if test "$healthy" = 1; then echo DEPLOYED > ${backup}/status; else rollback; fi
  else rollback; fi
else rollback; fi`;
const preflight=`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect yearn-chat-app-1 --format '{{.Image}}')" = 'sha256:9c161092cc7497f43a131be453c69e12ba2bea7164cf7fac7dc739c8ab491853'
${guards(false)}
df -Pk / | awk 'NR>1 {p=$5; sub(/%/,"",p); if ($4<20971520 || p>80) exit 1}'
umask 077
mkdir -p ${backup}/patch ${backup}/failed-added
tar -xf - -C ${backup}/patch
${manifest.entries.map(e=>`test "$(sha256sum ${backup}/patch/${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n')}
tar -cf ${backup}/source-before.tar ${manifest.entries.filter(e=>e.before!==null).map(e=>e.path).join(' ')}
find src -type f ${allowed.map(p=>`! -path '${p}'`).join(' ')} -print0 | sort -z | xargs -0 sha256sum > ${backup}/preserved.sha256
original_image=$(docker inspect yearn-chat-app-1 --format '{{.Image}}')
printf '%s\\n' "$original_image" > ${backup}/running-image-before.txt
docker tag "$original_image" yearn-chat-app:before-mask-${stamp}
${allowed.map(p=>`cp ${backup}/patch/${p} ${p}`).join('\n')}
${guards(true)}
nohup sh -c ${quote(build)} >${backup}/release.log 2>&1 </dev/null &
echo DURABLE_MASK_RELEASE_STARTED`;
await run(['tar','-cf',`${dir}/patch.tar`,'-C',`${dir}/patch`,...allowed]);
await writeFile(`${dir}/operation.json`,JSON.stringify({backup,stamp,target:'TEST-8091',status:'submitting'},null,2));
const out=await run([...ssh,preflight],true,new Uint8Array(await readFile(`${dir}/patch.tar`)));
console.log(JSON.stringify({backup,out}));
