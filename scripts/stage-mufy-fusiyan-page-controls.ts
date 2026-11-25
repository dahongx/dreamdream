/** Known public literal styles only; source programs are never executed. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
const startedAt=new Date().toISOString(),tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/21/native-page-controls';
const evidence=JSON.parse(await readFile(root+'/final-acceptance/21/source-public-component-inventory.json','utf8')),frames=evidence.roots[0].frames as {html:string}[];
const quick=frames[7].html,scroll=frames[9].html;
if(!quick.includes("var COMPONENT_ID = '_MYAPP_QUICK_SYMBOLS_V7'")||!quick.includes("forceInput('（）', 1)")||!quick.includes("forceInput('$', 1)")||!quick.includes("forceInput('$线上聊天：', 6)")||!scroll.includes("container.id = 'fox-elevator-jailbreak'"))throw Error('KNOWN_PUBLIC_CONTROLS_REQUIRED');
const quickCss=/shadow\.innerHTML\s*=\s*`\s*<style>([\s\S]*?)<\/style>/.exec(quick)?.[1],css=/style\.innerHTML\s*=\s*`([\s\S]*?)`/.exec(scroll)?.[1];
if(!quickCss||!css||quickCss.includes('${')||css.includes('${'))throw Error('STATIC_PUBLIC_STYLE_REQUIRED');
const spec:NativeImageSidebar={version:1,variant:'page-controls',shellHtml:'<div class="native-page-controls"></div>',css,documents:[],pageControls:{id:'fusiyan-public-controls-v7',quickCss}};
const envelope=nativeImageSidebarEnvelope(spec);if(extractNativeImageSidebars(envelope).sidebars.length!==1)throw Error('CONTROLS_SCHEMA_FAILED');
const baseline=await readFile(root+'/rule-repairs/21/native-command-drawer/candidate-opening.txt','utf8'),candidate=baseline+'\n'+envelope,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
if(baseline.includes('native-page-controls'))throw Error('ALREADY_STAGED_REVIEW');await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);
const proof={rank:21,startedAt,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,publicSourceIndexes:[7,9],authorProgramExecuted:false,sourceStorageRead:false,baselineSha256:hash(baseline),candidateSha256:hash(candidate),allOriginalCharactersPreserved:candidate.startsWith(baseline),baselineRequiresFreshOwnerUiVerification:true,ownerUiSaved:false,deployed:false,fullFidelityAccepted:false};await writeFile(out+'/candidate-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
