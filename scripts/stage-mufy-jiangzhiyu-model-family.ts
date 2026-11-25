/** Offline, exact generated compatibility selector repair. No remote writes. */
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {lowerLegacyMufyModelSnapshot} from '../src/lib/import/mufy-public-semantic-skin';
import {sanitizeAndScopeCss} from '../src/lib/styling/whitelist';
import postcss from 'postcss';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=root+'/final-acceptance/46',roleId='0dfe12f3-51e2-443d-8323-3952ec7f5d11',hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const before=await readFile(dir+'/owner-theme-family-saved-20261031.css','utf8'),receipt=JSON.parse(await readFile(dir+'/owner-theme-family-saved-20261031.json','utf8'));
if(receipt.sha256!==hash(before)||receipt.characters!==before.length||!receipt.saved||!receipt.observedAfterFreshNavigation)throw Error('CURRENT_OWNER_THEME_RECEIPT_REQUIRED');
const candidate=lowerLegacyMufyModelSnapshot(before,roleId),safe=sanitizeAndScopeCss(candidate,'test').css;
let replayWhite=false,modelFamilyWhite=false;
postcss.parse(safe).walkRules(rule=>{rule.walkDecls('background',decl=>{if(decl.value.replace(/\s/g,'')==='linear-gradient(135deg,#fff0%,#f5f5f5100%)'){if(rule.selector.includes('#nj_chat_input_replay_btn'))replayWhite=true;if(rule.selector.includes('#nj_chat_input_model_btn'.repeat(10)))modelFamilyWhite=true;}});});
if(!replayWhite||!modelFamilyWhite)throw Error('REPLAY_DONOR_NOT_PRESERVED');
const proof={rank:46,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,baselineSha256:hash(before),candidateSha256:hash(candidate),beforeCharacters:before.length,candidateCharacters:candidate.length,changed:'Only exact generated model/family selectors: lower snapshot background and include model in existing replay-family ink. Same declarations, labels, geometry and other author CSS preserved.',ownerUiSaved:false,buildStarted:false,deployed:false,fullFidelityAccepted:false};
await writeFile(dir+'/owner-theme-family-candidate-20261031.css',candidate);await writeFile(dir+'/owner-theme-family-candidate-20261031.json',JSON.stringify(proof,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({phase:'stage-model-family-compatibility',...proof,agentNetMs:null})+'\n');console.log(JSON.stringify(proof));
