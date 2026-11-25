/** Lossless compression of exact old TEST transfer tar files, byte-hash verified. */
import {writeFile} from 'node:fs/promises';
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(command:string){const p=Bun.spawn([...ssh,command],{stdout:'pipe',stderr:'inherit'});const out=await new Response(p.stdout).text();if(await p.exited)throw Error('ARCHIVE_OPERATION_FAILED');return out;}
const root='/root/mufy-transfer-archive-20261015';
const paths=(await run(`find ${root} -maxdepth 1 -type f -name 'mufy-batch-20261015*.tar' -size +50M -print`)).trim().split(/\r?\n/).filter(Boolean);
if(!paths.length||paths.some(p=>!/^\/root\/mufy-transfer-archive-20261015\/mufy-batch-20261015\d{9}(?:-results)?\.tar$/.test(p)))throw Error('INVALID_ARCHIVE_TARGETS');
const startedAt=new Date().toISOString(),tick=performance.now();
const output=await run(`set -eu
cd /root/projects/yearn-chat
exec 9>.test-release.lock
flock -n 9
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
df -Pk /
${paths.map(p=>`test -f '${p}'
test ! -e '${p}.gz'
before=$(sha256sum '${p}' | cut -d' ' -f1)
gzip -n -1 -c '${p}' > '${p}.gz'
test "$(gzip -cd '${p}.gz' | sha256sum | cut -d' ' -f1)" = "$before"
rm -- '${p}'
printf '%s %s\\n' "$before" '${p}.gz'`).join('\n')}
df -Pk /`);
await writeFile('outputs/mufy-reply-pet-fit-20261028/archive-compression.json',JSON.stringify({startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,kind:'remote-compression-wall-not-agent-net',paths,output,databaseTouched:false,productionTouched:false,volumeChanges:0,recovery:'gzip -d exact .tar.gz restores original bytes; SHA-256 checked before removing uncompressed copy'},null,2));
console.log(output);
