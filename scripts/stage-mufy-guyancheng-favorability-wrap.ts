/** Single-card responsive guard; preserves all original theme characters. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/27';
const baseline=await readFile(dir+'/owner-theme-baseline.txt','utf8');
if(baseline.includes('MUFY_FAVORABILITY_LONG_VALUE_WRAP'))throw Error('ALREADY_PATCHED');
const guard='\n/* MUFY_FAVORABILITY_LONG_VALUE_WRAP */\n#nj_chat_messages .favorability-item{flex-wrap:wrap;gap:6px}#nj_chat_messages .favorability-bar-container{min-width:48px}#nj_chat_messages .favorability-value{flex:0 1 auto;min-width:0;max-width:100%;overflow-wrap:anywhere}';
const candidate=baseline+guard,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(dir+'/candidate-theme.txt',candidate);await writeFile(dir+'/favorability-candidate-proof.json',JSON.stringify({rank:27,observedAt:new Date().toISOString(),baselineSha256:hash(baseline),candidateSha256:hash(candidate),originalCharacters:baseline.length,addedCharacters:guard.length,allOriginalCharactersPreserved:candidate.startsWith(baseline),colorChanges:false,resourceChanges:false,contentChanges:false,ownerUiSaved:false},null,2));
console.log(JSON.stringify({rank:27,originalCharacters:baseline.length,addedCharacters:guard.length}));
