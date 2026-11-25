/** Narrow TEST-only deployment. One SSH session, no database operations. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const dir = process.argv.includes('--default-family') ? 'outputs/chat-skin-upgrade/default-family' : process.argv.includes('--allowed-donor') ? 'outputs/chat-skin-upgrade/allowed-donor' : process.argv.includes('--generic-replay-exclusions') ? 'outputs/chat-skin-upgrade/generic-replay-exclusions' : process.argv.includes('--legacy-family') ? 'outputs/chat-skin-upgrade/legacy-family' : process.argv.includes('--family-contrast') ? 'outputs/chat-skin-upgrade/family-contrast' : process.argv.includes('--platform-family') ? 'outputs/chat-skin-upgrade/platform-family' : process.argv.includes('--toolbar-family') ? 'outputs/chat-skin-upgrade/toolbar-family' : process.argv.includes('--control-icons') ? 'outputs/chat-skin-upgrade/control-icons' : 'outputs/chat-skin-upgrade/control-layout';
const path = 'src/lib/styling/whitelist.ts';
const allowed = process.argv.includes('--toolbar-family') ? [path, 'src/components/chat/source-stage.module.css'] : [path];
const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
const preservedTips = process.argv.includes('--preserve-tips')
 ? JSON.parse(await readFile('outputs/reply-suggestions-20261027/release/manifest.json','utf8')).entries as {path:string;after:string}[] : [];
if(preservedTips.some(e=>!/^src\/[a-zA-Z0-9_./-]+$/.test(e.path)||!/^[a-f0-9]{64}$/.test(e.after)))throw Error('INVALID_PRESERVED_MANIFEST');
const tipsGuards=preservedTips.map(e=>`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n');
if (manifest.target !== '115.29.213.73:8091' || manifest.entries.length !== allowed.length || new Set(manifest.entries.map((e: {path: string}) => e.path)).size !== allowed.length)
  throw Error('INVALID_TARGET');
for (const entry of manifest.entries) {
if (!allowed.includes(entry.path) || !/^[a-f0-9]{64}$/.test(entry.before) || !/^[a-f0-9]{64}$/.test(entry.after))
  throw Error('INVALID_MANIFEST');
if (createHash('sha256').update(await readFile(`${dir}/patch/${entry.path}`)).digest('hex') !== entry.after)
  throw Error('CANDIDATE_CHANGED');
}
if (!process.argv.includes('--deploy')) {
  console.log('Local candidate validated; --deploy required for TEST publication.');
  process.exit(0);
}
const archive = Bun.spawn(['tar', '-cf', `${dir}/patch.tar`, '-C', `${dir}/patch`, ...allowed]);
if (await archive.exited) throw Error('ARCHIVE_FAILED');
const startedAt = new Date().toISOString();
const start = performance.now();
const stamp = startedAt.replace(/\D/g, '');
const backup = `/root/mufy-transfer-archive-20261015/chat-skin-${stamp}`;
const rollbackTag = `yearn-chat-app:before-chat-skin-${stamp}`;
const guards = manifest.entries.map((e: {path:string;before:string}) => `test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.before}'`).join('\n');
const uploadGuards = manifest.entries.map((e: {path:string;after:string}) => `test "$(sha256sum ${backup}/patch/${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n');
const copies = allowed.map((p) => `cp ${backup}/patch/${p} ${p}`).join('\n');
const installedGuards = manifest.entries.map((e: {path:string;after:string}) => `test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.after}'`).join('\n');
const command = `set -eu
cd /root/projects/yearn-chat
exec 9>/root/projects/yearn-chat/.test-release.lock
flock -n 9 || { echo TEST_RELEASE_BUSY; exit 1; }
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
expectedRunningImage=$(docker inspect --format '{{.Image}}' yearn-chat-app-1)
export expectedRunningImage
test -n "$expectedRunningImage"
${guards}
${tipsGuards}
df -Pk / /root/projects/yearn-chat /var/lib/docker | awk 'NR>1 {n++; p=$5; sub(/%/,"",p); if ($4<20971520 || p>80) bad=1} END {if(n!=3 || bad) exit 1}'
echo TEST_PREFLIGHT_PASSED
umask 077
mkdir ${backup}
mkdir ${backup}/patch
tar -xf - -C ${backup}/patch
${uploadGuards}
${guards}
tar -cf ${backup}/source-before.tar ${allowed.join(' ')}
printf '%s\\n' "$expectedRunningImage" >${backup}/running-image-before.txt
docker tag "$expectedRunningImage" ${rollbackTag}
${copies}
echo TEST_BUILD_STARTED
if docker compose build app >${backup}/build.log 2>&1; then
  test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = "$expectedRunningImage" || { echo TEST_RUNNING_VERSION_CHANGED_NO_SWITCH; exit 1; }
  ${installedGuards}
  ${tipsGuards}
  builtImage=$(docker image inspect --format '{{.Id}}' yearn-chat-app:latest)
  printf '%s\\n' "$builtImage" >${backup}/built-image.txt
  if docker compose up -d --no-deps app && test "$(docker compose port app 3000)" = '0.0.0.0:8091'; then
    test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = "$builtImage" || { echo TEST_SWITCH_VERSION_MISMATCH; exit 1; }
    echo CONTROL_LAYOUT_DEPLOYED_8091
  else
    actualImage=$(docker inspect --format '{{.Image}}' yearn-chat-app-1)
    test "$actualImage" = "$expectedRunningImage" || test "$actualImage" = "$builtImage" || { echo TEST_CONCURRENT_CHANGE_NO_ROLLBACK; exit 1; }
    ${installedGuards}
    tar -xf ${backup}/source-before.tar
    docker tag ${rollbackTag} yearn-chat-app:latest
    docker compose up -d --no-deps app
    echo TEST_START_FAILED_ROLLED_BACK
    exit 1
  fi
else
  test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = "$expectedRunningImage" || { echo TEST_CONCURRENT_CHANGE_NO_ROLLBACK; exit 1; }
  ${installedGuards}
  tar -xf ${backup}/source-before.tar
  echo TEST_BUILD_FAILED_SOURCE_RESTORED
  exit 1
fi`;
const durable=process.argv.includes('--durable');
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
const split=command.indexOf('echo TEST_BUILD_STARTED');
const detachedCommand=durable ? command.slice(0,split)+`nohup sh -c ${quote('set -eu\ncd /root/projects/yearn-chat\n'+command.slice(split))} >${backup}/release.log 2>&1 </dev/null &\necho DURABLE_RELEASE_STARTED\n` : command;
const proc = Bun.spawn(['ssh', '-F', 'NUL', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3', 'root@115.29.213.73', detachedCommand], {
  stdin: new Uint8Array(await readFile(`${dir}/patch.tar`)), stdout: 'pipe', stderr: 'inherit',
});
let output = '';
for await (const chunk of proc.stdout) {
  const text = new TextDecoder().decode(chunk);
  output += text;
  process.stdout.write(text);
}
const exitCode = await proc.exited;
if(durable){
 const report={startedAt,backup,submitted:output.includes('DURABLE_RELEASE_STARTED'),exitCode,status:'running-or-unknown',productionTouched:false,databaseTouched:false};
 await writeFile(`${dir}/operation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exit(exitCode);
}
const deployed = exitCode === 0 && output.includes('CONTROL_LAYOUT_DEPLOYED_8091');
const report = { startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - start,
  timingKind: 'deployment-wall-time', backup, deployed, exitCode,
  visualAccepted: false, productionTouched: false, databaseTouched: false };
await writeFile(`${dir}/${deployed ? 'deployment' : 'last-deployment-attempt'}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (!deployed) process.exit(1);
