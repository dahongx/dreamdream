/** Stage known public quick symbols only, never borrow another role's scroll widget. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nativeImageSidebarEnvelope,extractNativeImageSidebars,type NativeImageSidebar} from '../src/lib/opening/native-image-sidebar';
const tick=performance.now(),root='logs/mufy-profiles/full-20261013/next-batch-30-20261028',out=root+'/rule-repairs/22/native-quick-symbols';
const evidence=JSON.parse(await readFile(root+'/final-acceptance/22/source-public-component-inventory.json','utf8'));
const source=evidence.roots[0].frames[0].html as string;
if(!source.includes("var COMPONENT_ID = '_MYAPP_QUICK_SYMBOLS_V7'")||!source.includes("forceInput('（）', 1)")||!source.includes("forceInput('$', 1)")||!source.includes("forceInput('$线上聊天：', 6)"))throw Error('KNOWN_PUBLIC_SYMBOL_PROGRAM_REQUIRED');
const quickCss=/shadow\.innerHTML\s*=\s*`\s*<style>([\s\S]*?)<\/style>/.exec(source)?.[1];if(!quickCss||quickCss.includes('${'))throw Error('STATIC_PUBLIC_STYLE_REQUIRED');
const spec:NativeImageSidebar={version:1,variant:'page-controls',shellHtml:'<div class="native-page-controls"></div>',css:'',documents:[],pageControls:{id:'jiangzhi-public-quick-v7',quickCss,scrollButtons:false}};
if(extractNativeImageSidebars(nativeImageSidebarEnvelope(spec)).sidebars.length!==1)throw Error('SCHEMA_FAILED');
const baseline=await readFile(root+'/rule-repairs/22/missing-short-components/profile-overflow-candidate.txt','utf8'),candidate=baseline+'\n'+nativeImageSidebarEnvelope(spec);
if(baseline.includes('jiangzhi-public-quick-v7'))throw Error('ALREADY_STAGED');
await mkdir(out,{recursive:true});await writeFile(out+'/sidebar-spec.json',JSON.stringify(spec,null,2));await writeFile(out+'/candidate-opening.txt',candidate);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');const proof={rank:22,observedAt:new Date().toISOString(),elapsedMs:performance.now()-tick,sourceIndex:0,baselineSha256:hash(baseline),candidateSha256:hash(candidate),allOriginalCharactersPreserved:candidate.startsWith(baseline),scrollWidgetBorrowed:false,authorProgramExecuted:false,baselineRequiresFreshOwnerUiVerification:true,ownerUiSaved:false,fullFidelityAccepted:false};await writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
