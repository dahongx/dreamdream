/** Build-only recipe: seed existing locked modules, then still verify Bun lock. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='outputs/mufy-reply-pet-ready-20261028';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const dockerfile=await readFile('Dockerfile');
if(hash(dockerfile)!=='4be20ff5ebbc1a7468a261a31b8ac2a5b0927942818115f69e377a6508044a4b')throw Error('DOCKERFILE_CHANGED');
const manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));
if(manifest.runningImage!=='sha256:ef8463766f30484280f7b075ef8cd1e54d18dd229a43352d1e7084f050e62d2e')throw Error('CACHE_IMAGE_CHANGED');
const tag='yearn-chat-app:locked-deps-cache-20261028-ef846';
const anchor='RUN bun install --frozen-lockfile';
if(dockerfile.toString().split(anchor).length!==2)throw Error('INSTALL_HUNK_NOT_UNIQUE');
const recipe=Buffer.from(dockerfile.toString().replace(anchor,`COPY --from=${tag} --chown=0:0 /app/node_modules ./node_modules\nRUN bun install --frozen-lockfile --network-concurrency=2`));
await writeFile(`${dir}/patch/Dockerfile.cached-deps`,recipe);
manifest.cachedDeps={image:manifest.runningImage,tag,dockerfileHash:hash(dockerfile),packageHash:'1f7b134383f942e50d087507cd49627d64bc19031dea19b40a3de475bc7f4166',lockHash:'79430b336441c2e2a680199fe5c2c05563e1bacb038b7e77519be622d6300c1d',recipeHash:hash(recipe),scope:'Only a temporary compose build recipe; repository Dockerfile and dependency versions unchanged; frozen-lockfile verification retained'};
await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));
console.log(JSON.stringify({prepared:true,repoDockerfileChanged:false,versionsChanged:false,networkConcurrency:2}));
