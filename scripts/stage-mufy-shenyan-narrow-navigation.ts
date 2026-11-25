/** Public normal-UI evidence only; never replay the original broad parent scroller. */
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/43/native-narrow-navigation';
const source=JSON.parse(await readFile(root+'/final-acceptance/43/narrow-navigation-public-source-20261031.json','utf8'));
if(source.rank!==43||source.targetPresent!==0||!source.publicDocument.includes('step = viewH * 0.8'))throw Error('KNOWN_SOURCE_SCROLL_SEMANTICS_REQUIRED');
const dom=new JSDOM(source.publicWidget.html),nav=dom.window.document.getElementById('censy-narrow-nav-v14'),buttons=nav?.querySelectorAll('.Cmtt_nbtn');
if(!nav||buttons?.length!==4||!nav.querySelector('.Tt_nbrand')||dom.window.document.querySelector('script,iframe,input'))throw Error('EXACT_FOUR_ARROWS_REQUIRED');
['top','up','down','bottom'].forEach((action,i)=>{if(buttons[i].getAttribute('onpointerdown')!==`window.parent.cold_tank_narrow_glide('${action}',event)`)throw Error('SOURCE_ACTION_CHANGED');});
const font=source.publicWidget.inherited.font as string;if(!/^[a-zA-Z0-9 ,"'-]{1,250}$/.test(font))throw Error('STATIC_PUBLIC_FONT_REQUIRED');
const spec:NativeImageSidebar={version:1,variant:'page-controls',shellHtml:'<div class="native-page-controls">'+nav.outerHTML+'</div>',css:source.publicWidget.css+'\n#censy-narrow-nav-v14{font-family:'+font+';line-height:1.5}',documents:[],pageControls:{id:'shenyan-narrow-nav-v14',quickCss:'',scrollButtons:false,navigation:'narrow'}};
const envelope=nativeImageSidebarEnvelope(spec);if(extractNativeImageSidebars(envelope).sidebars.length!==1)throw Error('NARROW_SCHEMA_REQUIRED');
const baseline=await readFile(root+'/rule-repairs/43/native-multimodule-island/candidate-opening.txt','utf8');if(baseline.includes('shenyan-narrow-nav-v14'))throw Error('ALREADY_STAGED');const candidate=baseline+'\n'+envelope,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);dom.window.close();
const proof={rank:43,sourceParentUi:'censy-narrow-nav-v14',observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,baselineSha256:hash(baseline),candidateSha256:hash(candidate),allOtherOwnerBytesPreserved:candidate.startsWith(baseline),originalShellAndCssPreserved:true,scrollStepViewportRatio:.8,scope:'Only rendered nj_chat_messages; no unrelated panel scroll, source storage, author script or parent access',ownerUiSaved:false,TESTDeployed:false,fullFidelityAccepted:false};await writeFile(out+'/candidate-proof.json',JSON.stringify(proof,null,2));await appendFile(root+'/timing-runs.jsonl',JSON.stringify({id:'shenyan-narrow-navigation-'+proof.observedAt,observedAt:proof.observedAt,elapsedMs:proof.elapsedMs,kind:'offline-public-navigation-candidate-extraction',agentNetMs:null})+'\n');console.log(JSON.stringify(proof));
