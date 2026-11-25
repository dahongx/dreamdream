/** Narrow follow-up for TEST. Capture source only, never environment or credentials. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
const defaultFamilyFix = process.argv.includes('--default-family');
const allowedDonorFix = defaultFamilyFix || process.argv.includes('--allowed-donor');
const exclusionsFix = allowedDonorFix || process.argv.includes('--generic-replay-exclusions');
const legacyFix = exclusionsFix || process.argv.includes('--legacy-family');
const contrastFix = legacyFix || process.argv.includes('--family-contrast');
const platformFix = contrastFix || process.argv.includes('--platform-family');
const reuseBaseline = platformFix && process.argv.includes('--reuse-baseline');
const familyFix = platformFix || process.argv.includes('--toolbar-family');
const iconFix = familyFix || process.argv.includes('--control-icons');
const layoutFix = iconFix || process.argv.includes('--control-layout');
const shellFix = layoutFix || process.argv.includes('--model-shell');
const output = defaultFamilyFix ? 'outputs/chat-skin-upgrade/default-family' : allowedDonorFix ? 'outputs/chat-skin-upgrade/allowed-donor' : exclusionsFix ? 'outputs/chat-skin-upgrade/generic-replay-exclusions' : legacyFix ? 'outputs/chat-skin-upgrade/legacy-family' : contrastFix ? 'outputs/chat-skin-upgrade/family-contrast' : platformFix ? 'outputs/chat-skin-upgrade/platform-family' : familyFix ? 'outputs/chat-skin-upgrade/toolbar-family' : iconFix ? 'outputs/chat-skin-upgrade/control-icons' : layoutFix ? 'outputs/chat-skin-upgrade/control-layout' : shellFix ? 'outputs/chat-skin-upgrade/model-shell' : 'outputs/chat-skin-upgrade/mask-skin-followup';
const files = platformFix ? ['src/lib/styling/whitelist.ts'] : familyFix ? ['src/lib/styling/whitelist.ts','src/components/chat/source-stage.module.css'] : shellFix ? ['src/lib/styling/whitelist.ts'] : ['src/components/chat/MaskDialog.tsx', ...['types','zh','zh-TW','en','ja-JP','th-TH'].map(x=>`src/i18n/${x}.ts`), 'src/lib/styling/whitelist.ts'];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const norm=(s:string)=>s.replace(/\r\n/g,'\n').trim();
function run(args:string[]){const p=Bun.spawnSync(args,{stderr:'inherit'});if(p.exitCode)throw Error('COMMAND_FAILED');return p.stdout.toString();}
const remote=(cmd:string)=>run(['ssh','-F','NUL','-o','BatchMode=yes','-o','ConnectTimeout=10','root@115.29.213.73',cmd]);
if(!reuseBaseline && remote('cd /root/projects/yearn-chat && docker compose port app 3000').trim()!=='0.0.0.0:8091')throw Error('WRONG_TARGET');
const entries=[];
for(const path of files){
 // The single-session deploy always verifies the live hash and TEST port again.
 const before=reuseBaseline ? await readFile(`${output}/before/${path}`,'utf8') : remote(`cat /root/projects/yearn-chat/${path}`);
 const expected=path.endsWith('source-stage.module.css')?await readFile(`outputs/chat-skin-upgrade/release-candidate/patch/${path}`,'utf8'):path.endsWith('/whitelist.ts')?await readFile(`outputs/chat-skin-upgrade/${defaultFamilyFix ? 'allowed-donor' : allowedDonorFix ? 'generic-replay-exclusions' : legacyFix ? 'family-contrast' : contrastFix ? 'platform-family' : platformFix ? 'toolbar-family' : familyFix ? 'control-icons' : iconFix ? 'control-layout' : layoutFix ? 'model-shell' : shellFix ? 'mask-skin-followup' : 'release-candidate'}/patch/${path}`,'utf8'):run(['git','show',`HEAD:${path}`]);
 let after=await readFile(path,'utf8');
 if(path.startsWith('src/i18n/')){
  const addition=after.split(/\r?\n/).filter(line=>line.includes('maskSaveAndUse:'));
  if(addition.length!==1 || before.includes('maskSaveAndUse:') || before.split('    maskUseThis:').length!==2)throw Error('AMBIGUOUS_I18N_ANCHOR');
  after=before.replace(/(    maskUseThis:[^\n]*\n)/,`$1${addition[0]}\n`);
 }else if(norm(before)!==norm(expected)){
  // The interrupted contrast release restored source while the verified Tips
  // image retained the contrast patch. Accept only that exact recorded source,
  // never an arbitrary remote baseline; the candidate includes both fixes.
  const interruptedContrastBaseline=!defaultFamilyFix && legacyFix && path.endsWith('/whitelist.ts')
   ? await readFile(`outputs/chat-skin-upgrade/platform-family/patch/${path}`,'utf8') : null;
  if(!interruptedContrastBaseline || norm(before)!==norm(interruptedContrastBaseline))throw Error('REMOTE_BASELINE_CHANGED: '+path);
 }
 for(const kind of ['before','patch'])await mkdir(dirname(`${output}/${kind}/${path}`),{recursive:true});
 await writeFile(`${output}/before/${path}`,before);await writeFile(`${output}/patch/${path}`,after);
 entries.push({path,before:hash(before),after:hash(after),group:path.includes('/styling/')?'migration-skin':'mask-functionality'});
}
await writeFile(`${output}/manifest.json`,JSON.stringify({target:'115.29.213.73:8091',observedAt:new Date().toISOString(),entries},null,2));
console.log(`Prepared exact-baseline ${files.length}-file TEST follow-up.`);
