import {readFile,writeFile} from 'node:fs/promises';
const out='outputs/mask-production-20261028',host='lusu@64.204.66.11';
const root='/home/lusu/dearm-production-prep-20261020';
const release=`${root}/release-mask-20261028`;
const manifest=JSON.parse(await readFile(`${out}/manifest.json`,'utf8')) as {baselineImage:string;entries:{path:string;before:string|null;after:string}[]};
async function run(args:string[],input?:Uint8Array){const p=Bun.spawn(args,{stdin:input??'ignore',stdout:'pipe',stderr:'pipe'});const [stdout,stderr,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error(stderr+stdout);return stdout.trim();}
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
const build=`set -eu
echo BUILDING > ${release}/status
if docker run --rm --name dearm-mask-build-20261028 --cpus=2 --memory=4g --env-file ${root}/same-origin-build.env -v ${release}/source:/build -w /build --entrypoint sh ${manifest.baselineImage} -c 'ln -s /app/node_modules /build/node_modules; bun run build' > ${release}/build.log 2>&1; then
 cd ${release}
 if docker build -t dearm-mask:20261028 . > image-build.log 2>&1; then echo READY > status; else echo IMAGE_BUILD_FAILED > status; fi
else echo BUILD_FAILED > ${release}/status; fi`;
await run(['tar','-cf',`${out}/patch.tar`,'-C',`${out}/patch`,...manifest.entries.map(e=>e.path)]);
const pre=`set -eu
exec 9>${root}/.production-release.lock
flock -n 9
test "$(docker inspect yearn-chat-app-1 --format '{{.Image}}')" = '${manifest.baselineImage}'
test ! -e ${release}
umask 077
mkdir -p ${release}/source ${release}/patch
tar -xf - -C ${release}/patch
cd ${root}/release-explore-20261027/source
${manifest.entries.filter(e=>e.before!==null).map(e=>`test "$(sha256sum ${e.path} | cut -d' ' -f1)" = '${e.before}'`).join('\n')}
tar --exclude=./.next --exclude=./node_modules --exclude=./.git --exclude='./.env*' -cf - . | tar -xf - -C ${release}/source
cp ${root}/cutover-20261024/production-compose.json ${release}/compose-before.json
docker tag '${manifest.baselineImage}' dearm-mask:rollback-20261028
cd ${release}/source
find src -type f ${manifest.entries.map(e=>`! -path '${e.path}'`).join(' ')} -print0 | sort -z | xargs -0 sha256sum > ${release}/preserved.sha256
${manifest.entries.map(e=>`test "$(sha256sum ${release}/patch/${e.path} | cut -d' ' -f1)" = '${e.after}'
cp ${release}/patch/${e.path} ${e.path}`).join('\n')}
echo PREPARED > ${release}/status`;
console.log(await run(['ssh','-o','BatchMode=yes',host,pre],new Uint8Array(await readFile(`${out}/patch.tar`))));
await run(['scp','-q',`${out}/Dockerfile`,`${out}/manifest.json`,`${host}:${release}/`]);
console.log(await run(['ssh','-o','BatchMode=yes',host,`flock -n ${root}/.production-release.lock sh -c ${quote(`nohup sh -c ${quote(build)} >${release}/release.log 2>&1 </dev/null & echo BUILD_STARTED`)}`]));
await writeFile(`${out}/operation.json`,JSON.stringify({host,release,status:'building',baseline:manifest.baselineImage},null,2));
