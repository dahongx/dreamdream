import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { normalizePublicFrameReplay } from "../src/lib/import/mufy-public-frame-replay";
const root=resolve("outputs/mufy-rank71-80-20261111");
const result=[];
for (const rank of [71,72,73,75,76,77,78,79,80]) {
  const c=JSON.parse(await readFile(join(root,`rank${rank}/public-capture.json`),"utf8"));
  const frames=c.documents.map((html:string,index:number)=>{
    const normalized=normalizePublicFrameReplay(html).html;
    const doc=new JSDOM(normalized).window.document;
    const text=(e:Element)=>e.textContent?.replace(/\s+/g," ").trim().slice(0,100);
    const styles=[...doc.querySelectorAll("style")].map(e=>e.textContent||"").join("\n");
    const scripts=[...doc.querySelectorAll("script")].map(e=>e.textContent||"").join("\n");
    const rules=[...styles.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(m=>/position\s*:\s*(?:fixed|absolute)|(?:height|min-height)\s*:\s*[01]px|overflow\s*:\s*hidden/i.test(m[2])).map(m=>({selector:m[1].trim().slice(0,120),declaration:m[2].trim().slice(0,300)}));
    const dependencies=[...scripts.matchAll(/(?:window\.)?(?:parent|top)\.[A-Za-z_$][\w.$]*|navigator\.clipboard\.[\w]+|\bpostMessage\s*\(|document\.execCommand\s*\([^)]*\)/g)].map(m=>m[0]);
    return {index,characters:html.length,title:doc.title,headings:[...doc.querySelectorAll("h1,h2,h3,h4")].map(text),folds:[...doc.querySelectorAll("summary")].map(text),controls:[...doc.querySelectorAll("button,input,textarea,[onclick]")].map(e=>({tag:e.tagName,id:e.id,text:text(e),title:e.getAttribute("title"),placeholder:e.getAttribute("placeholder"),onclick:e.getAttribute("onclick")})).slice(0,35),media:[...doc.querySelectorAll("audio,video,iframe")].map(e=>({tag:e.tagName,src:e.getAttribute("src"),title:e.getAttribute("title")})),dependencies:[...new Set(dependencies)],layoutRules:rules.slice(0,18)};
  });
  result.push({rank,name:c.name,sourceUrl:c.sourceUrl,observedAt:c.observedAt,frames});
}
await writeFile(join(root,"browser-component-inventory.json"),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
