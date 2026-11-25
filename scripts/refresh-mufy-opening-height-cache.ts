/** Pin full locked dependencies from current verified TEST runtime. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-opening-height-20261028',m=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));
const image='sha256:affd28a7271d50ded189b441eba2c59e5444e2e1cefa19f30fa7e0b9143bb7f1',tag='yearn-chat-app:locked-deps-cache-20261028-affd2';
if(m.runningImage!==image)throw Error('WRONG_RUNTIME');
const p=Bun.spawn(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',`set -eu
cd /root/projects/yearn-chat
test "$(docker compose port app 3000)" = '0.0.0.0:8091'
test "$(docker inspect "$(docker compose ps -q app)" --format '{{.Image}}')" = '${image}'
sha256sum bun.lock
docker run --rm --network none --read-only --entrypoint sha256sum '${image}' /app/package.json
docker tag '${image}' '${tag}'`],{stdout:'pipe',stderr:'inherit'});
const out=await new Response(p.stdout).text();if(await p.exited||!out.includes(m.cachedDeps.packageHash)||!out.includes(m.cachedDeps.lockHash))throw Error('LOCKED_CACHE_NOT_VERIFIED');
const recipe=(await readFile(`${dir}/patch/Dockerfile.cached-deps`,'utf8')).replace(m.cachedDeps.tag,tag);
await writeFile(`${dir}/patch/Dockerfile.cached-deps`,recipe);
m.cachedDeps={...m.cachedDeps,image,tag,recipeHash:createHash('sha256').update(recipe).digest('hex')};
await writeFile(`${dir}/manifest.json`,JSON.stringify(m,null,2));console.log(JSON.stringify({verified:true,versionsChanged:false,repoDockerfileChanged:false}));
