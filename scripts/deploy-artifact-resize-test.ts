/** Three reviewed renderer files, TEST 8091 only. Durable lock and guarded rollback. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { requireTestDiskCapacity } from './mufy-test-disk-preflight';
const isolated=process.argv.includes('--source-component-isolation');
const petOwner=process.argv.includes('--reply-pet-owner');
const petBootstrap=process.argv.includes('--reply-pet-bootstrap');
const petReady=process.argv.includes('--reply-pet-ready');
const petDrag=process.argv.includes('--reply-pet-drag');
const petFit=process.argv.includes('--reply-pet-fit');
const openingHeight=process.argv.includes('--opening-height');
const openingIsland=process.argv.includes('--opening-island');
const bilibili=process.argv.includes('--with-bilibili-player');
if(bilibili&&!openingHeight)throw Error('PLAYER_REQUIRES_OPENING_MODE');
const pet=process.argv.includes('--reply-pet')||petOwner||petBootstrap||petReady||petDrag||petFit||openingHeight;
const dir=openingIsland?'outputs/mufy-opening-island-20261028':bilibili?'outputs/mufy-opening-bilibili-20261028':openingHeight?'outputs/mufy-opening-height-20261028':petFit?'outputs/mufy-reply-pet-fit-20261028':petDrag?'outputs/mufy-reply-pet-drag-20261028':petReady?'outputs/mufy-reply-pet-ready-20261028':petBootstrap?'outputs/mufy-reply-pet-bootstrap-20261028':petOwner?'outputs/mufy-reply-pet-owner-20261028':pet?'outputs/mufy-reply-pet-20261028':process.argv.includes('--source-envelope-form-newlines')?'outputs/mufy-source-envelope-form-newlines-20261028':isolated?'outputs/mufy-source-component-isolation-20261028':'outputs/mufy-artifact-resize-20261028';
const allowed=openingIsland?['src/lib/opening/content.ts']:bilibili?['src/lib/regex/iframe-bridge.ts','src/components/regex/RegexIframe.tsx']:openingHeight?['src/lib/regex/iframe-bridge.ts']:petDrag||petFit?['src/lib/import/mufy-reply-pet.ts']:petReady?['src/components/chat/MufyReplyPet.tsx','src/lib/import/mufy-reply-pet.ts']:petBootstrap?['src/lib/import/mufy-reply-pet.ts']:petOwner?['src/components/chat/MessageBubble.tsx']:pet?['src/components/chat/MufyReplySidebar.tsx','src/components/chat/MufyReplyPet.tsx','src/lib/import/mufy-reply-pet.ts']:isolated?['src/lib/import/mufy-source-rule-envelope.ts']:['src/lib/regex/iframe-bridge.ts','src/components/chat/messages/ArtifactIframe.tsx','src/components/chat/MessageRenderer.tsx'];
const manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8')) as {target:string;runningImage?:string;entries:{path:string;before:string;after:string}[];preservedTips:{path:string;after:string}[];preservedRenderer?:{path:string;after:string}[];cachedDeps?:{image:string;tag:string;dockerfileHash:string;packageHash:string;lockHash:string;recipeHash:string}};
const cache=process.argv.includes('--cached-deps')?manifest.cachedDeps:undefined;
if(process.argv.includes('--cached-deps')&&(!(petReady||petDrag||petFit||openingHeight)||!cache))throw Error('INVALID_CACHED_BUILD_SCOPE');
if(cache&&(!((cache.image==='sha256:ef8463766f30484280f7b075ef8cd1e54d18dd229a43352d1e7084f050e62d2e'&&cache.tag==='yearn-chat-app:locked-deps-cache-20261028-ef846')||(openingHeight&&cache.image==='sha256:affd28a7271d50ded189b441eba2c59e5444e2e1cefa19f30fa7e0b9143bb7f1'&&cache.tag==='yearn-chat-app:locked-deps-cache-20261028-affd2'))||[cache.dockerfileHash,cache.packageHash,cache.lockHash,cache.recipeHash].some(h=>!/^[a-f0-9]{64}$/.test(h))))throw Error('INVALID_LOCKED_CACHE');
if(manifest.target!=='115.29.213.73:8091'||manifest.entries.length!==allowed.length||new Set(manifest.entries.map(e=>e.path)).size!==allowed.length||manifest.entries.some(e=>!allowed.includes(e.path)||!(pet&&e.before==='ABSENT')&&! /^[a-f0-9]{64}$/.test(e.before)||! /^[a-f0-9]{64}$/.test(e.after)))throw Error('INVALID_MANIFEST');
if(manifest.preservedTips.length!==10||manifest.preservedTips.some(e=>!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||! /^[a-f0-9]{64}$/.test(e.after)))throw Error('INVALID_TIPS_GUARDS');
if(manifest.runningImage&&!/^sha256:[a-f0-9]{64}$/.test(manifest.runningImage))throw Error('INVALID_IMAGE_GUARD');
for(const e of manifest.entries)if(createHash('sha256').update(await readFile(`${dir}/patch/${e.path}`)).digest('hex')!==e.after)throw Error('CANDIDATE_CHANGED');
if(cache&&createHash('sha256').update(await readFile(`${dir}/patch/Dockerfile.cached-deps`)).digest('hex')!==cache.recipeHash)throw Error('CACHE_RECIPE_CHANGED');
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false,input?:Uint8Array){const p=Bun.spawn(args,{stdin:input??'ignore',stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('TEST_COMMAND_FAILED');return out.trim();}
if(await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true)!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
await requireTestDiskCapacity(run,ssh);
if(!process.argv.includes('--deploy'))process.exit(0);
const startedAt=new Date().toISOString(),stamp=startedAt.replace(/\D/g,''),backup=`/root/mufy-transfer-archive-20261015/${openingHeight?'reply-pet-opening-height':petFit?'reply-pet-fit':petDrag?'reply-pet-drag':petReady?'reply-pet-ready':petBootstrap?'reply-pet-bootstrap':petOwner?'reply-pet-owner':pet?'reply-pet':isolated?'source-component-isolation':'artifact-resize'}-${stamp}`;
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
const guards=(side:'before'|'after')=>manifest.entries.map(e=>e[side]==='ABSENT'?`test ! -e ${e.path}`:`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e[side]}'`).join('\n');
const preserved=[...manifest.preservedTips,...manifest.preservedRenderer??[]];
if(preserved.some(e=>!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||! /^[a-f0-9]{64}$/.test(e.after)))throw Error('INVALID_PRESERVED_GUARD');
const tips=preserved.map(e=>`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n');
const dependencyGuards=cache?`test "$(sha256sum Dockerfile | cut -d' ' -f1)" = '${cache.dockerfileHash}'\ntest "$(sha256sum package.json | cut -d' ' -f1)" = '${cache.packageHash}'\ntest "$(sha256sum bun.lock | cut -d' ' -f1)" = '${cache.lockHash}'`:'';
const restore=`tar -xf ${backup}/source-before.tar\n${manifest.entries.filter(e=>e.before==='ABSENT').map(e=>`rm -- ${e.path}`).join('\n')}`;
const uploads=manifest.entries.map(e=>`test "$(sha256sum ${backup}/patch/${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n');
const build=`set -eu
cd /root/projects/yearn-chat
running_image() { docker inspect "$(docker compose ps -q app)" --format '{{.Image}}'; }
original_image=$(cat ${backup}/running-image-before.txt)
echo BUILDING > ${backup}/status
if docker compose ${cache?`-f docker-compose.yml -f ${backup}/patch/build-override.yml `:''}build app >${backup}/build.log 2>&1; then
  test "$(running_image)" = "$original_image" || { echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status; exit 1; }
  ${guards('after')}
  ${tips}
  ${dependencyGuards}
  candidate_image=$(docker image inspect yearn-chat-app:latest --format '{{.Id}}')
  printf '%s\\n' "$candidate_image" > ${backup}/candidate-image.txt
  echo SWITCHING > ${backup}/status
  if docker compose up -d --no-deps app; then
    test "$(running_image)" = "$candidate_image" || { echo SWITCH_VERSION_NEEDS_REVIEW > ${backup}/status; exit 1; }
    test "$(docker compose port app 3000)" = '0.0.0.0:8091'
    ${tips}
    date +%s > ${backup}/completed-epoch.txt
    echo DEPLOYED > ${backup}/status
  else
    current_image=$(running_image)
    test "$current_image" = "$original_image" || test "$current_image" = "$candidate_image" || { echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status; exit 1; }
    ${guards('after')}
    ${restore}
    docker tag "$original_image" yearn-chat-app:latest
    docker compose up -d --no-deps app
    echo START_FAILED_ROLLED_BACK > ${backup}/status
    exit 1
  fi
else
  test "$(running_image)" = "$original_image" || { echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status; exit 1; }
  ${guards('after')}
  ${restore}
  echo BUILD_FAILED_SOURCE_RESTORED > ${backup}/status
  exit 1
fi`;
const preflight=`set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
${guards('before')}
${tips}
${dependencyGuards}
${manifest.runningImage?`test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${manifest.runningImage}'`:''}
df -Pk / /root/projects/yearn-chat /var/lib/docker | awk 'NR>1 {n++; p=$5; sub(/%/,"",p); if ($4<20971520 || p>80) bad=1} END {if(n!=3 || bad) exit 1}'
umask 077
mkdir -p ${backup}/patch
tar -xf - -C ${backup}/patch
${uploads}
${cache?`test "$(sha256sum ${backup}/patch/Dockerfile.cached-deps | cut -d' ' -f1)" = '${cache.recipeHash}'
docker tag '${cache.image}' '${cache.tag}'
test "$(docker run --rm --network none --read-only --entrypoint sha256sum '${cache.tag}' /app/package.json | cut -d' ' -f1)" = '${cache.packageHash}'`:''}
tar -cf ${backup}/source-before.tar ${manifest.entries.filter(e=>e.before!=='ABSENT').map(e=>e.path).join(' ')}
original_image=$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')
test -n "$original_image"
printf '%s\\n' "$original_image" > ${backup}/running-image-before.txt
docker tag "$original_image" yearn-chat-app:before-artifact-resize-${stamp}
${allowed.map(p=>`cp ${backup}/patch/${p} ${p}`).join('\n')}
${guards('after')}
nohup sh -c ${quote(build)} >${backup}/release.log 2>&1 </dev/null &
echo DURABLE_TEST_RELEASE_STARTED`;
if(cache)await writeFile(`${dir}/patch/build-override.yml`,`services:\n  app:\n    build:\n      dockerfile: ${backup}/patch/Dockerfile.cached-deps\n`);
await run(['tar','-cf',`${dir}/patch.tar`,'-C',`${dir}/patch`,...allowed,...cache?['Dockerfile.cached-deps','build-override.yml']:[]]);
if(await Bun.file(`${dir}/operation.json`).exists()){
 const previous=await readFile(`${dir}/operation.json`,'utf8');
 const prior=JSON.parse(previous) as {startedAt:string};
 await writeFile(`${dir}/operation-${prior.startedAt.replace(/\D/g,'')}.json`,previous);
}
await writeFile(`${dir}/operation.json`,JSON.stringify({startedAt,backup,target:'TEST-8091',status:'submitting',productionTouched:false,databaseTouched:false},null,2));
const output=await run([...ssh,preflight],true,new Uint8Array(await readFile(`${dir}/patch.tar`)));
await writeFile(`${dir}/operation.json`,JSON.stringify({startedAt,backup,target:'TEST-8091',status:output.includes('DURABLE_TEST_RELEASE_STARTED')?'running':'unknown',productionTouched:false,databaseTouched:false},null,2));
console.log(JSON.stringify({backup,output,visualAccepted:false}));
