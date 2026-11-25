import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const dir='outputs/mask-release-20261028';
const files=['src/components/chat/MaskDialog.tsx','src/lib/masks/actions.ts','src/lib/masks/limits.ts',...['types','zh','zh-TW','en','ja-JP','th-TH'].map(x=>`src/i18n/${x}.ts`)];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function run(args:string[]){const p=Bun.spawnSync(args);if(p.exitCode)throw Error(p.stderr.toString());return p.stdout.toString();}
const ssh=(s:string)=>run(['ssh','-o','BatchMode=yes','root@115.29.213.73',s]);
if(ssh('cd /root/projects/yearn-chat && docker compose port app 3000').trim()!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const entries=[];
for(const path of files){
 const exists=ssh(`test -f /root/projects/yearn-chat/${path} && echo yes || echo no`).trim()==='yes';
 const before=exists?ssh(`cat /root/projects/yearn-chat/${path}`):null;
 let after=await readFile(path,'utf8');
 if(path.includes('/i18n/')){
   if(before===null)throw Error('MISSING_I18N');
   let merged=before;
   for(const line of after.replaceAll('\r\n','\n').match(/^    mask\w+:[^\n]*(?:\n {6,}[^\n]*)*/gm)??[]){
     const key=line.trim().split(':')[0];
     const re=new RegExp(`^    ${key}:[^\\n]*(?:\\n {6,}[^\\n]*)*`,'m');
     if(re.test(merged)) merged=merged.replace(re,()=>line);
     else {
       if(!/^    maskDialogTitle:[^\n]*$/m.test(merged))throw Error('MISSING_ANCHOR');
       merged=merged.replace(/^    maskDialogTitle:[^\n]*$/m,anchor=>`${anchor}\n${line}`);
     }
   }
   after=merged;
 }else if(path.endsWith('/actions.ts')){
   const base=run(['git','show',`HEAD:${path}`]);
   if(before?.replaceAll('\r\n','\n').trim()!==base.replaceAll('\r\n','\n').trim())throw Error('ACTION_BASE_CHANGED');
 }else if(path.endsWith('/MaskDialog.tsx')){
   if(before===null||hash(before)!=='00ea8087787590820478664ce027796106d94b944177b9dc9734bb2ad11225a6')throw Error('UI_BASE_CHANGED');
 }else if(before!==null)throw Error('NEW_FILE_ALREADY_EXISTS');
 new Bun.Transpiler({loader:path.endsWith('.tsx')?'tsx':'ts'}).transformSync(after);
 for(const kind of ['before','patch'])await mkdir(dirname(`${dir}/${kind}/${path}`),{recursive:true});
 if(before!==null)await writeFile(`${dir}/before/${path}`,before);
 await writeFile(`${dir}/patch/${path}`,after);
 entries.push({path,before:before===null?null:hash(before),after:hash(after)});
}
await writeFile(`${dir}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',entries},null,2));
console.log('Prepared scoped mask release: '+entries.length+' files');
