import {readFile,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const dir='logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/38';
const rows=[];
for(const side of ['source','target']){
 const raw=await readFile(`${dir}/title-${side}-public-srcdoc-20261103.html`,'utf8'),dom=new JSDOM(raw,{includeNodeLocations:true}),doc=dom.window.document,walker=doc.createTreeWalker(doc.body,4);let node;
 const textNodes=[];while(node=walker.nextNode())if(node.textContent?.includes('html{height:auto')){const loc=dom.nodeLocation(node),parentLoc=node.parentElement?dom.nodeLocation(node.parentElement):null;textNodes.push({parent:node.parentElement?.tagName,parentLocation:parentLoc,parentHead:node.parentElement?.outerHTML.slice(0,500),parentRaw:parentLoc?raw.slice(parentLoc.startOffset,parentLoc.startOffset+650):null,location:loc,context:loc?raw.slice(Math.max(0,loc.startOffset-800),loc.endOffset+50):null});}
 rows.push({side,textNodes,styles:doc.querySelectorAll('style[data-mufy-adaptation]').length,iframes:doc.querySelectorAll('iframe').length,rawCharacters:raw.length});dom.window.close();
}
await writeFile(`${dir}/title-parse-diagnostic-20261103.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
