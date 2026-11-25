/** Local, read-only reproduction of the observed rank-49 fold loss. */
import {readFile,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {prepareForMarkdown} from '../src/lib/markdown-prep';
import {sanitizeHtml} from '../src/lib/sanitize';
import {MessageRenderer} from '../src/components/chat/MessageRenderer';
import {MUFY_AQ_DETAILS_PATTERN,MUFY_AQ_PREMATURE_CLOSE_PATTERN,MUFY_AQ_CLOSE_REPLACEMENT,mufyStatusIndentRules} from '../src/lib/import/mufy-status-indent';
const raw=await readFile('logs/mufy-profiles/full-20261013/next-batch-30-20261028/49-gemini4-reply2-raw.txt','utf8');
const batchRoot='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const importedRows=JSON.parse(await readFile(`${batchRoot}/normal-ui-import-receipts.json`,'utf8')).rows;
const sourceKey=importedRows.find((r:{rank:number})=>r.rank===49)?.sourceKey;
if(!sourceKey)throw Error('MISSING_RANK_49_IMPORT_BASELINE');
const baseline=JSON.parse(await readFile(`${batchRoot}/prepared/${sourceKey}/prepared.json`,'utf8'));
console.log(JSON.stringify({futurePreparationCompatibility:mufyStatusIndentRules([baseline.character.opening??'',baseline.character.outputSetting??'',baseline.character.sampleDialogue??'']).map(r=>r.ruleName)}));
console.log(JSON.stringify({rawTagBalance:{divOpen:(raw.match(/<div\b/g)||[]).length,divClose:(raw.match(/<\/div>/g)||[]).length,detailsOpen:(raw.match(/<details\b/g)||[]).length,detailsClose:(raw.match(/<\/details>/g)||[]).length}}));
const bbsMarker='<div class="aq-v2-label"><span>✦</span> 校园匿名 BBS';
const bbsAt=(baseline.character.outputSetting??'').indexOf(bbsMarker);
if(bbsAt>=0)console.log(JSON.stringify({sourceTemplateBbsPrecedingTags:(baseline.character.outputSetting.slice(Math.max(0,bbsAt-700),bbsAt).match(/<\/?(?:div|details|summary|span)\b[^>]*>/g)||[]).slice(-12)}));
const prepared=prepareForMarkdown(raw),safe=sanitizeHtml(prepared);
const fixed=raw.replace(new RegExp(MUFY_AQ_DETAILS_PATTERN,'gm'),'$1');
const balanced=fixed.replace(new RegExp(MUFY_AQ_PREMATURE_CLOSE_PATTERN,'gm'),MUFY_AQ_CLOSE_REPLACEMENT);
const stages={raw,prepared,safe,rendered:renderToStaticMarkup(createElement(MessageRenderer,{source:raw,mufySourceDefaults:true})),fixedRendered:renderToStaticMarkup(createElement(MessageRenderer,{source:fixed,mufySourceDefaults:true})),balancedRendered:renderToStaticMarkup(createElement(MessageRenderer,{source:balanced,mufySourceDefaults:true}))};
for(const [stage,text] of Object.entries(stages)){
 const doc=new JSDOM(text).window.document;
 const summary=Array.from(doc.querySelectorAll('summary')).find(e=>e.textContent?.includes('透明傘'));
 const archive=Array.from(doc.querySelectorAll('summary')).find(e=>e.textContent?.includes('VOL.01'));
 const forum=doc.querySelector('.aq-v2-forum');
 const sourceAncestors=[];let ancestor=summary?.parentElement;
 while(ancestor){if(ancestor.className.startsWith('aq-v2'))sourceAncestors.push(ancestor.className);ancestor=ancestor.parentElement??undefined;}
 console.log(JSON.stringify({stage,summaryParent:summary?.parentElement?.tagName,summaryClass:summary?.parentElement?.className,sourceAncestors,forumInsideDetails:!!forum?.closest('details'),archiveHasOuterDetails:archive?.parentElement?.parentElement?.closest('details')!==null,detailsCount:doc.querySelectorAll('details').length}));
}
if(process.argv.includes('--stage-compatibility')){
 const rules=mufyStatusIndentRules([raw]).filter(r=>r.ruleName==='迁移兼容：来源状态栏缩进（aq-v2）');
 if(rules.length!==1)throw Error('EXPECTED_ONE_SCOPED_COMPATIBILITY_RULE');
 await writeFile('logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/49/indent-only.json',JSON.stringify(rules,null,2)+'\n');
 console.log('Staged one display-only aq-v2 compatibility rule; no live write.');
 const closures=mufyStatusIndentRules([raw]).filter(r=>r.ruleName.includes('冗余结束标签'));
 if(closures.length!==1)throw Error('EXPECTED_ONE_SCOPED_CLOSURE_REPAIR');
 await writeFile(`${batchRoot}/rule-repairs/49/aq-close-only.json`,JSON.stringify(closures,null,2)+'\n');
}
