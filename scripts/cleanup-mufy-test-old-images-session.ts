/** Same explicit authorized TEST tags; one SSH session avoids repeated login pressure. */
import {writeFile} from 'node:fs/promises';
const tags=['shared-style-before-20261020213557511','component-fallbacks-before-20261020191012343','before-model-status-20261019','native-table-before-20261019120148525','native-table-before-20261019120359000','message-surface-before-20261019025649863','message-surface-before-20261019030133892','before-refusal-20261019','mufy-source-before-20261015075009696','mufy-source-before-20261015063923454','mufy-source-before-20261015055333949','mufy-source-before-20261015053644961'];
const keep=['latest','stream-before-20261021065136229','statusbar-before-20261021041243056'];
const script=`set -eu
cd /root/projects/yearn-chat
docker compose port app 3000 | grep -qx '0.0.0.0:8091'
df -h /
keep_ids="$(docker image inspect ${keep.map(t=>'yearn-chat-app:'+t).join(' ')} --format '{{.Id}}')"
used_ids="$(docker ps -aq --no-trunc | xargs -r docker inspect --format '{{.Image}}')"
printf 'PRESERVED_IMAGES\\n'
docker image inspect ${keep.map(t=>'yearn-chat-app:'+t).join(' ')} --format '{{.Id}} {{json .RepoTags}}'
for tag in ${tags.join(' ')}; do
 ref="yearn-chat-app:$tag"
 if ! id="$(docker image inspect "$ref" --format '{{.Id}}' 2>/dev/null)"; then printf 'ABSENT %s\\n' "$ref"; continue; fi
 if printf '%s\\n%s\\n' "$keep_ids" "$used_ids" | grep -Fqx "$id"; then printf 'PROTECTED %s %s\\n' "$ref" "$id"; continue; fi
 printf 'REMOVE %s %s\\n' "$ref" "$id"
 docker image rm "$ref"
done
printf 'AFTER_CLEANUP\\n'
df -h /
docker ps -a --filter name=supabase --format '{{.Names}} | {{.Status}}'
docker ps -a --filter name=yearn-chat-app --format '{{.Names}} | {{.Status}} | {{.Ports}}'
`;
const startedAt=new Date().toISOString(),start=performance.now();
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73','sh -s'],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});
p.stdin.write(script);p.stdin.end();
const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,scope:'TEST-explicit-old-image-tags',tags,keep,stdout,stderr,exitCode,databaseConnections:0,volumeChanges:0,forceUsed:false};
await writeFile('logs/mufy-profiles/full-20261013/pilot-5/stream-regression-20261021/authorized-image-cleanup-session.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
if(exitCode!==0)process.exitCode=1;
