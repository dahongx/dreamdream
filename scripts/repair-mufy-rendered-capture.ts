import {readFile,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const root='logs/mufy-profiles/full-20261013/pilot-5';
const manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'));
for(const row of manifest.rows){
  const snapshot=JSON.parse(await readFile(row.runtimePath,'utf8'));
  const dom=new JSDOM('<body>'+snapshot.renderedOpening.html+'</body>');
  function fix(root:ParentNode){for(const e of root.querySelectorAll('*')){
    for(const a of Array.from(e.attributes))if(/^on/i.test(a.name))e.setAttribute(a.name,a.value.replace(/window\.parent\b/g,'window'));
    if(e instanceof dom.window.HTMLTemplateElement)fix(e.content);
  }}
  fix(dom.window.document.body);
  snapshot.renderedOpening.html=dom.window.document.body.innerHTML;
  await writeFile(row.runtimePath,JSON.stringify(snapshot));
  console.log(JSON.stringify({name:row.name,templateHandlersRebound:true}));
}
