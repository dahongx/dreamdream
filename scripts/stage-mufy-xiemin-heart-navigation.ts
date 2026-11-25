/** Known public static template, finite host scroll actions only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/41/native-heart-navigation';
const inv=JSON.parse(await readFile(root+'/final-acceptance/41/source-public-component-inventory.json','utf8'));
if(!inv.roleNamePresent||inv.url!=='https://chat.mufy.ai/chat?roleId=eae9ba16-dbc0-43f7-83b5-0a2ff1494c47')throw Error('KNOWN_PUBLIC_SOURCE_REQUIRED');
const input=inv.roots[0].frames[0].html as string;
if(!input.includes("const COMPONENT_ID = 'censy-heart-elevator-v4';"))throw Error('KNOWN_HEART_SOURCE_REQUIRED');
const raw=/const componentHTML = `([\s\S]*?)`;/.exec(input)?.[1];if(!raw)throw Error('STATIC_TEMPLATE_REQUIRED');
const html=raw.replaceAll('${COMPONENT_ID}','censy-heart-elevator-v4');if(html.includes('${'))throw Error('UNKNOWN_TEMPLATE_EXPRESSION');
const dom=new JSDOM(html),doc=dom.window.document,css=doc.querySelector('style')?.textContent,wrap=doc.getElementById('censy-heart-elevator-v4-wrap');
if(!css||!wrap||wrap.querySelectorAll('svg').length!==4||wrap.querySelector('script,iframe'))throw Error('KNOWN_PUBLIC_SHELL_REQUIRED');
const spec:NativeImageSidebar={version:1,variant:'page-controls',shellHtml:'<div class="native-page-controls">'+wrap.outerHTML+'</div>',css,documents:[],pageControls:{id:'xiemin-heart-elevator-v4',quickCss:'',scrollButtons:false,navigation:'heart'}};
if(extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars.length!==1)throw Error('HEART_ROUTE_FAILED');
const baseline=await readFile(root+'/rule-repairs/41/native-static-music/candidate-opening.txt','utf8');if(baseline.includes('xiemin-heart-elevator-v4'))throw Error('ALREADY_STAGED');const candidate=baseline+'\n'+nativeImageSidebarEnvelope(spec),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);dom.window.close();
const proof={rank:41,sourceIndex:0,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceObservedAt:inv.observedAt,sourceStylesPreserved:true,sourceStorageRead:false,authorProgramExecuted:false,scrollScope:'rendered nj_chat_messages only',allOriginalCharactersPreserved:candidate.startsWith(baseline),baselineSha256:hash(baseline),candidateSha256:hash(candidate),requiresFreshOwnerBaseline:true,ownerUiSaved:false,buildStarted:false,deployed:false,fullFidelityAccepted:false};await writeFile(out+'/candidate-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
