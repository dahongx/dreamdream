import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const clean='C:/Users/14343/.codex/worktrees/explore-filters-test/yearn-chat';
const out='outputs/mask-production-20261028';
const baseline='/home/lusu/dearm-production-prep-20261020/release-explore-20261027/source';
const files=['src/components/chat/MaskDialog.tsx','src/lib/masks/actions.ts','src/lib/masks/limits.ts',...['types','zh','zh-TW','en','ja-JP','th-TH'].map(x=>`src/i18n/${x}.ts`)];
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function remote(cmd:string){const p=Bun.spawnSync(['ssh','-o','BatchMode=yes','lusu@64.204.66.11',cmd]);if(p.exitCode)throw Error(p.stderr.toString());return p.stdout.toString();}
const entries=[];
for(const path of files){
 const before=path.endsWith('/limits.ts')?null:remote(`cat ${baseline}/${path}`);
 let after=(await readFile(`${clean}/${path}`,'utf8')).replaceAll('\r\n','\n');
 if(path.includes('/i18n/')){
   let merged=before!;
   for(const block of after.match(/^    mask\w+:[^\n]*(?:\n {6,}[^\n]*)*/gm)??[]){
     const key=block.trim().split(':')[0],re=new RegExp(`^    ${key}:[^\\n]*(?:\\n {6,}[^\\n]*)*`,'m');
     merged=re.test(merged)?merged.replace(re,()=>block):merged.replace(/^    maskDialogTitle:[^\n]*$/m,anchor=>`${anchor}\n${block}`);
   }
   after=merged;
 }else if(before!==null){
   const expected=path.endsWith('MaskDialog.tsx')?'01b235d043fccd93263adce8d932d30b09861760c8d002ed04550985cd4acc09':'d6d3b9ddf890629b22127ea515654cf6865839aa5201e74c4ada7fed695fb5c3';
   if(sha(before)!==expected)throw Error('PRODUCTION_BASE_CHANGED');
 }
 new Bun.Transpiler({loader:path.endsWith('.tsx')?'tsx':'ts'}).transformSync(after);
 for(const side of ['before','patch'])await mkdir(dirname(`${out}/${side}/${path}`),{recursive:true});
 if(before!==null)await writeFile(`${out}/before/${path}`,before);
 await writeFile(`${out}/patch/${path}`,after);
 entries.push({path,before:before===null?null:sha(before),after:sha(after)});
}
await writeFile(`${out}/manifest.json`,JSON.stringify({baselineImage:'sha256:0b2b2edaa4171d2a5436b3f7958b97723b157b4a349c616f6eec7bc7bcd29e78',entries},null,2));
console.log('Prepared 9-file production-baseline mask candidate');
