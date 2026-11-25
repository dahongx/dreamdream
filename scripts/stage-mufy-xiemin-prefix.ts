/** Parse cached public source literals; never execute the program or read source storage. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractKnownPublicPrefix} from '../src/lib/import/mufy-public-prefix-extractor';
import {composerPrefixEnvelope} from '../src/lib/opening/composer-prefix';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=root+'/final-acceptance/41',out=root+'/rule-repairs/41/composer-prefix';
const inventory=JSON.parse(await readFile(dir+'/source-public-component-inventory.json','utf8'));
if(!inventory.roleNamePresent||inventory.url!=='https://chat.mufy.ai/chat?roleId=eae9ba16-dbc0-43f7-83b5-0a2ff1494c47')throw Error('PUBLIC_SOURCE_IDENTITY_REQUIRED');
const html=inventory.roots[0].frames[1].html as string;
if(!html.includes('const STORAGE_KEY = "xm_v28"')||!html.includes('color:#ffffff;')||!html.includes('background:#ffffff;'))throw Error('KNOWN_STATIC_PREFIX_SOURCE_REQUIRED');
const live=JSON.parse(await readFile(dir+'/source-controls-live-facts-20261031.json','utf8'));
if(!live.roleNamePresent||live.sourceUrl!==inventory.url)throw Error('LIVE_SOURCE_TYPOGRAPHY_REQUIRED');
const spec=extractKnownPublicPrefix(html,'source-prefix-41',live.facts.trigger.color,live.panelFacts.prefixColor);
if(spec.presets.length!==6)throw Error('PUBLIC_PRESET_COUNT_CHANGED');
const baseline=await readFile(dir+'/mask-form-candidate-opening.txt','utf8');
if(baseline.includes('data-nj-composer-prefix-v1'))throw Error('EXISTING_PREFIX_REQUIRES_REVIEW');
const candidate=baseline+'\n'+composerPrefixEnvelope(spec),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await mkdir(out,{recursive:true});await writeFile(out+'/prefix-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);
const proof={rank:41,sourceIndex:1,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,publicPresets:6,authorProgramExecuted:false,sourceStorageRead:false,allOriginalCharactersPreserved:candidate.startsWith(baseline),baselineSha256:hash(baseline),candidateSha256:hash(candidate),sourceObservedAt:inventory.observedAt,colorBasis:'fresh normal source DOM computed style',colorEvidence:'final-acceptance/41/source-controls-live-facts-20261031.json',requiresFreshOwnerBaseline:true,ownerUiSaved:false,buildStarted:false,deployed:false,fullFidelityAccepted:false};await writeFile(out+'/candidate-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
