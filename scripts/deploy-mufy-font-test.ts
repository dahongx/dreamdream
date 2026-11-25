/** Narrow TEST font deployment; no database, volume, or production operations. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireTestDiskCapacity} from './mufy-test-disk-preflight';
const dir='logs/mufy-profiles/full-20261013/next-batch-10-20261023/strict-acceptance-20261024';
const ssh=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73'];
async function run(args:string[],capture=false,input?:Uint8Array){const p=Bun.spawn(args,{stdin:input??'ignore',stdout:capture?'pipe':'inherit',stderr:'inherit'});const out=capture?await new Response(p.stdout).text():'';if(await p.exited)throw Error('COMMAND_FAILED');return out.trim();}
const files=['src/components/chat/ChatMessagesList.tsx','src/components/chat/MessageRenderer.tsx','src/components/chat/mufy-shared-component-context.ts'];
const added=['src/lib/import/mufy-original-title-font.ts','public/fonts/mufy-qie-title-51271b875de0.woff2'];
const all=[...files,...added];
const stamp=new Date().toISOString().replace(/\D/g,''),backup=`/root/mufy-transfer-archive-20261015/font-${stamp}`;
const before:Record<string,string>={};
const normalize=(s:string)=>s.replace(/\r\n/g,'\n').trim();
if(await run([...ssh,'cd /root/projects/yearn-chat && docker compose port app 3000'],true)!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
await mkdir(dir+'/font-remote-baseline',{recursive:true});
for(const f of files){
 const remote=await run([...ssh,`cd /root/projects/yearn-chat && cat ${f}`],true);
 await writeFile(dir+'/font-remote-baseline/'+f.split('/').at(-1),remote);
 const local=await readFile(f,'utf8');
 const withoutFont=local.replace(/, MufyOriginalTitleFontContext/g,'')
 .replace(/^import \{ usesMufyOriginalTitleFont, MUFY_ORIGINAL_TITLE_FONT_CSS \}[^\n]*\n/m,'')
 .replace(/^  const originalTitleFont[^\n]*\n/gm,'')
 .replace(/^    <MufyOriginalTitleFontContext.Provider[^\n]*\n/m,'')
 .replace(/^      \{originalTitleFont && <style[^\n]*\n/m,'')
 .replace(/^    <\/MufyOriginalTitleFontContext.Provider>\r?\n/m,'')
 .replace(/ data-mufy-original-title-font=\{originalTitleFont\?'qie-51271b':undefined\}/,'')
 .replace(/\/\*\* Opt-in only for a verified, fixed source-font dependency\. \*\/\r?\nexport const MufyOriginalTitleFontContext=createContext\(false\);\r?\n?/,'');
 if(normalize(withoutFont)!==normalize(remote))throw Error('REMOTE_DIFFERS_BEYOND_FONT: '+f);
 before[f]=await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${f}`],true);
}
console.log('REMOTE_BASELINE_MATCHES_EXACT_FONT_ONLY_CHANGE');
await requireTestDiskCapacity(run,ssh);
if(!process.argv.includes('--deploy'))process.exit(0);
const start=performance.now(),startedAt=new Date().toISOString();
await run(['tar','-cf',dir+'/font-patch.tar',...all]);
await run([...ssh,`umask 077; mkdir -p ${backup}/patch`]);
await run([...ssh,`tar -xf - -C ${backup}/patch`],false,new Uint8Array(await readFile(dir+'/font-patch.tar')));
for(const f of files)if(await run([...ssh,`cd /root/projects/yearn-chat && sha256sum ${f}`],true)!==before[f])throw Error('REMOTE_CHANGED');
for(const f of all){const hash=createHash('sha256').update(await readFile(f)).digest('hex');if(!(await run([...ssh,`sha256sum ${backup}/patch/${f}`],true)).startsWith(hash+' '))throw Error('UPLOAD_HASH_MISMATCH');}
await run([...ssh,`set -e; cd /root/projects/yearn-chat; tar -cf ${backup}/source-before.tar ${files.join(' ')}; docker tag yearn-chat-app:latest yearn-chat-app:before-qie-font-${stamp}; cp -a ${backup}/patch/src/. src/; mkdir -p public/fonts; cp ${backup}/patch/public/fonts/mufy-qie-title-51271b875de0.woff2 public/fonts/; if docker compose build app >${backup}/build.log 2>&1; then docker compose up -d --no-deps app; else tar -xf ${backup}/source-before.tar; echo FONT_BUILD_FAILED; exit 1; fi`]);
const report={startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,backup,files:all,before,deployed:true,visualAccepted:false,databaseOperations:false,productionChanges:false};
await writeFile(dir+'/font-deploy-20261026.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
