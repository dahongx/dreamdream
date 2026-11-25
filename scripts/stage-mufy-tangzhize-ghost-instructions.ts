/** Public native CSS-only drawer; no source script or model data is needed. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {nativeImageSidebarEnvelope,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
import {routeOpeningContentSplit} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',dir=root+'/final-acceptance/32',out=root+'/rule-repairs/32/ghost-instructions';
const source=JSON.parse(await readFile(dir+'/source-native-ghost-instructions.json','utf8'));
const receipt=JSON.parse(await readFile(root+'/normal-ui-import-receipts.json','utf8')).rows.find((r:{rank:number})=>r.rank===32);
if(source.rank!==32||source.sourceUrl!==receipt?.sourceUrl||source.styles.length!==1||source.facts.panel.width!==135||source.open.left!=='0px'||source.open.panelOpacity!=='1')throw Error('PUBLIC_GHOST_SOURCE_NOT_VERIFIED');
const dom=new JSDOM(source.html),node=dom.window.document.querySelector('.ghost-sidebar-container');
if(!node||node.querySelector('script,iframe')||node.querySelectorAll('li').length!==5)throw Error('STATIC_GHOST_SHELL_REQUIRED');
const slot=dom.window.document.createElement('div');slot.setAttribute('data-nj-native-documents','');node.append(slot);
const spec:NativeImageSidebar={version:1,variant:'ghost-focus-left',shellHtml:node.outerHTML,css:source.styles[0],documents:[]};dom.window.close();
const baseline=await readFile(dir+'/owner-opening-baseline.txt','utf8');
if(baseline.includes('data-nj-native-image-sidebar-v1'))throw Error('EXISTING_GHOST_REQUIRES_REVIEW');
// Replace only the terminal legacy drawer, not the profile or global background.
// Its history-dependent bridge is migration glue, not author behavior.
const start=baseline.lastIndexOf('<style>\n/* --- 动画定义 --- */');
const legacy=start<0?'':baseline.slice(start);
if(!legacy.includes('.ghost-sidebar-container')||!legacy.includes(source.html)||!legacy.includes('window.host.getHistory()')||!legacy.trimEnd().endsWith('</script>'))throw Error('LEGACY_GHOST_SUFFIX_NOT_VERIFIED');
const preserved=baseline.slice(0,start);
const candidate=preserved+'\n'+nativeImageSidebarEnvelope(spec);
const route=routeOpeningContentSplit(candidate,'ghost-32');
if(route.floating.filter(w=>w.nativeImageSidebar?.variant==='ghost-focus-left').length!==1||JSON.stringify(route.inline).includes('$把时间推回唐志泽x岁'))throw Error('GHOST_ROUTE_DUPLICATE_OR_MISSING');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');await mkdir(out,{recursive:true});
await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);
const proof={rank:32,observedAt:new Date().toISOString(),sourceUrl:source.sourceUrl,baselineSha256:hash(baseline),candidateSha256:hash(candidate),preservedOriginalCharacters:preserved.length,allNonDrawerCharactersPreserved:candidate.startsWith(preserved),replacedLegacyDrawerCharacters:legacy.length,removedHistoryDependentMigrationGlue:true,sourceListPreserved:true,sourceStylesPreserved:true,scriptDocuments:0,hostRpc:false,realParentAccess:false,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};
await writeFile(out+'/candidate-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
