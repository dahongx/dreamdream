/** Two exact references only; no media, profile, rules or global runtime changes. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {localizeKnownPublicAuthorFold} from '../src/lib/import/mufy-public-frame-replay';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/43';
const baseline=await readFile(root+'/owner-opening-baseline.txt','utf8'),result=localizeKnownPublicAuthorFold(baseline);
if(!result.localized)throw Error('CURRENT_KNOWN_AUTHOR_FOLD_REQUIRED');
const restored=result.html.replace('onclick="window.cv7ToggleAuthor()"','onclick="window.parent.cv7ToggleAuthor()"').replace('window.cv7ToggleAuthor = function()','window.parent.cv7ToggleAuthor = function()');
if(restored!==baseline)throw Error('UNRELATED_OPENING_CHANGE');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(root+'/author-fold-candidate-opening.txt',result.html);
await writeFile(root+'/author-fold-candidate-proof.json',JSON.stringify({observedAt:new Date().toISOString(),rank:43,baselineSha256:hash(baseline),candidateSha256:hash(result.html),onlyTwoKnownReferencesChanged:true,allOtherOriginalBytesPreserved:true,realParentAccessGranted:false,ownerUiSaved:false,fullFidelityAccepted:false},null,2));
console.log(JSON.stringify({rank:43,onlyTwoKnownReferencesChanged:true,characters:result.html.length,testServerBuildStarted:false}));
