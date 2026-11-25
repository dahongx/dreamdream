/** Public current-owner fixture only; no owner writes or remote build. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {routeOpeningContentSplit} from '../src/lib/opening/content';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/46',text=await readFile(dir+'/owner-opening-current-20261031.txt','utf8'),receipt=JSON.parse(await readFile(dir+'/owner-baseline-current-20261031.json','utf8'));
if(createHash('sha256').update(text).digest('hex')!==receipt.sha256)throw Error('CURRENT_PUBLIC_OWNER_BASELINE_REQUIRED');
const route=routeOpeningContentSplit(text,'fixture').inline;if(route?.kind!=='iframe-multi')throw Error('KNOWN_MULTIFRAGMENT_OPENING_REQUIRED');
const docs=route.srcdocs.filter(d=>d.includes('class="censy-gf-tabs"')&&d.includes('class="censy-gf-details"')&&!/<(?:html|body)\b/i.test(d));if(docs.length!==2)throw Error('EXACT_TWO_PARENT_TABS_REQUIRED');
await writeFile(dir+'/parent-tabs-frame-20261031.json',JSON.stringify({html:'<style data-mufy-adaptation="mobile-box-model"></style>'+docs[0],baselineSha256:receipt.sha256,source:'Actual public owner code; trusted marker only for isolated fixture routing; content unmodified.',ownerUiSaved:false,fullFidelityAccepted:false},null,2));console.log('Staged exact public parent-tab fragment, no TEST write/build.');
