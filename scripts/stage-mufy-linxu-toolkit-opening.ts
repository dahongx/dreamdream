import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
import {validHaloToolkit} from '../src/lib/opening/halo-toolkit';
const start=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/49/native-toolkit';
const data=JSON.parse(await readFile(out+'/toolkit-data.json','utf8'));if(!validHaloToolkit(data))throw Error('SAFE_PUBLIC_TOOLKIT_REQUIRED');
// The film component has since been saved through the owner UI. Never stage
// from the older import candidate and accidentally undo that verified repair.
const baselinePath=root+'/final-acceptance/49/owner-opening-film-saved-20261031.txt';
const baseline=await readFile(baselinePath,'utf8'),receipt=JSON.parse(await readFile(root+'/final-acceptance/49/film-profile-owner-ui-save-20261031.json','utf8'));
if(!receipt.saved||!receipt.observedAfterFreshNavigation||createHash('sha256').update(baseline).digest('hex')!==receipt.sha256||!baseline.includes('filmTrack'))throw Error('LATEST_OWNER_FILM_BASELINE_REQUIRED');
if(extractNativeImageSidebars(baseline).sidebars.some(s=>s.variant==='halo-toolkit'))throw Error('ALREADY_STAGED');
const spec:NativeImageSidebar={version:1,variant:'halo-toolkit',shellHtml:'<div class="native-halo-toolkit"></div>',css:'',documents:[],haloToolkit:data},envelope=nativeImageSidebarEnvelope(spec);
if(extractNativeImageSidebars(envelope).sidebars.length!==1)throw Error('HALO_SCHEMA_NOT_ROUTED');
const candidate=baseline+'\n'+envelope,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);await writeFile(out+'/opening-proof.json',JSON.stringify({rank:49,observedAt:new Date().toISOString(),elapsedMs:performance.now()-start,baselineSha256:hash(baseline),candidateSha256:hash(candidate),allPreviousBytesPreserved:candidate.startsWith(baseline),nativeEnvelopeCount:1,ownerUiSaved:false,requiresFreshOwnerBaseline:true,buildStarted:false,deployed:false,fullFidelityAccepted:false},null,2));console.log('Staged toolkit opening; no owner write or TEST build.');
