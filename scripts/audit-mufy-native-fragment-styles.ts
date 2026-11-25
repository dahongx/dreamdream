/** Offline candidate list only: raw host fragments can depend on source host CSS. */
import {readFile,writeFile} from 'node:fs/promises';
import {routeOpeningContentSplit,hasRenderableOpeningBody} from '../src/lib/opening/content';
const root='logs/mufy-profiles/full-20261013/next-batch-30-20261028';
const receipts=JSON.parse(await readFile(`${root}/normal-ui-import-receipts.json`,'utf8'));
const rows=[];
for(const r of receipts.rows){
 const p=JSON.parse(await readFile(`${root}/prepared/${r.sourceKey}/prepared.json`,'utf8'));
 const inline=routeOpeningContentSplit(p.beautification.openingComponent,r.sourceKey).inline;
 if(!inline||inline.kind==='html')continue;
 const docs=inline.kind==='iframe'?[inline.srcdoc]:inline.srcdocs;
 const fragments=docs.map((html,index)=>{
  const markup=html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const styles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
  const classes=[...new Set([...markup.matchAll(/class=["']([^"']+)["']/g)].flatMap(m=>m[1].split(/\s+/)))];
  const missingHostDependencies=classes.filter(c=>!/^w-|^py-/.test(c)&&/^[a-zA-Z][\w-]+$/.test(c)&&(p.beautification.globalCss??'').includes('.'+c)&&!styles.includes('.'+c));
  return{index,characters:html.length,missingHostDependencies,needsActualTargetAndSourceCheck:true,renderable:hasRenderableOpeningBody(html)};
 }).filter(f=>f.renderable&&f.missingHostDependencies.length>0);
 if(fragments.length)rows.push({rank:r.rank,fragments});
}
const result={observedAt:new Date().toISOString(),rows,scope:'original prepared fragments only; no automatic failure, restore or full acceptance'};
await writeFile(`${root}/native-fragment-style-audit.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
