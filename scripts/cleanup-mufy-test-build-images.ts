/** Remove only untagged build artifacts matched to recorded TEST deployment windows. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
const root='logs/mufy-profiles/full-20261013/pilot-5';
type Image={id:string;tags:string[];created:string;workdir:string;layers:string[]};
const audit=JSON.parse(await readFile(root+'/stream-regression-20261021/build-image-audit.json','utf8')) as {images:Image[];candidates:Image[]};
const base=audit.images.find(i=>i.tags?.includes('oven/bun:1.3-alpine'))!;
const windows:Array<{name:string;start:number;end:number}>=[];
for(const name of await readdir(root))if(/^(source-rules-deploy|component-fallbacks|message-surface|native-table|shared-style|statusbar|stream)-\d+\.json$/.test(name)){
 const j=JSON.parse(await readFile(root+'/'+name,'utf8'));if(j.startedAt&&j.finishedAt)windows.push({name,start:Date.parse(j.startedAt),end:Date.parse(j.finishedAt)});
}
const targets=audit.candidates.filter(i=>i.workdir==='/app'&&base.layers.every((l,n)=>i.layers[n]===l)&&windows.some(w=>Date.parse(i.created)>=w.start&&Date.parse(i.created)<=w.end)).sort((a,b)=>b.layers.length-a.layers.length);
if(!targets.length||targets.some(i=>!/^sha256:[a-f0-9]{64}$/.test(i.id)))throw Error('INVALID_TARGET_SET');
const plan={targets:targets.map(i=>({id:i.id,created:i.created,layers:i.layers.length,deployments:windows.filter(w=>Date.parse(i.created)>=w.start&&Date.parse(i.created)<=w.end).map(w=>w.name)})),windows,scope:'Recorded TEST builds; no named images, used container images or volumes'};
await writeFile(root+'/stream-regression-20261021/build-cleanup-plan.json',JSON.stringify(plan,null,2));
console.log(JSON.stringify({planned:targets.length,execute:process.argv.includes('--execute')}));
if(!process.argv.includes('--execute'))process.exit(0);
const script=`set -eu
cd /root/projects/yearn-chat
docker compose port app 3000 | grep -qx '0.0.0.0:8091'
df -B1 /
used_ids="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
for id in ${targets.map(i=>i.id).join(' ')}; do
 if ! tags="$(docker image inspect "$id" --format '{{len .RepoTags}}' 2>/dev/null)"; then printf 'ABSENT %s\\n' "$id"; continue; fi
 if test "$tags" != 0; then printf 'PROTECTED_TAGGED %s\\n' "$id"; continue; fi
 if printf '%s\\n' "$used_ids" | grep -Fqx "$id"; then printf 'PROTECTED_USED %s\\n' "$id"; continue; fi
 printf 'REMOVE %s\\n' "$id"
 if ! docker image rm "$id"; then printf 'REFUSED %s\\n' "$id"; fi
done
df -B1 /
docker images --filter reference='yearn-chat-app*' --format '{{.Repository}}:{{.Tag}} | {{.ID}}'
docker ps -a --filter name=supabase --format '{{.Names}} | {{.Status}}'
`;
const startedAt=new Date().toISOString(),start=performance.now();
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73','sh -s'],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});p.stdin.write(script);p.stdin.end();
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile(root+'/stream-regression-20261021/build-cleanup-result.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,exitCode,stdout,stderr,databaseConnections:0,volumeChanges:0,forceUsed:false},null,2));
console.log(JSON.stringify({exitCode,outputTail:stdout.slice(-3500),errorTail:stderr.slice(-1200)}));if(exitCode)process.exitCode=1;
