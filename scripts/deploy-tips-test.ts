/** Scoped TEST-only deployment; hash guards, source/image backup, rollback. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { requireTestDiskCapacity } from "./mufy-test-disk-preflight";
const alignmentOnly=process.argv.includes('--alignment-only');
const manifestFix=process.argv.includes('--character-manifest-fix');
const dir=manifestFix?"outputs/character-manifest-fix-20261028":alignmentOnly?"outputs/reply-suggestions-20261027/alignment":"outputs/reply-suggestions-20261027/release";
const manifest=JSON.parse(await readFile(`${dir}/manifest.json`,"utf8")) as {entries:{path:string;before:string|null;after:string}[]};
const allowed=manifestFix?["package.json","bun.lock","patches/next@16.2.6.patch","scripts/check-character-client-manifest.ts"]:alignmentOnly?["src/components/chat/ChatRoom.tsx"]:["src/components/chat/ChatRoom.tsx","src/components/chat/ReplySuggestions.tsx","src/lib/chat/reply-suggestions.ts","src/app/api/chat/suggestions/route.ts",...['types','zh','zh-TW','en','ja-JP','th-TH'].map(x=>`src/i18n/${x}.ts`)];
if(manifest.entries.length!==allowed.length||new Set(manifest.entries.map(e=>e.path)).size!==allowed.length||manifest.entries.some(e=>!allowed.includes(e.path)))throw Error("INVALID_MANIFEST");
const ssh=["ssh","-o","BatchMode=yes","-o","ConnectTimeout=10","root@115.29.213.73"];
async function run(args:string[],capture=false,input?:Uint8Array){const p=Bun.spawn(args,{stdin:input??"ignore",stdout:capture?"pipe":"inherit",stderr:"inherit"});const out=capture?await new Response(p.stdout).text():"";if(await p.exited)throw Error("COMMAND_FAILED");return out.trim();}
if(await run([...ssh,"cd /root/projects/yearn-chat && docker compose port app 3000"],true)!=="0.0.0.0:8091")throw Error("WRONG_TARGET");
for(const e of manifest.entries){
 if(createHash("sha256").update(await readFile(`${dir}/patch/${e.path}`)).digest("hex")!==e.after)throw Error("CANDIDATE_CHANGED");
 const actual=await run([...ssh,e.before?`sha256sum /root/projects/yearn-chat/${e.path}`:`test -e /root/projects/yearn-chat/${e.path} && echo exists || echo absent`],true);
 if(e.before?!actual.startsWith(e.before):actual!=="absent")throw Error(`REMOTE_CHANGED:${e.path}`);
}
await requireTestDiskCapacity(run,ssh);
if(!process.argv.includes("--deploy"))process.exit(0);
const stamp=new Date().toISOString().replace(/\D/g,"");const backup=`/root/mufy-transfer-archive-20261015/tips-${stamp}`;
await run(["tar","-cf",`${dir}/patch.tar`,"-C",`${dir}/patch`,...allowed]);
await run([...ssh,`umask 077; mkdir -p ${backup}/patch ${backup}/failed-added`]);
await run([...ssh,`tar -xf - -C ${backup}/patch`],false,new Uint8Array(await readFile(`${dir}/patch.tar`)));
let buildCommand="docker compose build app";
let cacheGuard="";
if(manifestFix && process.argv.includes('--cached-deps')) {
 const cache=JSON.parse(await readFile(`${dir}/cached-build.json`,"utf8"));
 if(!/^sha256:[a-f0-9]{64}$/.test(cache.image)||! /^[a-f0-9]{64}$/.test(cache.originalDockerfileHash))throw Error('INVALID_CACHE');
 await writeFile(`${dir}/cached-compose.yml`,`services:\n  app:\n    build:\n      dockerfile: ${backup}/cached.Dockerfile\n`);
 await run(["tar","-cf",`${dir}/cached.tar`,"-C",dir,"cached.Dockerfile","cached-compose.yml"]);
 await run([...ssh,`tar -xf - -C ${backup}`],false,new Uint8Array(await readFile(`${dir}/cached.tar`)));
 buildCommand=`docker compose -f docker-compose.yml -f ${backup}/cached-compose.yml build app`;
 cacheGuard=`test "$(running_image)" = '${cache.image}'\ntest "$(sha256sum Dockerfile | cut -d' ' -f1)" = '${cache.originalDockerfileHash}'`;
}
const old=manifest.entries.filter(e=>e.before).map(e=>e.path);
const added=manifest.entries.filter(e=>!e.before).map(e=>e.path);
const guards=manifest.entries.map(e=>e.before?`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.before}'`:`test ! -e ${e.path}`).join('; ');
const copies=allowed.map(p=>`mkdir -p $(dirname ${p}); cp ${backup}/patch/${p} ${p}`).join('; ');
const rollback=`tar -xf ${backup}/source-before.tar; ${added.map((p,i)=>`test ! -f ${p} || mv ${p} ${backup}/failed-added/${i}`).join('; ')}`;
const afterGuards=manifest.entries.map(e=>`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n');
const uploadGuards=manifest.entries.map(e=>`test "$(sha256sum ${backup}/patch/${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n');
// No reconnect handler may roll back: first inspect the persisted remote status.
const critical=`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
${guards}
${uploadGuards}
df -Pk / /root/projects/yearn-chat /var/lib/docker | awk 'NR>1 {n++; p=$5; sub(/%/,"",p); if ($4<20971520 || p>80) bad=1} END {if(n!=3 || bad) exit 1}'
running_image() { docker inspect "$(docker compose ps -q app)" --format '{{.Image}}'; }
release_original=$(running_image)
${cacheGuard}
test -n "$release_original"
printf '%s\\n' "$release_original" > ${backup}/running-image-before.txt
tar -cf ${backup}/source-before.tar ${old.join(' ')}
docker tag "$release_original" yearn-chat-app:before-tips-${stamp}
${copies}
${afterGuards}
test "$(running_image)" = "$release_original"
echo BUILDING > ${backup}/status
if ${buildCommand} >${backup}/build.log 2>&1; then
  release_candidate=$(docker image inspect yearn-chat-app:latest --format '{{.Id}}')
  printf '%s\\n' "$release_candidate" > ${backup}/candidate-image.txt
  if test "$(running_image)" != "$release_original"; then
    echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status
    exit 1
  fi
  ${afterGuards}
  echo SWITCHING > ${backup}/status
  if docker compose up -d --no-deps app && test "$(running_image)" = "$release_candidate" && test "$(docker compose port app 3000)" = '0.0.0.0:8091'; then
    echo DEPLOYED > ${backup}/status
    echo TIPS_DEPLOYED
  else
    release_current=$(running_image) || { echo START_FAILED_NEEDS_REVIEW > ${backup}/status; exit 1; }
    if test "$release_current" != "$release_original" && test "$release_current" != "$release_candidate"; then
      echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status
      exit 1
    fi
    ${afterGuards}
    ${rollback}
    docker tag "$release_original" yearn-chat-app:latest
    docker compose up -d --no-deps app
    test "$(running_image)" = "$release_original"
    echo START_FAILED_ROLLED_BACK > ${backup}/status
    exit 1
  fi
else
  if test "$(running_image)" != "$release_original"; then
    echo CONCURRENT_RELEASE_NEEDS_REVIEW > ${backup}/status
    exit 1
  fi
  ${afterGuards}
  ${rollback}
  echo BUILD_FAILED_SOURCE_RESTORED > ${backup}/status
  tail -35 ${backup}/build.log
  exit 1
fi`;
const shellQuote=(value:string)=>`'${value.replaceAll("'", "'\\''")}'`;
await writeFile(`${dir}/deployment-pending.json`,JSON.stringify({backup,stamp,target:"TEST-8091"}));
await run([...ssh,`flock -n /root/projects/yearn-chat/.test-release.lock bash -c ${shellQuote(critical)}`]);
await writeFile(`${dir}/deployment.json`,JSON.stringify({backup,stamp,target:"TEST-8091",deployed:true,productionTouched:false,githubPushed:false,visualAccepted:false},null,2));
console.log("TEST deployed; browser acceptance still required");
