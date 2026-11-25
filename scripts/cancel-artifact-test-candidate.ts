/** Cancel only this task's verified disposable build container before any switch. */
import {writeFile} from 'node:fs/promises';
const command=String.raw`set -eu
cd /root/projects/yearn-chat
test "$(cat /root/mufy-transfer-archive-20261015/artifact-resize-20261028040844517/status)" = BUILDING
test "$(docker inspect --format '{{.Image}}' yearn-chat-app-1)" = 'sha256:feeb804dddfe2fe554f6cc9a259aa0ab09bb23e61e08f79e355d400d83d1ace8'
test "$(docker inspect 9ea1a292ebb6d0a8c25085e84ad8799b8cf37df70d1ca3063e3a063ed8be5943 --format '{{json .Config.Cmd}}')" = '["/bin/sh","-c","bun run build"]'
test "$(docker inspect 9ea1a292ebb6d0a8c25085e84ad8799b8cf37df70d1ca3063e3a063ed8be5943 --format '{{.State.Status}}')" = running
docker kill 9ea1a292ebb6d0a8c25085e84ad8799b8cf37df70d1ca3063e3a063ed8be5943`;
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',command],{stdout:'pipe',stderr:'pipe'});
const [output,diagnostics,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
await writeFile('outputs/mufy-artifact-resize-20261028/candidate-cancellation.json',JSON.stringify({observedAt:new Date().toISOString(),reason:'Use independent sizing data attribute for full-document author body compatibility before release',exitCode,output,diagnostics,productionTouched:false,databaseTouched:false},null,2));
console.log(JSON.stringify({exitCode,output,diagnostics}));
